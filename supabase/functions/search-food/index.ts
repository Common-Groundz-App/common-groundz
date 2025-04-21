
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
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Mocked food results as there's no strong public API for generic food items
    const results = [
      {
        name: "Pizza Margherita",
        venue: "Any Italian Restaurant",
        description: "Classic Neapolitan pizza with tomatoes, mozzarella, and basil.",
        image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
        api_source: "mock_food",
        api_ref: "pizza-margherita",
        metadata: { cuisine: "Italian", type: "Pizza" }
      },
      {
        name: "Sushi Platter",
        venue: "Sushi House",
        description: "Assorted sushi rolls with fresh fish and vegetables.",
        image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
        api_source: "mock_food",
        api_ref: "sushi-platter",
        metadata: { cuisine: "Japanese", type: "Sushi" }
      }
    ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
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
