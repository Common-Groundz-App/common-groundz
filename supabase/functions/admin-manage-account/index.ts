import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Admin check via is_admin_user RPC
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin_user', {
      user_email: user.email,
    });

    if (adminError || !isAdmin) {
      console.log('Admin check failed for:', user.email, adminError);
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403);
    }

    // 3. Admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    // ── LIST-DELETED ──
    if (action === 'list-deleted') {
      const page = Math.max(1, body.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, body.page_size ?? 20));
      const search = body.search?.trim() || '';
      const offset = (page - 1) * pageSize;

      let query = adminClient
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, deleted_at, created_at', { count: 'exact' })
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (search) {
        query = query.ilike('username', `%${search}%`);
      }

      const { data: profiles, count, error: profilesError } = await query;

      if (profilesError) {
        console.error('Error fetching deleted profiles:', profilesError);
        return jsonResponse({ error: 'Failed to fetch deleted profiles' }, 500);
      }

      // Fetch emails for each profile
      const enriched = await Promise.all(
        (profiles || []).map(async (p) => {
          try {
            const { data: authUser } = await adminClient.auth.admin.getUserById(p.id);
            return { ...p, email: authUser?.user?.email ?? null };
          } catch {
            return { ...p, email: null };
          }
        })
      );

      return jsonResponse({
        data: enriched,
        total: count ?? 0,
        page,
        page_size: pageSize,
      });
    }

    // ── RECOVER ──
    if (action === 'recover') {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: 'user_id required' }, 400);

      // Verify soft-deleted
      const { data: profile, error: pErr } = await adminClient
        .from('profiles')
        .select('id, username, deleted_at')
        .eq('id', user_id)
        .single();

      if (pErr || !profile) return jsonResponse({ error: 'Profile not found' }, 404);
      if (!profile.deleted_at) return jsonResponse({ error: 'Account is not deleted' }, 400);

      // Fetch email for audit
      let targetEmail: string | null = null;
      try {
        const { data: authUser } = await adminClient.auth.admin.getUserById(user_id);
        targetEmail = authUser?.user?.email ?? null;
      } catch { /* non-fatal */ }

      // Recover
      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({ deleted_at: null })
        .eq('id', user_id);

      if (updateErr) {
        console.error('Recover failed:', updateErr);
        return jsonResponse({ error: 'Failed to recover account' }, 500);
      }

      // Audit log
      await adminClient.from('admin_actions').insert({
        admin_user_id: user.id,
        action_type: 'recover_account',
        target_type: 'user',
        target_id: user_id,
        details: {
          target_username: profile.username,
          target_email: targetEmail,
          previous_deleted_at: profile.deleted_at,
        },
      });

      console.log(`Account recovered: ${user_id} by admin ${user.id}`);
      return jsonResponse({ success: true, message: 'Account recovered' });
    }

    // ── HARD-DELETE ──
    if (action === 'hard-delete') {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: 'user_id required' }, 400);

      // Verify soft-deleted first
      const { data: profile, error: pErr } = await adminClient
        .from('profiles')
        .select('id, username, deleted_at')
        .eq('id', user_id)
        .single();

      if (pErr || !profile) return jsonResponse({ error: 'Profile not found' }, 404);
      if (!profile.deleted_at) {
        return jsonResponse({ error: 'Cannot hard-delete an active account. Soft-delete first.' }, 400);
      }

      // Fetch email for audit
      let targetEmail: string | null = null;
      try {
        const { data: authUser } = await adminClient.auth.admin.getUserById(user_id);
        targetEmail = authUser?.user?.email ?? null;
      } catch { /* non-fatal */ }

      // Audit log BEFORE deletion (so we have a record even if delete partially fails)
      await adminClient.from('admin_actions').insert({
        admin_user_id: user.id,
        action_type: 'hard_delete_account',
        target_type: 'user',
        target_id: user_id,
        details: {
          target_username: profile.username,
          target_email: targetEmail,
          deleted_at: profile.deleted_at,
        },
      });

      // Permanently delete from auth (cascades to profiles via FK)
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteErr) {
        console.error('Hard delete failed:', deleteErr);
        return jsonResponse({ error: 'Failed to permanently delete account' }, 500);
      }

      console.log(`Account hard-deleted: ${user_id} by admin ${user.id}`);
      return jsonResponse({ success: true, message: 'Account permanently deleted' });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('admin-manage-account error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
