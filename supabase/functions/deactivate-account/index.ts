 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.3';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 Deno.serve(async (req) => {
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       console.log('No authorization header provided');
       return new Response(
         JSON.stringify({ error: 'Unauthorized', code: 'NO_AUTH' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Create Supabase client with user's auth token
     const supabaseClient = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
       { global: { headers: { Authorization: authHeader } } }
     );
 
     // Get authenticated user
     const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
     
     if (userError || !user) {
       console.error('Error getting user:', userError);
       return new Response(
         JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log('Deactivating account for user:', user.id);
 
     // DOUBLE-DELETE GUARD: Check if already deleted
     const { data: profile, error: profileError } = await supabaseClient
       .from('profiles')
       .select('deleted_at')
       .eq('id', user.id)
       .single();
 
     if (profileError) {
       console.error('Error fetching profile:', profileError);
       return new Response(
         JSON.stringify({ error: 'Failed to fetch profile', code: 'PROFILE_ERROR' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     if (profile?.deleted_at) {
       console.log('Account already deleted:', user.id);
       return new Response(
         JSON.stringify({ error: 'Account already deleted', code: 'ALREADY_DELETED' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Soft delete: set deleted_at timestamp
     const { error: updateError } = await supabaseClient
       .from('profiles')
       .update({ deleted_at: new Date().toISOString() })
       .eq('id', user.id);
 
     if (updateError) {
       console.error('Failed to update profile:', updateError);
       return new Response(
         JSON.stringify({ error: 'Failed to deactivate account', code: 'UPDATE_ERROR' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log('Account soft-deleted:', user.id);
 
     // Sign out all sessions using admin client
     const adminClient = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     );
 
     const { error: signOutError } = await adminClient.auth.admin.signOut(user.id, 'global');
     
     if (signOutError) {
       console.error('Error signing out user (non-fatal):', signOutError);
       // Don't fail the request - the account is already deleted
     } else {
       console.log('All sessions invalidated for:', user.id);
     }
 
     return new Response(
       JSON.stringify({ success: true, message: 'Account deactivated successfully' }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('Error deactivating account:', error);
     return new Response(
       JSON.stringify({ error: 'Failed to deactivate account', code: 'UNEXPECTED_ERROR' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });