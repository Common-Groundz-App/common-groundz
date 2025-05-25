import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ensureHttps, isValidUrl } from "./utils.ts";
import { extractProductMentions, analyzeProductFrequency, ProductExtractionResult } from "./product-extractor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductResult {
  product_name: string;
  brand: string;
  summary: string;
  image_url?: string;
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
    recommended_by: string[];
  };
  mention_frequency: number;
  quality_score: number;
  api_source: string;
  api_ref: string;
}

interface SearchResponse {
  results: ProductResult[];
  query: string;
  total_sources_analyzed: number;
  processing_method: string;
  source: string;
  count: number;
}

// Gemini API integration
async function processWithGemini(query: string, sources: any[], geminiApiKey: string): Promise<any> {
  const prompt = `
You are an expert product analyst. Analyze the following search results for "${query}" and provide a comprehensive product analysis.

Search Results:
${sources.map((source, i) => `
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

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  
  // Clean up the response to extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in Gemini response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

// OpenAI API integration (fallback)
async function processWithOpenAI(query: string, sources: any[], openaiApiKey: string): Promise<any> {
  const llmPrompt = `
You are an expert product analyst. Analyze the following search results for "${query}" and provide a comprehensive product analysis.

Search Results:
${sources.map((source, i) => `
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return JSON.parse(content);
}

// Enhanced LLM processing with fallback chain
async function processWithLLMs(query: string, sources: any[]): Promise<{ analysis: any, llmUsed: string }> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  
  // Try Gemini first (primary)
  if (geminiApiKey) {
    try {
      console.log(`🤖 Trying Gemini API for query: "${query}"`);
      const analysis = await processWithGemini(query, sources, geminiApiKey);
      console.log(`✅ Gemini processing completed successfully`);
      return { analysis, llmUsed: 'gemini' };
    } catch (geminiError) {
      console.error("❌ Gemini processing failed:", geminiError);
    }
  }
  
  // Fallback to OpenAI
  if (openaiApiKey) {
    try {
      console.log(`🤖 Falling back to OpenAI API for query: "${query}"`);
      const analysis = await processWithOpenAI(query, sources, openaiApiKey);
      console.log(`✅ OpenAI processing completed successfully`);
      return { analysis, llmUsed: 'openai' };
    } catch (openaiError) {
      console.error("❌ OpenAI processing failed:", openaiError);
    }
  }
  
  // Final fallback - basic processing without LLM
  console.log(`⚠️ Both LLMs failed, using basic fallback processing`);
  const fallbackAnalysis = {
    name: query,
    summary: `Search results for ${query} from multiple sources including reviews, forums, and e-commerce sites.`,
    insights: {
      pros: ["Multiple sources found"],
      cons: ["Detailed analysis unavailable"],
      price_range: "Check individual sources",
      overall_rating: "Varied reviews",
      key_features: ["See individual sources for details"]
    }
  };
  
  return { analysis: fallbackAnalysis, llmUsed: 'fallback' };
}

// Enhanced LLM processing for individual products
async function processProductWithLLMs(
  productName: string,
  brand: string,
  contexts: Array<{ text: string; source_title: string; source_url: string }>,
  mentionFrequency: number,
  qualityScore: number
): Promise<{ analysis: any, llmUsed: string }> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  
  const contextText = contexts.map((ctx, i) => `
${i + 1}. Source: ${ctx.source_title}
   URL: ${ctx.source_url}
   Context: ${ctx.text}
`).join('\n');

  const prompt = `
You are an expert product analyst. Analyze the following mentions of "${productName}" by ${brand} and provide a comprehensive product analysis.

Product: ${productName}
Brand: ${brand}
Mention Frequency: ${mentionFrequency} times across sources
Quality Score: ${qualityScore.toFixed(2)}

Contexts and Sources:
${contextText}

Please provide a JSON response with the following structure:
{
  "summary": "2-3 sentence overview of this specific product based on the sources",
  "insights": {
    "pros": ["specific positive point 1", "specific positive point 2", "specific positive point 3"],
    "cons": ["specific negative point 1", "specific negative point 2"],
    "price_range": "estimated price range in INR if mentioned, otherwise 'Price varies'",
    "overall_rating": "overall sentiment from sources",
    "key_features": ["key feature 1", "key feature 2", "key feature 3"],
    "recommended_by": ["who specifically recommends this product based on sources"]
  }
}

Focus on extracting actual insights about THIS SPECIFIC PRODUCT from the provided sources. Be factual and concise.`;

  // Try Gemini first
  if (geminiApiKey) {
    try {
      console.log(`🤖 Processing ${productName} with Gemini API`);
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { analysis: JSON.parse(jsonMatch[0]), llmUsed: 'gemini' };
        }
      }
    } catch (error) {
      console.error(`❌ Gemini processing failed for ${productName}:`, error);
    }
  }
  
  // Fallback to OpenAI
  if (openaiApiKey) {
    try {
      console.log(`🤖 Processing ${productName} with OpenAI API`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful product analysis assistant. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        return { analysis: JSON.parse(content), llmUsed: 'openai' };
      }
    } catch (error) {
      console.error(`❌ OpenAI processing failed for ${productName}:`, error);
    }
  }
  
  // Final fallback
  console.log(`⚠️ Using fallback processing for ${productName}`);
  return {
    analysis: {
      summary: `${productName} by ${brand} mentioned ${mentionFrequency} times across sources.`,
      insights: {
        pros: ["Found in multiple sources"],
        cons: ["Detailed analysis unavailable"],
        price_range: "Price varies",
        overall_rating: "Mixed reviews",
        key_features: ["See individual sources for details"],
        recommended_by: ["Various sources"]
      }
    },
    llmUsed: 'fallback'
  };
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
                product_name: product.name,
                brand: product.metadata.brand || "",
                summary: product.description || "",
                image_url: product.image_url || undefined,
                sources: product.metadata.sources || [],
                insights: product.metadata.insights || {
                  pros: [],
                  cons: [],
                  price_range: "Not available",
                  overall_rating: "Not available",
                  key_features: [],
                  recommended_by: []
                },
                mention_frequency: product.metadata.mention_frequency || 0,
                quality_score: product.metadata.quality_score || 0,
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
                  count: results.length,
                  total_sources_analyzed: 0,
                  processing_method: "cached"
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

    // Call SerpApi Google Search (not Google Shopping)
    const searchUrl = new URL("https://serpapi.com/search");
    searchUrl.searchParams.append("api_key", serpApiKey);
    searchUrl.searchParams.append("engine", "google");
    searchUrl.searchParams.append("q", query + " review price buy");
    searchUrl.searchParams.append("gl", "in");
    searchUrl.searchParams.append("hl", "en");
    searchUrl.searchParams.append("num", "20");

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
    
    const organicResults = data.organic_results || [];
    if (organicResults.length === 0) {
      console.log("No organic results found");
      return new Response(
        JSON.stringify({ 
          results: [],
          source: "api",
          query: query,
          count: 0,
          total_sources_analyzed: 0,
          processing_method: "no_results"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process organic results and categorize them
    const processedSources = organicResults.slice(0, 10).map((result: any, index: number) => {
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

    console.log(`🔍 Phase 1: Starting product extraction from ${processedSources.length} sources`);
    
    // PHASE 1: Extract product mentions and analyze frequency
    const productMentions = await extractProductMentions(processedSources);
    const rankedProducts = analyzeProductFrequency(productMentions);
    
    console.log(`📊 Found ${rankedProducts.length} top products:`, rankedProducts.map(p => p.product_name));
    
    if (rankedProducts.length === 0) {
      console.log("No products found after extraction");
      return new Response(
        JSON.stringify({ 
          results: [],
          source: "api",
          query: query,
          count: 0,
          total_sources_analyzed: processedSources.length,
          processing_method: "no_products_found"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each ranked product with LLM
    const productResults: ProductResult[] = [];
    let processingMethod = 'fallback';
    
    for (const rankedProduct of rankedProducts) {
      try {
        console.log(`🤖 Processing product: ${rankedProduct.product_name}`);
        
        const { analysis, llmUsed } = await processProductWithLLMs(
          rankedProduct.product_name,
          rankedProduct.brand,
          rankedProduct.contexts,
          rankedProduct.mention_count,
          rankedProduct.quality_score
        );
        
        processingMethod = llmUsed;
        
        const productResult: ProductResult = {
          product_name: rankedProduct.product_name,
          brand: rankedProduct.brand,
          summary: analysis.summary || `${rankedProduct.product_name} mentioned ${rankedProduct.mention_count} times across sources.`,
          image_url: undefined, // Will be handled in Phase 3
          sources: rankedProduct.contexts.map(ctx => ({
            title: ctx.source_title,
            url: ctx.source_url,
            snippet: ctx.text,
            type: 'review' as any // Default type, will be refined
          })),
          insights: {
            pros: analysis.insights?.pros || [],
            cons: analysis.insights?.cons || [],
            price_range: analysis.insights?.price_range || "Price varies",
            overall_rating: analysis.insights?.overall_rating || "Mixed reviews",
            key_features: analysis.insights?.key_features || [],
            recommended_by: analysis.insights?.recommended_by || []
          },
          mention_frequency: rankedProduct.mention_count,
          quality_score: rankedProduct.quality_score,
          api_source: `google_search_frequency_${llmUsed}`,
          api_ref: `search_${Date.now()}_${rankedProduct.normalized_name}`
        };
        
        productResults.push(productResult);
        
      } catch (error) {
        console.error(`❌ Error processing product ${rankedProduct.product_name}:`, error);
      }
    }

    results = productResults;
    console.log(`✅ Successfully processed ${results.length} products using method: ${processingMethod}`);

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
            name: product.product_name,
            venue: product.brand,
            description: product.summary,
            image_url: product.image_url || "",
            api_source: product.api_source,
            api_ref: product.api_ref,
            metadata: {
              brand: product.brand,
              sources: product.sources,
              insights: product.insights,
              mention_frequency: product.mention_frequency,
              quality_score: product.quality_score
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

    const finalResponse: SearchResponse = {
      results: results,
      source: "api",
      query: query,
      count: results.length,
      total_sources_analyzed: processedSources.length,
      processing_method: processingMethod
    };

    console.log(`✅ SUCCESS: Returning ${results.length} product-specific results for query "${query}"`);

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
        count: 0,
        total_sources_analyzed: 0,
        processing_method: "error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
