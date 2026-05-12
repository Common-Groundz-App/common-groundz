// supabase/functions/cleanup-orphan-media-execute/index.ts
//
// PHASE 2 — DESTRUCTIVE CLEANUP (manual-only, hard-capped).
//
// Scans `post_media` for objects older than MIN_AGE_DAYS that are NOT
// referenced by any post / review / review_update / recommendation /
// entity_photo / entity, and (when mode='execute') deletes them in batches.
//
// Guardrails:
//   - x-cron-secret auth gate (same as dry-run)
//   - mode defaults to 'dry-run'
//   - hard cap MAX_DELETIONS_HARD_CAP regardless of body override
//   - per-run audit row in public.media_cleanup_runs
//   - delete errors are captured, never thrown
//
// No cron is scheduled. Invoke manually via net.http_post.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const BUCKET = 'post_media';
const MIN_AGE_DAYS = 7;
const SAMPLE_LIMIT = 20;
const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

// Hard ceiling. Body `maxDeletions` is clamped to this. Raise deliberately.
const MAX_DELETIONS_HARD_CAP = 200;

interface ObjectMeta {
  path: string;
  updatedAt: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllObjects(prefix = ''): Promise<ObjectMeta[]> {
  const out: ObjectMeta[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      if (entry.id === null) {
        const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
        const nested = await listAllObjects(sub);
        out.push(...nested);
      } else {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        out.push({
          path,
          updatedAt:
            entry.updated_at ?? entry.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return out;
}

async function collectReferencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();

  const addUrl = (u: unknown) => {
    if (typeof u === 'string' && u.length > 0) urls.add(u);
  };
  const addMediaArray = (m: unknown) => {
    if (!Array.isArray(m)) return;
    for (const item of m) {
      if (item && typeof item === 'object') {
        addUrl((item as any).url);
        addUrl((item as any).thumbnail_url);
      }
    }
  };

  {
    const { data, error } = await supabase.from('posts').select('media');
    if (error) throw error;
    for (const row of data ?? []) addMediaArray((row as any).media);
  }
  {
    const { data, error } = await supabase
      .from('reviews')
      .select('media,image_url');
    if (error) throw error;
    for (const row of data ?? []) {
      addMediaArray((row as any).media);
      addUrl((row as any).image_url);
    }
  }
  {
    const { data, error } = await supabase.from('review_updates').select('media');
    if (error) throw error;
    for (const row of data ?? []) addMediaArray((row as any).media);
  }
  {
    const { data, error } = await supabase
      .from('recommendations')
      .select('image_url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).image_url);
  }
  {
    const { data, error } = await supabase.from('entity_photos').select('url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).url);
  }
  {
    const { data, error } = await supabase.from('entities').select('image_url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).image_url);
  }

  return urls;
}

function bucketPathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  const expected = Deno.env.get('CLEANUP_CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse body (optional)
  let body: { mode?: string; maxDeletions?: number } = {};
  try {
    if (req.method === 'POST') {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    }
  } catch {
    body = {};
  }

  const mode: 'dry-run' | 'execute' =
    body.mode === 'execute' ? 'execute' : 'dry-run';

  const requestedCap =
    typeof body.maxDeletions === 'number' && body.maxDeletions > 0
      ? Math.floor(body.maxDeletions)
      : MAX_DELETIONS_HARD_CAP;
  const maxDeletions = Math.min(requestedCap, MAX_DELETIONS_HARD_CAP);

  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  console.log(
    `[cleanup-orphan-media-execute] mode=${mode} cap=${maxDeletions} starting`
  );

  try {
    const [allObjects, referencedUrls] = await Promise.all([
      listAllObjects(),
      collectReferencedUrls(),
    ]);

    const referencedPaths = new Set<string>();
    for (const url of referencedUrls) {
      const p = bucketPathFromPublicUrl(url);
      if (p) referencedPaths.add(p);
    }

    const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;

    let scanned = 0;
    let skippedYoung = 0;
    let skippedReferenced = 0;
    const orphans: string[] = [];

    for (const obj of allObjects) {
      scanned += 1;
      if (new Date(obj.updatedAt).getTime() >= cutoff) {
        skippedYoung += 1;
        continue;
      }
      if (referencedPaths.has(obj.path)) {
        skippedReferenced += 1;
        continue;
      }
      orphans.push(obj.path);
    }

    const wouldDelete = orphans.length;

    let deleted = 0;
    const sampleDeleted: string[] = [];
    const errors: { path?: string; message: string }[] = [];

    if (mode === 'execute' && orphans.length > 0) {
      const targets = orphans.slice(0, maxDeletions);

      for (let i = 0; i < targets.length; i += DELETE_BATCH_SIZE) {
        const batch = targets.slice(i, i + DELETE_BATCH_SIZE);
        try {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .remove(batch);
          if (error) {
            errors.push({ message: `batch ${i}: ${error.message}` });
            continue;
          }
          const ok = (data ?? []).length;
          deleted += ok;
          for (const item of data ?? []) {
            if (sampleDeleted.length < SAMPLE_LIMIT) {
              sampleDeleted.push((item as any).name ?? '');
            }
          }
        } catch (e) {
          errors.push({
            message: `batch ${i} threw: ${(e as Error).message}`,
          });
        }
      }
    } else {
      // dry-run: populate sample from orphans for visibility
      for (const p of orphans.slice(0, SAMPLE_LIMIT)) sampleDeleted.push(p);
    }

    const tookMs = Date.now() - startedAt;
    const finishedAtIso = new Date().toISOString();

    // Audit row
    let runId: string | null = null;
    try {
      const { data: auditRow, error: auditErr } = await supabase
        .from('media_cleanup_runs')
        .insert({
          started_at: startedAtIso,
          finished_at: finishedAtIso,
          mode,
          scanned,
          would_delete: wouldDelete,
          deleted,
          skipped_young: skippedYoung,
          skipped_referenced: skippedReferenced,
          referenced_path_count: referencedPaths.size,
          max_deletions: maxDeletions,
          sample_deleted: sampleDeleted,
          errors,
          took_ms: tookMs,
        })
        .select('id')
        .single();
      if (auditErr) {
        console.error('[cleanup-orphan-media-execute] audit insert failed', auditErr);
      } else {
        runId = (auditRow as any)?.id ?? null;
      }
    } catch (e) {
      console.error(
        '[cleanup-orphan-media-execute] audit insert threw',
        (e as Error).message
      );
    }

    const result = {
      mode,
      bucket: BUCKET,
      minAgeDays: MIN_AGE_DAYS,
      maxDeletions,
      scanned,
      wouldDelete,
      deleted,
      skipped: { tooYoung: skippedYoung, referenced: skippedReferenced },
      referencedPathCount: referencedPaths.size,
      sampleDeleted,
      errors,
      runId,
      tookMs,
      note:
        mode === 'execute'
          ? `Executed delete pass — capped at ${maxDeletions}. Verify media_cleanup_runs row ${runId} and the app before raising the cap.`
          : 'DRY RUN — no objects were deleted.',
    };

    console.log(
      '[cleanup-orphan-media-execute]',
      JSON.stringify({ ...result, sampleDeleted: sampleDeleted.length })
    );

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[cleanup-orphan-media-execute] error', err);
    return new Response(
      JSON.stringify({
        error: 'cleanup_execute_failed',
        detail: (err as Error).message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
