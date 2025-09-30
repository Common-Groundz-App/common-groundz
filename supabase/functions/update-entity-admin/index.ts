import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { entityId, updateData, appliedFields } = await req.json()

    console.log('Admin updating entity:', entityId, 'with data:', updateData)

    // Update entity with service role permissions (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('entities')
      .update(updateData)
      .eq('id', entityId)
      .select()

    if (error) {
      console.error('Database error in admin update:', error)
      throw error
    }

    console.log('Successfully updated entity via admin function. Fields updated:', appliedFields)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        appliedFields 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in update-entity-admin function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})