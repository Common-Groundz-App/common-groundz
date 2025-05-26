
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 5, type = "all" } = await req.json();

    if (!query || query.trim().length < 2) {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Unified search for: "${query}" (type: ${type})`);

    // Search users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio')
      .ilike('username', `%${query}%`)
      .limit(limit);

    if (usersError) console.error('Users search error:', usersError);

    // Search entities
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('id, name, type, venue, image_url, description, slug')
      .eq('is_deleted', false)
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (entitiesError) console.error('Entities search error:', entitiesError);

    // Search reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id, title, subtitle, category, description, rating, entity_id,
        entities:entity_id (id, name, slug, type, venue)
      `)
      .eq('status', 'published')
      .ilike('title', `%${query}%`)
      .limit(limit);

    if (reviewsError) console.error('Reviews search error:', reviewsError);

    // Search recommendations
    const { data: recommendations, error: recommendationsError } = await supabase
      .from('recommendations')
      .select(`
        id, title, description, category, rating, entity_id,
        entities:entity_id (id, name, slug, type, venue)
      `)
      .eq('visibility', 'public')
      .ilike('title', `%${query}%`)
      .limit(limit);

    if (recommendationsError) console.error('Recommendations search error:', recommendationsError);

    let products = [];
    let errors = null;

    // Only search external products if type is "all" (not "local_only")
    if (type === "all") {
      try {
        console.log(`🔍 Searching external products for: "${query}"`);
        
        // Call the search-products function to get external results
        const { data: productData, error: productError } = await supabase.functions.invoke('search-products', {
          body: { query }
        });

        if (productError) {
          console.error('Product search error:', productError);
          errors = [`Product search failed: ${productError.message}`];
        } else if (productData?.results) {
          // Transform product results to match expected format
          products = productData.results.map((product: any) => ({
            name: product.product_name,
            venue: product.brand || 'Unknown Brand',
            description: product.summary,
            image_url: product.image_url,
            api_source: product.api_source,
            api_ref: product.api_ref,
            metadata: {
              price: product.insights?.price_range,
              rating: product.insights?.overall_rating,
              purchase_url: product.sources?.[0]?.url,
              mention_frequency: product.mention_frequency,
              quality_score: product.quality_score,
              ...product.insights
            }
          })).slice(0, limit);
          
          console.log(`✅ Found ${products.length} external products`);
        }
      } catch (error) {
        console.error('Error calling search-products:', error);
        errors = [`External product search failed: ${error.message}`];
      }
    }

    const results = {
      users: users || [],
      entities: entities || [],
      reviews: reviews || [],
      recommendations: recommendations || [],
      products: products,
      errors: errors
    };

    console.log(`✅ Unified search results:`, {
      users: results.users.length,
      entities: results.entities.length,
      reviews: results.reviews.length,
      recommendations: results.recommendations.length,
      products: results.products.length
    });

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-all:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        users: [],
        entities: [],
        reviews: [],
        recommendations: [],
        products: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
