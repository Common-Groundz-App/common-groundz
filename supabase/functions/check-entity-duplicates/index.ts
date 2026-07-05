// Phase 3.3A-2 — admin-only, read-only duplicate detection.
// No DB writes. Returns candidates the host UI shows in a "Did you mean?" step.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isNonAdminEntityCreationEnabled } from '../_shared/feature_flags.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Best-effort in-memory rate limit: 30 req/min per user.
// Acknowledged non-durable in serverless; sufficient for admin-only 3.3A.
const rateBucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(userId: string): boolean {
  const now = Date.now();
  const slot = rateBucket.get(userId);
  if (!slot || slot.resetAt < now) {
    rateBucket.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (slot.count >= 30) return false;
  slot.count++;
  return true;
}

function safeHostname(url?: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}
function normalizeFullUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${u.protocol}//${host}${path}`;
  } catch { return null; }
}


interface Body {
  mode?: 'full' | 'exact_url_preflight';
  name?: string;
  type?: string;
  parentId?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  slug?: string | null;
  apiSource?: string | null;
  apiRef?: string | null;
}

interface Candidate {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  type: string;
  parent_name: string | null;
  score: number;
  reasons: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId, _role: 'admin',
    });
    if (!isAdmin) {
      const enabled = await isNonAdminEntityCreationEnabled(supabaseAdmin);
      if (!enabled) {
        return new Response(JSON.stringify({ error: 'Forbidden', code: 'NON_ADMIN_DISABLED' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!rateLimit(userId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const mode = body.mode === 'exact_url_preflight' ? 'exact_url_preflight' : 'full';
    const name = (body.name ?? '').trim();
    const type = (body.type ?? '').trim();
    // In 'full' mode, name+type are required. In 'exact_url_preflight' they're optional.
    if (mode === 'full' && (!name || !type)) {
      return new Response(JSON.stringify({ candidates: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const slug = body.slug?.trim() || null;
    const websiteHost = safeHostname(body.websiteUrl);
    const websiteUrlNorm = normalizeFullUrl(body.websiteUrl);
    const sourceHost = safeHostname(body.sourceUrl);
    const sourceUrlNorm = normalizeFullUrl(body.sourceUrl);
    const parentId = body.parentId || null;
    const apiSource = body.apiSource || null;
    const apiRef = body.apiRef || null;



    const collected = new Map<string, Candidate>();
    const add = (row: any, score: number, reason: string) => {
      const ex = collected.get(row.id);
      if (ex) {
        ex.score = Math.max(ex.score, score);
        if (!ex.reasons.includes(reason)) ex.reasons.push(reason);
        return;
      }
      collected.set(row.id, {
        id: row.id, name: row.name, slug: row.slug ?? null,
        image_url: row.image_url ?? null, type: row.type,
        parent_name: row.parent?.name ?? null,
        score, reasons: [reason],
      });
    };

    const SELECT = 'id, name, slug, image_url, type, parent_id, website_url, api_source, api_ref, metadata, parent:parent_id(name)';

    // ─── exact_url_preflight — run ONLY normalized-URL equality against
    // entities.website_url and metadata->>created_from_url. Skip name/slug/
    // api_ref/parent-boost/host heuristics. Returns immediately.
    if (mode === 'exact_url_preflight') {
      if (websiteHost && websiteUrlNorm) {
        const { data } = await supabaseAdmin
          .from('entities').select(SELECT)
          .eq('is_deleted', false).ilike('website_url', `%${websiteHost}%`).limit(20);
        (data ?? []).forEach(r => {
          if (normalizeFullUrl(r.website_url) === websiteUrlNorm) {
            add(r, 1.0, 'Same website');
          }
        });
      }
      if (sourceHost && sourceUrlNorm) {
        const { data } = await supabaseAdmin
          .from('entities').select(SELECT)
          .eq('is_deleted', false)
          .filter('metadata->>created_from_url', 'ilike', `%${sourceHost}%`)
          .limit(20);
        (data ?? []).forEach(r => {
          const fromUrl = (r.metadata as any)?.created_from_url;
          if (normalizeFullUrl(fromUrl) === sourceUrlNorm) {
            add(r, 1.0, 'Created from same source URL');
          }
        });
      }
      const candidates = Array.from(collected.values()).slice(0, 6);
      return new Response(JSON.stringify({ candidates, mode }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // 1) Fuzzy name match scoped by type via pg_trgm.
    const { data: trgmRows, error: rpcError } = await supabaseAdmin
      .rpc('match_entities_by_name', { _name: name, _type: type, _threshold: 0.55, _limit: 8 });
    let nameMatches: any[] = Array.isArray(trgmRows) ? trgmRows : [];
    if (rpcError) console.warn('match_entities_by_name failed, falling back to ILIKE:', rpcError);
    if (nameMatches.length === 0) {
      const firstWord = name.split(/\s+/)[0] ?? name;
      const { data } = await supabaseAdmin
        .from('entities')
        .select(SELECT)
        .eq('is_deleted', false)
        .eq('type', type as any)
        .ilike('name', `%${firstWord}%`)
        .limit(8);
      nameMatches = (data ?? []).map((r: any) => ({ ...r, similarity: 0.55 }));
    }
    for (const row of nameMatches) {
      const sim = typeof row.similarity === 'number' ? row.similarity : 0.6;
      add(row, sim, `Similar name (${Math.round(sim * 100)}%)`);
    }

    // 2) Exact lower(slug) match on entities.slug.
    if (slug) {
      const { data } = await supabaseAdmin
        .from('entities').select(SELECT)
        .eq('is_deleted', false).eq('slug', slug).limit(5);
      (data ?? []).forEach(r => add(r, 0.95, 'Same slug'));
    }

    // 3) entity_slug_history.old_slug match.
    if (slug) {
      const { data: histRows } = await supabaseAdmin
        .from('entity_slug_history').select('entity_id').eq('old_slug', slug).limit(5);
      const ids = (histRows ?? []).map((r: any) => r.entity_id).filter(Boolean);
      if (ids.length) {
        const { data } = await supabaseAdmin
          .from('entities').select(SELECT).in('id', ids).eq('is_deleted', false);
        (data ?? []).forEach(r => add(r, 0.9, 'Previously used this slug'));
      }
    }

    // 4) website_url exact normalized-URL match (host-only match caused false positives on retailer domains).
    if (websiteHost && websiteUrlNorm) {
      const { data } = await supabaseAdmin
        .from('entities').select(SELECT)
        .eq('is_deleted', false).ilike('website_url', `%${websiteHost}%`).limit(20);
      (data ?? []).forEach(r => {
        if (normalizeFullUrl(r.website_url) === websiteUrlNorm) {
          add(r, 0.85, 'Same website');
        }
      });
    }

    // 5) metadata->>'created_from_url' EXACT normalized-URL match.
    // Prior host+first-path-segment/host-only fallbacks matched unrelated products on shared retailer paths (e.g. `/en/products/...`).
    if (sourceHost && sourceUrlNorm) {
      const { data } = await supabaseAdmin
        .from('entities').select(SELECT)
        .eq('is_deleted', false)
        .filter('metadata->>created_from_url', 'ilike', `%${sourceHost}%`)
        .limit(20);
      (data ?? []).forEach(r => {
        const fromUrl = (r.metadata as any)?.created_from_url;
        if (normalizeFullUrl(fromUrl) === sourceUrlNorm) {
          add(r, 0.8, 'Created from same source URL');
        }
      });
    }


    // 6) (api_source, api_ref) exact.
    if (apiSource && apiRef) {
      const { data } = await supabaseAdmin
        .from('entities').select(SELECT)
        .eq('is_deleted', false).eq('api_source', apiSource).eq('api_ref', apiRef).limit(5);
      (data ?? []).forEach(r => add(r, 1.0, 'Same external reference'));
    }

    // Boost candidates sharing the same parent.
    if (parentId) {
      for (const c of collected.values()) {
        const row = nameMatches.find(r => r.id === c.id);
        if (row?.parent_id === parentId) {
          c.score = Math.min(1, c.score + 0.1);
          c.reasons.push('Same brand');
        }
      }
    }

    const candidates = Array.from(collected.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return new Response(JSON.stringify({ candidates }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('check-entity-duplicates error', err);
    return new Response(JSON.stringify({ error: 'Internal error', detail: err?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
