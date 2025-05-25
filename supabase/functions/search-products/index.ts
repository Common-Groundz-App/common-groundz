
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ensureHttps, isValidUrl } from "./utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductResult {
  name: string;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce';
  }>;
  insights: {
    pros: string[];
    cons: string[];
    price_range: string;
    overall_rating: string;
    key_features: string[];
  };
  api_source: string;
  api_ref: string;
}

serve(async (req) => {
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

    if (query.trim().length < 2) {
      console.log("Query too short, returning empty results");
      return new Response(
        JSON.stringify({ results: [], source: "validation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);

    let results: ProductResult[] = [];
    let sourceOfResults = "api";

    // Check cache first if not explicitly bypassing
    if (!bypassCache) {
      console.log(`Checking cache for query: "${query}"`);
      
      try {
        const { data: isFreshData, error: isFreshError } = await supabaseAnonClient.rpc(
          "is_query_fresh", 
          { query_text: query }
        );
        
        if (isFreshError) {
          console.error("Error checking cache freshness:", isFreshError);
        } else if (isFreshData === true) {
          console.log(`Found fresh cache for query: "${query}"`);
          
          const { data: queryData, error: queryError } = await supabaseAnonClient
            .from("cached_queries")
            .select("id")
            .eq("query", query)
            .single();
          
          if (queryError) {
            console.error("Error getting query ID:", queryError);
          } else if (queryData && queryData.id) {
            const { data: cachedProducts, error: cacheError } = await supabaseAnonClient
              .from("cached_products")
              .select("*")
              .eq("query_id", queryData.id);
              
            if (cacheError) {
              console.error("Error getting products from cache:", cacheError);
            } else if (cachedProducts && cachedProducts.length > 0) {
              results = cachedProducts.map(product => ({
                name: product.name,
                summary: product.description || "",
                sources: product.metadata.sources || [],
                insights: product.metadata.insights || {},
                api_source: product.api_source,
                api_ref: product.api_ref || "",
              }));
              
              console.log(`SUCCESS: Returning ${results.length} cached products for query "${query}"`);
              sourceOfResults = "cache";
              
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
      }
    }

    // Get API keys
    const serpApiKey = Deno.env.get("SERP_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!serpApiKey) {
      console.error("SERP_API_KEY is not set");
      return new Response(
        JSON.stringify({ 
          error: "SERP API key not configured",
          results: [],
          source: "error",
          query: query,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY is not set");
      return new Response(
        JSON.stringify({ 
          error: "OpenAI API key not configured",
          results: [],
          source: "error",
          query: query,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call SerpApi Google Search (not Google Shopping)
    const searchUrl = new URL("https://serpapi.com/search");
    searchUrl.searchParams.append("api_key", serpApiKey);
    searchUrl.searchParams.append("engine", "google"); // Changed from google_shopping
    searchUrl.searchParams.append("q", query + " review price buy"); // Enhanced query
    searchUrl.searchParams.append("gl", "in");
    searchUrl.searchParams.append("hl", "en");
    searchUrl.searchParams.append("num", "20"); // Get more results

    console.log(`🔍 EXTERNAL API CALL: Fetching fresh results from SerpAPI for query: "${query}"`);
    
    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`📊 SerpAPI response structure for query "${query}":`, {
      keys: Object.keys(data),
      hasOrganicResults: Array.isArray(data.organic_results),
      organicResultsCount: data.organic_results?.length || 0,
    });
    
    // Extract and organize search results
    const organicResults = data.organic_results || [];
    if (organicResults.length === 0) {
      console.log("No organic results found");
      return new Response(
        JSON.stringify({ 
          results: [],
          source: "api",
          query: query,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process organic results and categorize them
    const processedSources = organicResults.slice(0, 15).map((result: any, index: number) => {
      const domain = new URL(result.link || '').hostname;
      let type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce' = 'blog';
      
      if (domain.includes('reddit.com') || domain.includes('quora.com')) {
        type = 'forum';
      } else if (domain.includes('amazon.') || domain.includes('flipkart.') || domain.includes('myntra.') || domain.includes('shop')) {
        type = 'ecommerce';
      } else if (domain.includes('review') || result.title?.toLowerCase().includes('review')) {
        type = 'review';
      } else if (result.snippet?.toLowerCase().includes('official') || domain.includes('official')) {
        type = 'official';
      }

      return {
        title: result.title || `Result ${index + 1}`,
        url: ensureHttps(result.link || "") || "",
        snippet: result.snippet || "",
        type: type
      };
    }).filter(source => source.url && source.title);

    // Use OpenAI to process and organize the search results
    console.log(`🤖 Processing ${processedSources.length} sources with OpenAI`);
    
    const llmPrompt = `
You are an expert product analyst. Analyze the following search results for "${query}" and provide a comprehensive product analysis.

Search Results:
${processedSources.map((source, i) => `
${i + 1}. Title: ${source.title}
   URL: ${source.url}
   Snippet: ${source.snippet}
   Source Type: ${source.type}
`).join('\n')}

Please provide a JSON response with the following structure:
{
  "name": "Main product name",
  "summary": "2-3 sentence overview of the product",
  "insights": {
    "pros": ["positive point 1", "positive point 2", "positive point 3"],
    "cons": ["negative point 1", "negative point 2"],
    "price_range": "estimated price range in INR",
    "overall_rating": "overall rating or sentiment",
    "key_features": ["feature 1", "feature 2", "feature 3"]
  }
}

Focus on extracting actual insights from the provided sources. Be factual and concise.`;

    try {
      const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful product analysis assistant. Always respond with valid JSON.' },
            { role: 'user', content: llmPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!llmResponse.ok) {
        throw new Error(`OpenAI API request failed: ${llmResponse.status}`);
      }

      const llmData = await llmResponse.json();
      const llmContent = llmData.choices[0].message.content;
      
      let productAnalysis;
      try {
        productAnalysis = JSON.parse(llmContent);
      } catch (parseError) {
        console.error("Failed to parse LLM response as JSON:", parseError);
        // Fallback analysis
        productAnalysis = {
          name: query,
          summary: "Product information extracted from multiple sources.",
          insights: {
            pros: ["Multiple sources available"],
            cons: ["Analysis in progress"],
            price_range: "Price information being analyzed",
            overall_rating: "Mixed reviews",
            key_features: ["Various features mentioned"]
          }
        };
      }

      // Create the final result
      const productResult: ProductResult = {
        name: productAnalysis.name || query,
        summary: productAnalysis.summary || "Product information extracted from search results.",
        sources: processedSources,
        insights: productAnalysis.insights || {
          pros: [],
          cons: [],
          price_range: "Not available",
          overall_rating: "Not available",
          key_features: []
        },
        api_source: "google_search_llm",
        api_ref: `search_${Date.now()}`
      };

      results = [productResult];

      console.log(`✅ LLM processing completed successfully`);

    } catch (llmError) {
      console.error("Error processing with LLM:", llmError);
      
      // Fallback: return basic processed results without LLM analysis
      const fallbackResult: ProductResult = {
        name: query,
        summary: `Search results for ${query} from multiple sources including reviews, forums, and e-commerce sites.`,
        sources: processedSources,
        insights: {
          pros: ["Multiple sources found"],
          cons: ["Detailed analysis unavailable"],
          price_range: "Check individual sources",
          overall_rating: "Varied reviews",
          key_features: ["See individual sources for details"]
        },
        api_source: "google_search_basic",
        api_ref: `search_${Date.now()}`
      };
      
      results = [fallbackResult];
    }

    // Update cache with new results
    try {
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
        
        await supabaseServiceClient
          .from("cached_products")
          .delete()
          .eq("query_id", queryId);
        
        if (results.length > 0) {
          const productsToCache = results.map(product => ({
            query_id: queryId,
            name: product.name,
            venue: "Multiple Sources",
            description: product.summary,
            image_url: "",
            api_source: product.api_source,
            api_ref: product.api_ref,
            metadata: {
              sources: product.sources,
              insights: product.insights
            }
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

    const finalResponse = {
      results: results,
      source: "api",
      query: query,
      count: results.length
    };

    console.log(`✅ SUCCESS: Returning ${results.length} processed results for query "${query}"`);

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
