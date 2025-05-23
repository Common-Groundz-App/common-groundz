
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
    const requestData = await req.json();
    const query = requestData.query;
    const limit = requestData.limit || 5;
    
    console.log(`Search query received: "${query}", limit: ${limit}`);
    
    if (!query || query.trim().length < 2) {
      console.log("Search query too short, returning empty results");
      return new Response(
        JSON.stringify({ 
          users: [], 
          entities: [], 
          reviews: [], 
          recommendations: [],
          products: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting parallel search across all data types...");

    // Determine if query might be product-related
    const productRelatedTerms = ['buy', 'product', 'price', 'best', 'cheap', 'expensive', 'review', 'compare'];
    const isLikelyProductQuery = productRelatedTerms.some(term => query.toLowerCase().includes(term));

    // Perform parallel searches across all data types
    const [usersResponse, entitiesResponse, reviewsResponse, recommendationsResponse, productsResponse] = await Promise.all([
      // Search users
      supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .ilike('username', `%${query}%`)
        .limit(limit),
      
      // Search entities
      supabase
        .from('entities')
        .select('id, name, type, venue, image_url, description, slug')
        .or(`name.ilike.%${query}%, venue.ilike.%${query}%, slug.ilike.%${query}%`)
        .eq('is_deleted', false)
        .limit(limit),
      
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
        .limit(limit),
      
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
        .limit(limit),
      
      // Search external products using the search-products function
      // Only call if query seems product-related or we have few local results
      isLikelyProductQuery ? 
        supabase.functions.invoke('search-products', {
          body: { query }
        }) : 
        Promise.resolve({ data: { results: [] }, error: null })
    ]);

    // Log search results
    console.log(`Users search: ${usersResponse.data?.length ?? 0} results`);
    console.log(`Entities search: ${entitiesResponse.data?.length ?? 0} results`);
    console.log(`Reviews search: ${reviewsResponse.data?.length ?? 0} results`);
    console.log(`Recommendations search: ${recommendationsResponse.data?.length ?? 0} results`);
    console.log(`Products search: ${productsResponse.data?.results?.length ?? 0} results`);

    // Handle any errors
    const errors = [];
    if (usersResponse.error) {
      console.error("Users search error:", usersResponse.error);
      errors.push(`Users: ${usersResponse.error.message}`);
    }
    if (entitiesResponse.error) {
      console.error("Entities search error:", entitiesResponse.error);
      errors.push(`Entities: ${entitiesResponse.error.message}`);
    }
    if (reviewsResponse.error) {
      console.error("Reviews search error:", reviewsResponse.error);
      errors.push(`Reviews: ${reviewsResponse.error.message}`);
    }
    if (recommendationsResponse.error) {
      console.error("Recommendations search error:", recommendationsResponse.error);
      errors.push(`Recommendations: ${recommendationsResponse.error.message}`);
    }
    if (productsResponse.error) {
      console.error("Products search error:", productsResponse.error);
      errors.push(`Products: ${productsResponse.error.message}`);
    }
    
    if (errors.length > 0) {
      console.error("Search errors:", errors);
    }

    // Compile results
    const results = {
      users: usersResponse.data || [],
      entities: entitiesResponse.data || [],
      reviews: reviewsResponse.data || [],
      recommendations: recommendationsResponse.data || [],
      products: productsResponse.data?.results || [],
      errors: errors.length > 0 ? errors : null
    };

    console.log("Search completed successfully");

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
