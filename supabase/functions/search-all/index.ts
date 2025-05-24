
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
    const type = requestData.type || "all"; // Can be "all", "products", "users", "entities", "local_only", etc.
    
    // Skip products API call during typing if type is local_only
    const fetchProducts = (type === "all" || type === "products") && type !== "local_only";
    const bypassCache = requestData.bypassCache === true; // Explicit true required to bypass cache
    
    console.log(`Search query received: "${query}", limit: ${limit}, type: ${type}, bypassCache: ${bypassCache}, fetchProducts: ${fetchProducts}`);
    
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
    const isLikelyProductQuery = (productRelatedTerms.some(term => query.toLowerCase().includes(term)) || fetchProducts) && type !== "local_only";

    // Set up parallel search promises
    const searchPromises = [];
    const results = {
      users: [],
      entities: [],
      reviews: [],
      recommendations: [],
      products: [],
      errors: null
    };

    // Search users
    if (type === "all" || type === "users" || type === "local_only") {
      searchPromises.push(
        supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .ilike('username', `%${query}%`)
          .limit(limit)
          .then(response => {
            if (response.error) {
              console.error("Users search error:", response.error);
              if (!results.errors) results.errors = [];
              results.errors.push(`Users: ${response.error.message}`);
            } else {
              results.users = response.data || [];
              console.log(`Users search: ${results.users.length} results`);
            }
          })
      );
    }
    
    // Search entities
    if (type === "all" || type === "entities" || type === "local_only") {
      searchPromises.push(
        supabase
          .from('entities')
          .select('id, name, type, venue, image_url, description, slug')
          .or(`name.ilike.%${query}%, venue.ilike.%${query}%, slug.ilike.%${query}%`)
          .eq('is_deleted', false)
          .limit(limit)
          .then(response => {
            if (response.error) {
              console.error("Entities search error:", response.error);
              if (!results.errors) results.errors = [];
              results.errors.push(`Entities: ${response.error.message}`);
            } else {
              results.entities = response.data || [];
              console.log(`Entities search: ${results.entities.length} results`);
            }
          })
      );
    }
    
    // Search reviews
    if (type === "all" || type === "reviews" || type === "local_only") {
      searchPromises.push(
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
          .limit(limit)
          .then(response => {
            if (response.error) {
              console.error("Reviews search error:", response.error);
              if (!results.errors) results.errors = [];
              results.errors.push(`Reviews: ${response.error.message}`);
            } else {
              results.reviews = response.data || [];
              console.log(`Reviews search: ${results.reviews.length} results`);
            }
          })
      );
    }
    
    // Search recommendations
    if (type === "all" || type === "recommendations" || type === "local_only") {
      searchPromises.push(
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
          .limit(limit)
          .then(response => {
            if (response.error) {
              console.error("Recommendations search error:", response.error);
              if (!results.errors) results.errors = [];
              results.errors.push(`Recommendations: ${response.error.message}`);
            } else {
              results.recommendations = response.data || [];
              console.log(`Recommendations search: ${results.recommendations.length} results`);
            }
          })
      );
    }

    // Check for products in local cache first before calling the external API
    // Only do this if type is not local_only
    if (isLikelyProductQuery && fetchProducts) {
      searchPromises.push(
        (async () => {
          if (!bypassCache) {
            try {
              // First check if we have a cached query
              const { data: queryData, error: queryError } = await supabase
                .from('cached_queries')
                .select('id')
                .eq('query', query)
                .single();
                
              if (queryError) {
                if (queryError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected if no cache exists
                  console.error("Error getting query ID:", queryError);
                }
              } else if (queryData?.id) {
                // Now check if cache is fresh
                const { data: isFreshData, error: isFreshError } = await supabase.rpc(
                  'is_query_fresh', 
                  { query_text: query }
                );
                
                if (isFreshError) {
                  console.error("Error checking cache freshness:", isFreshError);
                } else if (isFreshData === true) {
                  // Cache is fresh, get products from cache
                  console.log(`Found fresh cache for query: "${query}"`);
                  
                  const { data: cachedProducts, error: cacheError } = await supabase
                    .from('cached_products')
                    .select('*')
                    .eq('query_id', queryData.id)
                    .limit(limit);
                  
                  if (cacheError) {
                    console.error("Error getting products from cache:", cacheError);
                  } else if (cachedProducts && cachedProducts.length > 0) {
                    // Transform cached products to expected format
                    results.products = cachedProducts.map(product => ({
                      name: product.name,
                      venue: product.venue || "Unknown Retailer",
                      description: product.description,
                      image_url: product.image_url || "",
                      api_source: product.api_source,
                      api_ref: product.api_ref || "",
                      metadata: product.metadata
                    }));
                    
                    console.log(`Products from cache: ${results.products.length} results`);
                    return "cached";
                  }
                }
              }
            } catch (error) {
              console.error("Error checking product cache:", error);
            }
          }
            
          // If we're here, either cache isn't fresh, we didn't find cached results, or bypassCache is true
          // Only make an API call if we're specifically searching for products or if we have few local results
          if (fetchProducts) {
            console.log(`Making API call to search-products with query: "${query}"`);
            
            // Call search-products edge function for fresh data
            return supabase.functions
              .invoke('search-products', { 
                body: { query, bypassCache } 
              })
              .then((productsResponse) => {
                if (productsResponse.error) {
                  console.error("Products search error:", productsResponse.error);
                  if (!results.errors) results.errors = [];
                  results.errors.push(`Products: ${productsResponse.error.message}`);
                } else {
                  results.products = productsResponse.data?.results || [];
                  console.log(`Products search (${productsResponse.data?.source || 'unknown'}): ${results.products.length} results`);
                }
                return productsResponse.data?.source || "api";
              });
          } else {
            console.log("Skipping products search as requested (local_only mode)");
          }
          
          return "skipped";
        })()
      );
    } else {
      console.log("Skipping products search as it's not a product-related query or local_only mode is enabled");
    }
    
    // Wait for all searches to complete
    await Promise.all(searchPromises);
    
    // If errors array is empty, set it to null
    if (results.errors && results.errors.length === 0) {
      results.errors = null;
    } else if (results.errors) {
      console.error("Search errors:", results.errors);
    }

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
