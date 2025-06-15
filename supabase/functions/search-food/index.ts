
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const SPOONACULAR_API_KEY = Deno.env.get("SPOONACULAR_API_KEY");
    
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle missing API key gracefully
    if (!SPOONACULAR_API_KEY) {
      console.warn("SPOONACULAR_API_KEY is not configured - returning empty results");
      return new Response(
        JSON.stringify({ 
          results: [],
          message: "Food search temporarily unavailable" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🍽️ Searching food for query: "${query}"`);

    const params = new URLSearchParams({
      query,
      number: "5",
      apiKey: SPOONACULAR_API_KEY
    });
    const url = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}&addRecipeInformation=true`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("Spoonacular API error:", response.status, data);
      return new Response(
        JSON.stringify({ 
          results: [],
          message: "Food search temporarily unavailable" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data.results) {
      console.log("No food results found");
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = data.results.map((item: any) => ({
      name: item.title,
      venue: item.sourceName || "Recipe",
      description: item.summary ? item.summary.replace(/(<([^>]+)>)/gi, "").substring(0, 200) : null,
      image_url: item.image || null,
      api_source: "spoonacular",
      api_ref: item.id?.toString(),
      metadata: {
        cuisines: item.cuisines || [],
        dishTypes: item.dishTypes || [],
        readyInMinutes: item.readyInMinutes,
        servings: item.servings,
        sourceUrl: item.sourceUrl,
        healthScore: item.healthScore,
        spoonacularScore: item.spoonacularScore
      }
    }));

    console.log(`✅ Found ${results.length} food results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-food:", error);
    return new Response(
      JSON.stringify({ 
        results: [],
        message: "Food search temporarily unavailable"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
