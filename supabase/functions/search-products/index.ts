
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
    // Simple mock product results
    const results = [
      {
        name: "Apple iPhone 15",
        venue: "Apple Store",
        description: "The latest Apple iPhone with advanced camera and display.",
        image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
        api_source: "mock_products",
        api_ref: "apple-iphone-15",
        metadata: { brand: "Apple", category: "Smartphone" }
      },
      {
        name: "Sony WH-1000XM5 Headphones",
        venue: "Best Buy",
        description: "Industry leading noise-cancelling wireless headphones.",
        image_url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80",
        api_source: "mock_products",
        api_ref: "sony-wh1000xm5",
        metadata: { brand: "Sony", category: "Headphones" }
      }
    ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-products:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
