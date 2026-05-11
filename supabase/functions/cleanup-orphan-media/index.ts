// supabase/functions/cleanup-orphan-media/index.ts
//
// PHASE 1.5 — DRY-RUN ONLY.
//
// Scans the `post_media` storage bucket for objects older than 7 days that
// are NOT referenced by any post / review / recommendation / entity photo /
// entity image, and reports counts + a sample of orphans.
//
// THIS FUNCTION DOES NOT DELETE ANYTHING. There is no destructive code path
// in this build. A separate `cleanup-orphan-media-execute` function will be
// added in a follow-up only after we verify dry-run output looks correct.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'post_media';
const MIN_AGE_DAYS = 7;
const SAMPLE_LIMIT = 20;
const PAGE_SIZE = 1000;

interface ObjectMeta {
  path: string; // bucket-relative path
  updatedAt: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Recursively list every object in a bucket, returning bucket-relative paths. */
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
      // Folders have id === null in Supabase storage list responses.
      if (entry.id === null) {
        const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
        const nested = await listAllObjects(sub);
        out.push(...nested);
      } else {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        out.push({
          path,
          updatedAt: entry.updated_at ?? entry.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return out;
}

/** Build the set of all referenced public URLs across every relevant table. */
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

  // posts.media (jsonb array of MediaItem)
  {
    const { data, error } = await supabase.from('posts').select('media');
    if (error) throw error;
    for (const row of data ?? []) addMediaArray((row as any).media);
  }

  // reviews.media + reviews.image_url
  {
    const { data, error } = await supabase.from('reviews').select('media,image_url');
    if (error) throw error;
    for (const row of data ?? []) {
      addMediaArray((row as any).media);
      addUrl((row as any).image_url);
    }
  }

  // review_updates.media
  {
    const { data, error } = await supabase.from('review_updates').select('media');
    if (error) throw error;
    for (const row of data ?? []) addMediaArray((row as any).media);
  }

  // recommendations.image_url
  {
    const { data, error } = await supabase.from('recommendations').select('image_url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).image_url);
  }

  // entity_photos.url
  {
    const { data, error } = await supabase.from('entity_photos').select('url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).url);
  }

  // entities.image_url
  {
    const { data, error } = await supabase.from('entities').select('image_url');
    if (error) throw error;
    for (const row of data ?? []) addUrl((row as any).image_url);
  }

  return urls;
}

function bucketPathFromPublicUrl(url: string): string | null {
  // Public URL pattern: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  console.log('[cleanup-orphan-media] DRY RUN starting');

  try {
    const [allObjects, referencedUrls] = await Promise.all([
      listAllObjects(),
      collectReferencedUrls(),
    ]);

    // Convert referenced public URLs → bucket-relative paths for comparison.
    const referencedPaths = new Set<string>();
    for (const url of referencedUrls) {
      const p = bucketPathFromPublicUrl(url);
      if (p) referencedPaths.add(p);
    }

    const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;

    let scanned = 0;
    let skippedYoung = 0;
    let skippedReferenced = 0;
    let wouldDelete = 0;
    const sampleOrphans: string[] = [];

    for (const obj of allObjects) {
      scanned += 1;
      const ageOk = new Date(obj.updatedAt).getTime() < cutoff;
      if (!ageOk) {
        skippedYoung += 1;
        continue;
      }
      if (referencedPaths.has(obj.path)) {
        skippedReferenced += 1;
        continue;
      }
      wouldDelete += 1;
      if (sampleOrphans.length < SAMPLE_LIMIT) sampleOrphans.push(obj.path);
    }

    const result = {
      mode: 'dry-run',
      bucket: BUCKET,
      minAgeDays: MIN_AGE_DAYS,
      scanned,
      wouldDelete,
      skipped: {
        tooYoung: skippedYoung,
        referenced: skippedReferenced,
      },
      referencedPathCount: referencedPaths.size,
      sampleOrphans,
      tookMs: Date.now() - startedAt,
      note:
        'DRY RUN — no objects were deleted. Verify sampleOrphans against the DB before enabling destructive cleanup.',
    };

    console.log('[cleanup-orphan-media]', JSON.stringify(result));

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[cleanup-orphan-media] error', err);
    return new Response(
      JSON.stringify({ error: 'cleanup_scan_failed', detail: (err as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
