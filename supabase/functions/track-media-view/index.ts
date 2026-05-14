import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  source: z.enum(['post', 'review', 'entity']).default('post'),
  sourceId: z.string().uuid(),
  mediaPath: z.string().min(1).max(2048),
  wasAutoplay: z.boolean().default(false),
  watchMs: z.number().int().min(0).max(60 * 60 * 1000),
  anonSessionId: z.string().min(8).max(128).optional(),
  trackerVersion: z.string().max(32).optional(),
});

const MIN_WATCH_MS = 2500;

// In-memory throttle (best-effort; resets on cold start)
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
function throttled(ipHash: string | null): boolean {
  if (!ipHash) return false;
  const now = Date.now();
  const bucket = ipBuckets.get(ipHash);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ipHash, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 60;
}

function normalizeMediaPath(input: string): string {
  // Strip protocol/host and query/hash; preserve casing.
  let path: string;
  try {
    const u = new URL(input);
    path = u.pathname;
  } catch {
    path = input.split('?')[0].split('#')[0];
  }
  path = path.replace(/^\/+/, '');
  // Strip Supabase Storage prefix (public or signed URLs) so dedupe key is bucket-relative
  path = path.replace(/^storage\/v1\/object\/(public|sign)\/[^/]+\//, '');
  return path;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, reason: 'invalid' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = parsed.data;

    if (body.watchMs < MIN_WATCH_MS) {
      return new Response(JSON.stringify({ ok: false, reason: 'too_short' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Resolve user from JWT if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace('Bearer ', '');
        const { data } = await userClient.auth.getClaims(token);
        if (data?.claims?.sub) userId = data.claims.sub as string;
      } catch {
        /* ignore — treat as anon */
      }
    }

    // IP hash (best-effort)
    const salt = Deno.env.get('VIEW_IP_SALT');
    let ipHash: string | null = null;
    if (salt) {
      const xff = req.headers.get('x-forwarded-for') ?? '';
      const ip = xff.split(',')[0]?.trim();
      if (ip) ipHash = await sha256Hex(`${salt}:${ip}`);
      if (throttled(ipHash)) {
        return new Response(JSON.stringify({ ok: false, reason: 'throttled' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!userId && !body.anonSessionId) {
      return new Response(JSON.stringify({ ok: false, reason: 'no_identity' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mediaPath = normalizeMediaPath(body.mediaPath);

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from('media_views').insert({
      source: body.source,
      source_id: body.sourceId,
      media_path: mediaPath,
      user_id: userId,
      anon_session_id: userId ? null : body.anonSessionId ?? null,
      was_autoplay: body.wasAutoplay,
      watch_ms: body.watchMs,
      ip_hash: ipHash,
      tracker_version: body.trackerVersion ?? 'v1',
    });

    if (error) {
      // Unique violation = already counted (dedupe success)
      if ((error as any).code === '23505') {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: 'server_error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'server_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
