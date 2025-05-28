
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
    const { query, limit = 5, type = "all", mode = "quick" } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({
          users: [],
          entities: [],
          reviews: [],
          recommendations: [],
          products: [],
          mode: mode
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Unified search for: "${query}" (type: ${type}, mode: ${mode})`);

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

    // In quick mode, search lightweight external APIs in parallel
    if (mode === "quick") {
      console.log(`🏎️ Quick search mode: Searching lightweight external APIs for: "${query}"`);
      
      try {
        // Call external APIs in parallel for quick results
        const [moviesResponse, booksResponse, placesResponse] = await Promise.allSettled([
          supabase.functions.invoke('search-movies', { body: { query } }),
          supabase.functions.invoke('search-books', { body: { query } }),
          supabase.functions.invoke('search-places', { body: { query } })
        ]);

        // Process movie results
        if (moviesResponse.status === 'fulfilled' && moviesResponse.value?.data?.results) {
          const movieResults = moviesResponse.value.data.results.slice(0, limit).map((movie: any) => ({
            ...movie,
            type: 'movie'
          }));
          products.push(...movieResults);
          console.log(`🎬 Found ${movieResults.length} movie results`);
        } else if (moviesResponse.status === 'rejected') {
          console.error('Movies search failed:', moviesResponse.reason);
        }

        // Process book results
        if (booksResponse.status === 'fulfilled' && booksResponse.value?.data?.results) {
          const bookResults = booksResponse.value.data.results.slice(0, limit).map((book: any) => ({
            ...book,
            type: 'book'
          }));
          products.push(...bookResults);
          console.log(`📚 Found ${bookResults.length} book results`);
        } else if (booksResponse.status === 'rejected') {
          console.error('Books search failed:', booksResponse.reason);
        }

        // Process place results
        if (placesResponse.status === 'fulfilled' && placesResponse.value?.data?.results) {
          const placeResults = placesResponse.value.data.results.slice(0, limit).map((place: any) => ({
            ...place,
            type: 'place'
          }));
          products.push(...placeResults);
          console.log(`📍 Found ${placeResults.length} place results`);
        } else if (placesResponse.status === 'rejected') {
          console.error('Places search failed:', placesResponse.reason);
        }

        // Limit total external results
        products = products.slice(0, limit * 2);
        console.log(`✅ Quick search found ${products.length} total external results`);

      } catch (error) {
        console.error('Error calling external APIs in quick mode:', error);
        errors = [`External API search failed: ${error.message}`];
      }
    }

    // Only search comprehensive products if mode is "deep"
    if (mode === "deep") {
      try {
        console.log(`🔍 Deep search mode: Searching comprehensive products for: "${query}"`);
        
        // Call the search-products function to get comprehensive results
        const { data: productData, error: productError } = await supabase.functions.invoke('search-products', {
          body: { query }
        });

        if (productError) {
          console.error('Comprehensive product search error:', productError);
          errors = [`Comprehensive product search failed: ${productError.message}`];
        } else if (productData?.results) {
          // Transform product results to match expected format
          const comprehensiveProducts = productData.results.map((product: any) => ({
            name: product.product_name,
            venue: product.brand || 'Unknown Brand',
            description: product.summary,
            image_url: product.image_url,
            api_source: product.api_source,
            api_ref: product.api_ref,
            type: 'product',
            metadata: {
              price: product.insights?.price_range,
              rating: product.insights?.overall_rating,
              purchase_url: product.sources?.[0]?.url,
              mention_frequency: product.mention_frequency,
              quality_score: product.quality_score,
              ...product.insights
            }
          })).slice(0, limit);
          
          products.push(...comprehensiveProducts);
          console.log(`✅ Found ${comprehensiveProducts.length} comprehensive products from deep search`);
        }
      } catch (error) {
        console.error('Error calling search-products:', error);
        errors = [`Comprehensive product search failed: ${error.message}`];
      }
    }

    const results = {
      users: users || [],
      entities: entities || [],
      reviews: reviews || [],
      recommendations: recommendations || [],
      products: products,
      errors: errors,
      mode: mode
    };

    console.log(`✅ Unified search results (${mode} mode):`, {
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
