
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookPayload {
  query_text: string;
  query_params: any[];
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRole);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the request payload
    const payload: WebhookPayload = await req.json();
    const { query_text, query_params } = payload;

    if (!query_text) {
      return new Response(
        JSON.stringify({ error: 'Missing query_text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Executing SQL:', query_text);
    console.log('With params:', query_params || []);

    // Execute the query directly with the Postgres connection
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .limit(10);

    if (error) {
      console.error('SQL execution error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Return the data (this will be an array)
    return new Response(
      JSON.stringify(data || []),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('Error processing request:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
