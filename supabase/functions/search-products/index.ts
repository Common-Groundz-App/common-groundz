import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ensureHttps, isValidUrl } from "./utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductResult {
  name: string;
  venue: string;
  description: string | null;
  image_url: string;
  api_source: string;
  api_ref: string;
  metadata: {
    price?: string;
    rating?: number;
    seller?: string;
    purchase_url: string;
    [key: string]: any;
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestData = await req.json();
    const query = requestData.query;
    const bypassCache = requestData.bypassCache === true;
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Minimum query length check
    if (query.trim().length < 2) {
      console.log("Query too short, returning empty results");
      return new Response(
        JSON.stringify({ results: [], source: "validation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create a client with anonymous key for reading
    const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create a client with service role key for writing to the cache
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);

    let results: ProductResult[] = [];
    let sourceOfResults = "api"; // default source

    // Check cache first if not explicitly bypassing
    if (!bypassCache) {
      console.log(`Checking cache for query: "${query}"`);
      
      try {
        // Check if we have a fresh cache for this query
        const { data: isFreshData, error: isFreshError } = await supabaseAnonClient.rpc(
          "is_query_fresh", 
          { query_text: query }
        );
        
        if (isFreshError) {
          console.error("Error checking cache freshness:", isFreshError);
        } else if (isFreshData === true) {
          // Cache is fresh, get products from cache
          console.log(`Found fresh cache for query: "${query}"`);
          
          // First get the query ID
          const { data: queryData, error: queryError } = await supabaseAnonClient
            .from("cached_queries")
            .select("id")
            .eq("query", query)
            .single();
          
          if (queryError) {
            console.error("Error getting query ID:", queryError);
          } else if (queryData && queryData.id) {
            // Then get the cached products for this query
            const { data: cachedProducts, error: cacheError } = await supabaseAnonClient
              .from("cached_products")
              .select("*")
              .eq("query_id", queryData.id);
              
            if (cacheError) {
              console.error("Error getting products from cache:", cacheError);
            } else if (cachedProducts && cachedProducts.length > 0) {
              // Transform cached products to expected format and ensure HTTPS URLs
              results = cachedProducts.map(product => ({
                name: product.name,
                venue: product.venue || "Unknown Retailer",
                description: product.description,
                image_url: ensureHttps(product.image_url) || "",
                api_source: product.api_source,
                api_ref: product.api_ref || "",
                metadata: {
                  ...product.metadata,
                  purchase_url: ensureHttps(product.metadata.purchase_url)
                }
              }));
              
              console.log(`SUCCESS: Returning ${results.length} cached products for query "${query}"`);
              sourceOfResults = "cache";
              
              // Return cached results with proper structure
              return new Response(
                JSON.stringify({ 
                  results: results,
                  source: "cache",
                  query: query,
                  count: results.length 
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (cacheError) {
        console.error("Error in cache checking process:", cacheError);
        // Continue to API search on cache error
      }
    }

    // Get the SerpApi key from environment
    const serpApiKey = Deno.env.get("SERP_API_KEY");
    if (!serpApiKey) {
      console.error("SERP_API_KEY is not set");
      return new Response(
        JSON.stringify({ 
          error: "SERP API key not configured",
          results: getMockResults(query),
          source: "mock",
          query: query,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call SerpApi Google Shopping search - ENSURE WE USE HTTPS!
    const searchUrl = new URL("https://serpapi.com/search");
    searchUrl.searchParams.append("api_key", serpApiKey);
    searchUrl.searchParams.append("engine", "google_shopping");
    searchUrl.searchParams.append("q", query);
    searchUrl.searchParams.append("gl", "in"); // India results
    searchUrl.searchParams.append("hl", "en"); // English language

    console.log(`🔍 EXTERNAL API CALL: Fetching fresh results from SerpAPI for query: "${query}"`);
    
    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Enhanced debugging for response structure
    console.log(`📊 SerpAPI response structure for query "${query}":`, {
      keys: Object.keys(data),
      hasShoppingResults: Array.isArray(data.shopping_results),
      shoppingResultsCount: data.shopping_results?.length || 0,
      hasOrganicResults: Array.isArray(data.organic_results),
      organicResultsCount: data.organic_results?.length || 0,
      searchInformation: data.search_information
    });
    
    results = parseProductResults(data);
    console.log(`🎯 Parsed ${results.length} products from API response`);

    // Validate results array before proceeding
    if (!Array.isArray(results)) {
      console.error("⚠️ parseProductResults did not return an array:", typeof results);
      results = [];
    }

    // Update cache with new results
    try {
      // First, add/update the query in cached_queries
      const { data: queryData, error: queryError } = await supabaseServiceClient
        .from("cached_queries")
        .upsert(
          { 
            query: query, 
            last_fetched: new Date().toISOString() 
          },
          { 
            onConflict: "query", 
            returning: "id" 
          }
        );
      
      if (queryError) {
        console.error("Error updating query cache:", queryError);
      } else if (queryData && queryData.length > 0) {
        const queryId = queryData[0].id;
        
        // Delete existing cached products for this query
        await supabaseServiceClient
          .from("cached_products")
          .delete()
          .eq("query_id", queryId);
        
        // Insert new cached products
        if (results.length > 0) {
          const productsToCache = results.map(product => ({
            query_id: queryId,
            name: product.name,
            venue: product.venue,
            description: product.description,
            image_url: product.image_url,
            api_source: product.api_source,
            api_ref: product.api_ref,
            metadata: product.metadata
          }));
          
          const { error: insertError } = await supabaseServiceClient
            .from("cached_products")
            .insert(productsToCache);
          
          if (insertError) {
            console.error("Error inserting product cache:", insertError);
          } else {
            console.log(`💾 Successfully cached ${productsToCache.length} products for query "${query}"`);
          }
        }
      }
    } catch (cacheError) {
      console.error("Error updating cache:", cacheError);
    }

    // Return results with enhanced structure for debugging
    const finalResponse = {
      results: results,
      source: "api",
      query: query,
      count: results.length,
      debug: {
        apiResponseKeys: Object.keys(data),
        shoppingResultsFound: data.shopping_results?.length || 0,
        organicResultsFound: data.organic_results?.length || 0
      }
    };

    console.log(`✅ SUCCESS: Returning ${results.length} fresh API results for query "${query}"`);
    console.log(`📤 Final response structure:`, {
      resultsIsArray: Array.isArray(finalResponse.results),
      resultsLength: finalResponse.results.length,
      source: finalResponse.source
    });

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in search-products:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        results: [],
        source: "error",
        count: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseProductResults(data: any): ProductResult[] {
  // Enhanced debugging to see what data we're working with
  console.log("🔄 Parsing product results from response with keys:", Object.keys(data));
  
  // Try multiple potential result arrays from SerpAPI response
  const possibleResultArrays = [
    { key: 'shopping_results', data: data.shopping_results },
    { key: 'organic_results', data: data.organic_results },
    { key: 'product_results', data: data.product_results },
    { key: 'inline_shopping_results', data: data.inline_shopping_results }
  ];
  
  // Find first valid array of results
  let resultsArray = null;
  let sourceKey = null;
  
  for (const arrayOption of possibleResultArrays) {
    if (Array.isArray(arrayOption.data) && arrayOption.data.length > 0) {
      console.log(`✅ Found valid results array '${arrayOption.key}' with ${arrayOption.data.length} items`);
      resultsArray = arrayOption.data;
      sourceKey = arrayOption.key;
      break;
    } else if (arrayOption.data) {
      console.log(`⚠️ Found '${arrayOption.key}' but it's not a valid array:`, typeof arrayOption.data);
    }
  }
  
  if (!resultsArray) {
    console.warn("❌ No valid product arrays found in SerpAPI response!");
    console.log("Available response structure:", {
      keys: Object.keys(data),
      searchInfo: data.search_information,
      responseSnippet: JSON.stringify(data).substring(0, 500) + "..."
    });
    
    return []; // Return empty array instead of undefined
  }

  console.log(`🔄 Processing ${resultsArray.length} items from '${sourceKey}'`);

  const processedResults = resultsArray.slice(0, 10).map((item: any, index: number) => {
    // Ensure we have a valid item
    if (!item) {
      console.warn(`⚠️ Skipping null/undefined item at index ${index}`);
      return null;
    }
    
    // For debugging - log each item's structure
    console.log(`Processing item ${index + 1} with keys: ${Object.keys(item).join(", ")}`);
    
    // Extract and format the data with fallbacks
    const productResult: ProductResult = {
      name: item.title || item.name || `Product ${index + 1}`,
      venue: item.source || item.seller || item.shop || "Unknown Retailer",
      description: item.snippet || item.description || null,
      image_url: ensureHttps(item.thumbnail || item.image || "") || "",
      api_source: "serpapi_shopping",
      api_ref: item.product_id || item.position?.toString() || `item_${index}`,
      metadata: {
        price: item.price || "Price not available",
        rating: item.rating ? parseFloat(item.rating) : null,
        seller: item.source || item.seller || item.shop || "Unknown Retailer",
        purchase_url: ensureHttps(item.link || item.product_link || "") || "",
        extracted_price: item.extracted_price || null,
        shipping: item.shipping || null,
        sale_price: item.price_when_on_sale || null,
        old_price: item.old_price || null
      }
    };
    
    // Extra validation to ensure all URLs are HTTPS and valid
    if (productResult.image_url && !isValidUrl(productResult.image_url)) {
      console.warn(`⚠️ Invalid image URL detected: ${productResult.image_url}`);
      productResult.image_url = ""; // Reset to empty if invalid
    }
    
    if (productResult.metadata.purchase_url && !isValidUrl(productResult.metadata.purchase_url)) {
      console.warn(`⚠️ Invalid purchase URL detected: ${productResult.metadata.purchase_url}`);
      productResult.metadata.purchase_url = ""; // Reset to empty if invalid
    }
    
    return productResult;
  }).filter(Boolean); // Remove any null items

  console.log(`✅ Successfully processed ${processedResults.length} valid products`);
  return processedResults;
}

// Fallback function for mock results when API key isn't available
function getMockResults(query: string): ProductResult[] {
  // Simple mock product results
  const mockProducts = [
    {
      name: "Apple iPhone 15",
      venue: "Apple Store",
      description: "The latest Apple iPhone with advanced camera and display.",
      image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
      api_source: "mock_products",
      api_ref: "apple-iphone-15",
      metadata: { 
        price: "₹79,900",
        rating: 4.7,
        seller: "Apple Store",
        purchase_url: "https://www.apple.com/in/iphone-15/" 
      }
    },
    {
      name: "Sony WH-1000XM5 Headphones",
      venue: "Best Buy",
      description: "Industry leading noise-cancelling wireless headphones.",
      image_url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80",
      api_source: "mock_products",
      api_ref: "sony-wh1000xm5",
      metadata: { 
        price: "₹26,990",
        rating: 4.8,
        seller: "Best Buy",
        purchase_url: "https://www.bestbuy.com/sony-wh1000xm5" 
      }
    }
  ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

  return mockProducts;
}
