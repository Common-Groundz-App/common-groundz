
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Parse request to get parameters
    const { query, limit } = await req.json();
    const searchLimit = limit || 5;
    
    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ 
          users: [], 
          entities: [], 
          reviews: [], 
          recommendations: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform parallel searches across all data types
    const [usersResponse, entitiesResponse, reviewsResponse, recommendationsResponse] = await Promise.all([
      // Search users
      supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .ilike('username', `%${query}%`)
        .limit(searchLimit),
      
      // Search entities
      supabase
        .from('entities')
        .select('id, name, type, venue, image_url, description, slug')
        .or(`name.ilike.%${query}%, venue.ilike.%${query}%, slug.ilike.%${query}%`)
        .eq('is_deleted', false)
        .limit(searchLimit),
      
      // Search reviews
      supabase
        .from('reviews')
        .select(`
          id, 
          title, 
          subtitle, 
          category, 
          description, 
          rating, 
          entity_id,
          entities(id, name, slug, type, venue)
        `)
        .or(`title.ilike.%${query}%, description.ilike.%${query}%, subtitle.ilike.%${query}%`)
        .eq('status', 'published')
        .eq('visibility', 'public')
        .limit(searchLimit),
      
      // Search recommendations
      supabase
        .from('recommendations')
        .select(`
          id, 
          title, 
          description, 
          category, 
          rating, 
          entity_id,
          entities(id, name, slug, type, venue)
        `)
        .or(`title.ilike.%${query}%, description.ilike.%${query}%`)
        .eq('visibility', 'public')
        .limit(searchLimit),
    ]);

    // Handle any errors
    const errors = [];
    if (usersResponse.error) errors.push(`Users: ${usersResponse.error.message}`);
    if (entitiesResponse.error) errors.push(`Entities: ${entitiesResponse.error.message}`);
    if (reviewsResponse.error) errors.push(`Reviews: ${reviewsResponse.error.message}`);
    if (recommendationsResponse.error) errors.push(`Recommendations: ${recommendationsResponse.error.message}`);
    
    if (errors.length > 0) {
      console.error("Search errors:", errors);
    }

    // Compile results
    const results = {
      users: usersResponse.data || [],
      entities: entitiesResponse.data || [],
      reviews: reviewsResponse.data || [],
      recommendations: recommendationsResponse.data || [],
      errors: errors.length > 0 ? errors : null
    };

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-all function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
