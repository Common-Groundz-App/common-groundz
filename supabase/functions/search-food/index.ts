
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const SPOONACULAR_API_KEY = Deno.env.get("SPOONACULAR_API_KEY");
    if (!SPOONACULAR_API_KEY) {
      throw new Error("SPOONACULAR_API_KEY is not set");
    }

    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Spoonacular Search Recipes endpoint
    const params = new URLSearchParams({
      query,
      number: "5",
      apiKey: SPOONACULAR_API_KEY
    });
    const url = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}&addRecipeInformation=true`;

    const response = await fetch(url);
    const data = await response.json();

    // Handle possible errors in the response
    if (!response.ok || !data.results) {
      console.error("Spoonacular error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Failed to fetch from Spoonacular" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Spoonacular results to our external result structure
    const results = data.results.map((item: any) => ({
      name: item.title,
      venue: item.sourceName || "Unknown",
      description: item.summary ? item.summary.replace(/(<([^>]+)>)/gi, "") : null,
      image_url: item.image || null,
      api_source: "spoonacular",
      api_ref: item.id?.toString(),
      metadata: {
        cuisines: item.cuisines,
        dishTypes: item.dishTypes,
        readyInMinutes: item.readyInMinutes,
        servings: item.servings,
        sourceUrl: item.sourceUrl
      }
    }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-food:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
