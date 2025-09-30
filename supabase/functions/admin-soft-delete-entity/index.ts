import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  entityId: string;
  action: 'delete' | 'restore';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for elevated privileges
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create a separate client for user validation to avoid context contamination
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user's JWT token using the auth client
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin using service role client with RPC call
    const { data: isAdmin, error: adminCheckError } = await supabaseServiceRole.rpc('is_admin_user', {
      user_email: user.email
    })
    
    if (adminCheckError) {
      console.error('Admin check failed:', adminCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!isAdmin) {
      console.error('User is not admin:', user.email)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const body: RequestBody = await req.json()
    const { entityId, action } = body

    if (!entityId || !action) {
      return new Response(
        JSON.stringify({ error: 'entityId and action are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get entity details before updating using service role client
    const { data: entity, error: fetchError } = await supabaseServiceRole
      .from('entities')
      .select('id, name, type, is_deleted')
      .eq('id', entityId)
      .single()

    if (fetchError || !entity) {
      console.error('Entity not found:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Entity not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate action based on current state
    if (action === 'delete' && entity.is_deleted) {
      return new Response(
        JSON.stringify({ error: 'Entity is already deleted' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'restore' && !entity.is_deleted) {
      return new Response(
        JSON.stringify({ error: 'Entity is not deleted' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Perform the soft delete/restore operation using service role client
    const newDeletedState = action === 'delete'
    const { error: updateError } = await supabaseServiceRole
      .from('entities')
      .update({
        is_deleted: newDeletedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)

    if (updateError) {
      console.error('Update failed:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update entity' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the admin action using service role client
    const actionType = action === 'delete' ? 'soft_delete_entity' : 'restore_entity'
    const { error: logError } = await supabaseServiceRole
      .from('admin_actions')
      .insert({
        admin_user_id: user.id,
        action_type: actionType,
        target_type: 'entity',
        target_id: entityId,
        details: {
          entity_name: entity.name,
          entity_type: entity.type,
          previous_state: entity.is_deleted ? 'deleted' : 'active'
        }
      })

    if (logError) {
      console.error('Failed to log admin action:', logError)
      // Don't fail the request for logging errors, just log it
    }

    console.log(`Admin ${action} successful for entity ${entityId} by user ${user.email}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Entity ${action === 'delete' ? 'deleted' : 'restored'} successfully`,
        entity: {
          id: entityId,
          name: entity.name,
          is_deleted: newDeletedState
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
