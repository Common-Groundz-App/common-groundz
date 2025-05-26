import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ensureHttps, isValidUrl } from "./utils.ts";
import { extractProductMentions, analyzeProductFrequency, ProductExtractionResult } from "./product-extractor.ts";
import { analyzeQueryIntent } from "./query-analyzer.ts";
import { identifyProductsWithLLM, processProductWithEnhancedLLMs } from "./llm-analyzer.ts";
import { enhancedQueryAnalysis, getEnhancedSourceQualityScore } from "./enhanced-query-analyzer.ts";
import { validateSearchResults, shouldTriggerFallback, generateSpellCorrections } from "./result-validator.ts";

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
  query_intent: string;
}

// Enhanced source quality scoring with intent awareness
function getSourceQualityScore(
  domain: string, 
  url: string, 
  title: string, 
  intentType: string
): number {
  let score = 0.5; // Base score
  
  // High-quality beauty/health domains
  const highQualityDomains = [
    'cosmopolitan.com', 'allure.com', 'byrdie.com', 'harpersbazaar.com',
    'elle.com', 'vogue.com', 'refinery29.com', 'healthline.com',
    'dermatologytimes.com', 'skincareedit.com', 'beautypedia.com',
    'paulaschoice.com', 'reddit.com', 'makeupalley.com'
  ];
  
  // E-commerce listing pages (penalty varies by intent)
  const ecommerceDomains = [
    'amazon.', 'flipkart.', 'myntra.', 'nykaa.com',
    'sephora.', 'ulta.', 'beautybay.', 'cultbeauty.'
  ];
  
  // Brand official pages
  const brandOfficialIndicators = ['official', 'brand', 'company'];
  
  // Check for high-quality domains
  if (highQualityDomains.some(d => domain.includes(d))) {
    score += 0.4;
  }
  
  // Intent-specific scoring
  if (intentType === 'specific_product') {
    // For specific products, heavily penalize multi-product pages
    if (url.includes('/collections/') || url.includes('/category/') || 
        url.includes('/s?k=') || url.includes('/search') ||
        title.toLowerCase().includes('products') || 
        title.toLowerCase().includes('range') ||
        title.toLowerCase().includes('collection')) {
      score -= 0.5; // Heavy penalty for collection pages
    }
    
    // Boost pages that seem to be about the specific product
    if (title.toLowerCase().includes('review') && 
        !title.toLowerCase().includes('products')) {
      score += 0.3;
    }
  } else if (intentType === 'brand_exploration') {
    // For brand exploration, collection pages are actually good
    if (url.includes('/collections/') || url.includes('/products') ||
        title.toLowerCase().includes('products') || 
        title.toLowerCase().includes('range')) {
      score += 0.2;
    }
  }
  
  // Handle e-commerce domains with intent awareness
  if (ecommerceDomains.some(d => domain.includes(d))) {
    if (intentType === 'specific_product') {
      // Individual product pages are okay for specific products
      if (!url.includes('/collections/') && !url.includes('/category/') && 
          !url.includes('/s?k=') && !url.includes('/search')) {
        score += 0.1;
      } else {
        score -= 0.4; // Heavy penalty for listing pages
      }
    } else {
      score -= 0.2; // General penalty for e-commerce
    }
  }
  
  // Boost for review-related content
  const reviewKeywords = ['review', 'best', 'recommended', 'dermatologist', 'expert'];
  if (reviewKeywords.some(keyword => title.toLowerCase().includes(keyword))) {
    score += 0.2;
  }
  
  // Boost for comparison content (if comparison intent)
  if (intentType === 'comparison' && 
      (title.includes('vs') || title.includes('comparison'))) {
    score += 0.3;
  }
  
  return Math.max(0, Math.min(1, score));
}

// Enhanced source filtering with intent awareness
function filterAndRankSources(organicResults: any[], intentType: string): any[] {
  return organicResults
    .map((result: any) => {
      const domain = new URL(result.link || '').hostname;
      let type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce' = 'blog';
      
      if (domain.includes('reddit.com') || domain.includes('quora.com')) {
        type = 'forum';
      } else if (domain.includes('amazon.') || domain.includes('flipkart.') || 
                 domain.includes('myntra.') || domain.includes('nykaa.') ||
                 domain.includes('sephora.') || domain.includes('ulta.')) {
        type = 'ecommerce';
      } else if (result.title?.toLowerCase().includes('review') || 
                 domain.includes('review') || 
                 ['cosmopolitan.com', 'allure.com', 'byrdie.com'].some(d => domain.includes(d))) {
        type = 'review';
      } else if (result.snippet?.toLowerCase().includes('official') || domain.includes('official')) {
        type = 'official';
      }

      const qualityScore = getSourceQualityScore(domain, result.link, result.title || '', intentType);
      
      return {
        title: result.title || `Result`,
        url: ensureHttps(result.link || "") || "",
        snippet: result.snippet || "",
        type: type,
        qualityScore: qualityScore,
        domain: domain
      };
    })
    .filter(source => {
      // Intent-specific filtering
      if (intentType === 'specific_product') {
        // For specific products, be more strict about quality
        return source.url && source.title && source.qualityScore > 0.4;
      }
      return source.url && source.title && source.qualityScore > 0.3;
    })
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, intentType === 'specific_product' ? 8 : 12); // Fewer sources for specific products
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
    let processingMethod = "enhanced_v2";

    // Get API keys
    const serpApiKey = Deno.env.get("SERP_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
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

    // PHASE 0: Enhanced Query Intent Analysis
    console.log(`🧠 PHASE 0: Enhanced query analysis for: "${query}"`);
    const enhancedIntent = await enhancedQueryAnalysis(query, geminiApiKey, openaiApiKey);
    
    console.log(`🎯 Enhanced classification: ${enhancedIntent.type} (confidence: ${enhancedIntent.confidence})`);
    console.log(`📍 Category hints: ${enhancedIntent.categoryHints.join(', ')}`);
    console.log(`🔧 Enhanced optimized query: "${enhancedIntent.optimizedQuery}"`);

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
                  processing_method: "cached",
                  query_intent: enhancedIntent.type
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

    // PHASE 1: Enhanced Search Execution
    console.log(`🔍 PHASE 1: Enhanced search execution for: "${enhancedIntent.optimizedQuery}"`);
    
    let searchSuccessful = false;
    let currentQuery = enhancedIntent.optimizedQuery;
    let fallbackAttempt = 0;
    const maxFallbackAttempts = enhancedIntent.fallbackQueries.length;

    while (!searchSuccessful && fallbackAttempt <= maxFallbackAttempts) {
      try {
        const searchUrl = new URL("https://serpapi.com/search");
        searchUrl.searchParams.append("api_key", serpApiKey);
        searchUrl.searchParams.append("engine", "google");
        searchUrl.searchParams.append("q", currentQuery);
        searchUrl.searchParams.append("gl", "in");
        searchUrl.searchParams.append("hl", enhancedIntent.languageDetected === 'hindi' ? 'hi' : 'en');
        searchUrl.searchParams.append("num", "25");

        console.log(`🔍 Search attempt ${fallbackAttempt + 1}: "${currentQuery}"`);
        
        const response = await fetch(searchUrl.toString());
        if (!response.ok) {
          throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const organicResults = data.organic_results || [];
        
        if (organicResults.length === 0) {
          console.log(`No results for attempt ${fallbackAttempt + 1}, trying fallback`);
          fallbackAttempt++;
          if (fallbackAttempt <= maxFallbackAttempts) {
            currentQuery = enhancedIntent.fallbackQueries[fallbackAttempt - 1];
            continue;
          } else {
            // Try spell corrections as last resort
            const corrections = generateSpellCorrections(query);
            if (corrections.length > 0) {
              currentQuery = corrections[0];
              console.log(`🔤 Trying spell correction: "${currentQuery}"`);
              continue;
            }
          }
        } else {
          searchSuccessful = true;
          
          // Enhanced source filtering with category awareness
          const processedSources = organicResults
            .map((result: any) => {
              const domain = new URL(result.link || '').hostname;
              let type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce' = 'blog';
              
              if (domain.includes('reddit.com') || domain.includes('quora.com')) {
                type = 'forum';
              } else if (domain.includes('amazon.') || domain.includes('flipkart.') || 
                         domain.includes('myntra.') || domain.includes('nykaa.') ||
                         domain.includes('sephora.') || domain.includes('ulta.')) {
                type = 'ecommerce';
              } else if (result.title?.toLowerCase().includes('review') || 
                         domain.includes('review') || 
                         ['cosmopolitan.com', 'allure.com', 'byrdie.com'].some(d => domain.includes(d))) {
                type = 'review';
              } else if (result.snippet?.toLowerCase().includes('official') || domain.includes('official')) {
                type = 'official';
              }

              const qualityScore = getEnhancedSourceQualityScore(
                domain, 
                result.link, 
                result.title || '', 
                enhancedIntent.type,
                enhancedIntent.categoryHints
              );
              
              return {
                title: result.title || `Result`,
                url: ensureHttps(result.link || "") || "",
                snippet: result.snippet || "",
                type: type,
                qualityScore: qualityScore,
                domain: domain
              };
            })
            .filter(source => {
              return source.url && source.title && source.qualityScore > 0.3;
            })
            .sort((a, b) => b.qualityScore - a.qualityScore)
            .slice(0, enhancedIntent.type === 'specific_product' ? 8 : 12);

          console.log(`🔍 Enhanced filtering: ${processedSources.length} high-quality sources from ${organicResults.length} results`);
          
          if (processedSources.length === 0) {
            console.log("No high-quality sources after enhanced filtering");
            fallbackAttempt++;
            if (fallbackAttempt <= maxFallbackAttempts) {
              currentQuery = enhancedIntent.fallbackQueries[fallbackAttempt - 1];
              searchSuccessful = false;
              continue;
            }
          } else {
            // PHASE 2: Enhanced Product Extraction
            console.log(`🤖 PHASE 2: Enhanced LLM-based product identification from ${processedSources.length} sources`);
            
            const allIdentifiedProducts = new Map<string, Array<{ text: string; source_title: string; source_url: string }>>();
            
            for (const source of processedSources) {
              try {
                console.log(`🤖 Enhanced extraction from: ${source.title} (Quality: ${source.qualityScore.toFixed(2)})`);
                
                let content = source.snippet;
                try {
                  const fetchResponse = await fetch(source.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductBot/1.0)' },
                    signal: AbortSignal.timeout(5000),
                  });
                  
                  if (fetchResponse.ok) {
                    const html = await fetchResponse.text();
                    content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]*>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim()
                                  .substring(0, 5000);
                  }
                } catch (fetchError) {
                  console.log(`⚠️ Using snippet for ${source.url}`);
                }
                
                const identifiedProducts = await identifyProductsWithLLM(content, source.title, geminiApiKey, openaiApiKey);
                
                console.log(`🎯 Enhanced identification: ${identifiedProducts.length} products from ${source.title}`);
                
                for (const productName of identifiedProducts) {
                  const normalizedName = productName.toLowerCase().trim();
                  if (!allIdentifiedProducts.has(normalizedName)) {
                    allIdentifiedProducts.set(normalizedName, []);
                  }
                  allIdentifiedProducts.get(normalizedName)!.push({
                    text: content.substring(0, 1000),
                    source_title: source.title,
                    source_url: source.url
                  });
                }
                
              } catch (error) {
                console.error(`❌ Error in enhanced processing for ${source.url}:`, error);
              }
            }
            
            console.log(`📊 Enhanced extraction complete: ${allIdentifiedProducts.size} unique products identified`);
            
            if (allIdentifiedProducts.size > 0) {
              // PHASE 3: Enhanced Product Analysis and Ranking
              const rankedProducts = Array.from(allIdentifiedProducts.entries())
                .map(([productName, contexts]) => ({
                  product_name: contexts[0] ? contexts.find(c => c.text.toLowerCase().includes(productName))?.text.split(' ').find(word => 
                    word.toLowerCase().includes(productName.split(' ')[0].toLowerCase())
                  ) || productName : productName,
                  brand: productName.split(' ')[0],
                  mention_count: contexts.length,
                  quality_score: contexts.length * 0.2 + (contexts.reduce((sum, ctx) => sum + ctx.source_title.length, 0) / contexts.length) * 0.001,
                  contexts: contexts
                }))
                .sort((a, b) => {
                  const scoreA = a.mention_count * a.quality_score;
                  const scoreB = b.mention_count * b.quality_score;
                  return scoreB - scoreA;
                })
                .slice(0, 5);

              console.log(`🏆 Enhanced ranking complete:`, rankedProducts.map(p => `${p.product_name} (${p.mention_count} mentions)`));

              // Enhanced LLM analysis for each product
              const productResults: ProductResult[] = [];
              
              for (const rankedProduct of rankedProducts) {
                try {
                  console.log(`🤖 Enhanced analysis: ${rankedProduct.product_name}`);
                  
                  const { analysis, llmUsed } = await processProductWithEnhancedLLMs(
                    rankedProduct.product_name,
                    rankedProduct.contexts,
                    rankedProduct.mention_count,
                    rankedProduct.quality_score,
                    geminiApiKey,
                    openaiApiKey
                  );
                  
                  processingMethod = `enhanced_${llmUsed}_v2`;
                  
                  const productResult: ProductResult = {
                    product_name: rankedProduct.product_name,
                    brand: rankedProduct.brand,
                    summary: analysis.summary || `${rankedProduct.product_name} mentioned ${rankedProduct.mention_count} times across expert sources.`,
                    image_url: undefined,
                    sources: rankedProduct.contexts.map(ctx => ({
                      title: ctx.source_title,
                      url: ctx.source_url,
                      snippet: ctx.text.substring(0, 200),
                      type: 'review' as any
                    })),
                    insights: {
                      pros: analysis.insights?.pros || [],
                      cons: analysis.insights?.cons || [],
                      price_range: analysis.insights?.price_range || "Price varies",
                      overall_rating: analysis.insights?.overall_rating || "Expert mentioned",
                      key_features: analysis.insights?.key_features || [],
                      recommended_by: analysis.insights?.recommended_by || []
                    },
                    mention_frequency: rankedProduct.mention_count,
                    quality_score: rankedProduct.quality_score,
                    api_source: `enhanced_google_search_${llmUsed}_v2`,
                    api_ref: `enhanced_search_v2_${Date.now()}_${rankedProduct.product_name.replace(/\s+/g, '_')}`
                  };
                  
                  productResults.push(productResult);
                  
                } catch (error) {
                  console.error(`❌ Error in enhanced analysis for ${rankedProduct.product_name}:`, error);
                }
              }

              results = productResults;
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error in search attempt ${fallbackAttempt + 1}:`, error);
        fallbackAttempt++;
        if (fallbackAttempt <= maxFallbackAttempts) {
          currentQuery = enhancedIntent.fallbackQueries[fallbackAttempt - 1];
        }
      }
    }

    // PHASE 4: Result Validation and Quality Assurance
    console.log(`🔍 PHASE 4: Validating results quality`);
    const validation = await validateSearchResults(query, results, enhancedIntent, geminiApiKey, openaiApiKey);
    
    console.log(`📊 Validation complete: Overall quality ${validation.overallQuality.toFixed(2)}`);
    if (validation.suggestions.length > 0) {
      console.log(`💡 Suggestions: ${validation.suggestions.join(', ')}`);
    }

    // Trigger additional fallback if quality is too low
    if (shouldTriggerFallback(validation) && results.length === 0) {
      console.log(`🔄 Quality too low, attempting spell correction fallback`);
      const corrections = generateSpellCorrections(query);
      if (corrections.length > 0) {
        console.log(`🔤 Attempting with correction: "${corrections[0]}"`);
        // Could recursively call with corrected query, but keeping simple for now
      }
    }

    // Update cache with enhanced results
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
              quality_score: product.quality_score,
              validation: validation
            }
          }));
          
          const { error: insertError } = await supabaseServiceClient
            .from("cached_products")
            .insert(productsToCache);
          
          if (insertError) {
            console.error("Error inserting enhanced product cache:", insertError);
          } else {
            console.log(`💾 Successfully cached ${productsToCache.length} enhanced products for query "${query}"`);
          }
        }
      }
    } catch (cacheError) {
      console.error("Error updating enhanced cache:", cacheError);
    }

    const finalResponse: SearchResponse = {
      results: results,
      source: sourceOfResults,
      query: query,
      count: results.length,
      total_sources_analyzed: searchSuccessful ? 25 : 0,
      processing_method: processingMethod,
      query_intent: enhancedIntent.type
    };

    console.log(`✅ ENHANCED SUCCESS: Returning ${results.length} ${enhancedIntent.type} results for query "${query}" (Quality: ${validation.overallQuality.toFixed(2)})`);

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in enhanced search-products:", error);
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
