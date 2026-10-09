// D2 — deletes saved photos that the database queued and re-confirmed as
// unreferenced. Ships OFF: claim_media_deletions returns nothing unless
// app_config 'media_cleanup.processing_enabled' is true. No schedule exists.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { runWorker, type Claim } from './worker.ts';

const BUCKET = 'post_media';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const expected = Deno.env.get('CLEANUP_CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (!expected || !provided || provided !== expected) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const report = await runWorker({
      recheckKept: async () => {
        const { data, error } = await supabase.rpc('recheck_kept_media', { p_limit: 100 });
        if (error) throw error;
        return (data as number) ?? 0;
      },
      claim: async (limit, lease) => {
        const { data, error } = await supabase.rpc('claim_media_deletions', { p_limit: limit, p_lease_seconds: lease });
        if (error) throw error;
        return (data ?? []) as Claim[];
      },
      processingEnabled: async () => {
        const { data, error } = await supabase.rpc('media_cleanup_processing_enabled');
        return !error && data === true;
      },
      removeObject: async (path) => {
        // Missing objects return no error -> treated as already deleted.
        const { error } = await supabase.storage.from(BUCKET).remove([path]);
        return error ? error.message : null;
      },
      finish: async (path, token, outcome, err) => {
        const { data, error } = await supabase.rpc('finish_media_deletion', {
          p_path: path, p_token: token, p_outcome: outcome, p_error: err ?? null,
        });
        if (error) throw error;
        return data as string;
      },
    });
    console.log('[process-media-deletions]', JSON.stringify(report));
    return json(report);
  } catch (e) {
    console.error('[process-media-deletions] error', (e as Error).message);
    return json({ error: 'media_deletion_run_failed' }, 500);
  }
});
