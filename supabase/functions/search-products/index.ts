
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the SerpApi key from environment
    const serpApiKey = Deno.env.get("SERP_API_KEY");
    if (!serpApiKey) {
      console.error("SERP_API_KEY is not set");
      return new Response(
        JSON.stringify({ 
          error: "SERP API key not configured",
          results: getMockResults(query) // Fallback to mock data if no API key
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call SerpApi Google Shopping search
    const searchUrl = new URL("https://serpapi.com/search");
    searchUrl.searchParams.append("api_key", serpApiKey);
    searchUrl.searchParams.append("engine", "google_shopping");
    searchUrl.searchParams.append("q", query);
    searchUrl.searchParams.append("gl", "in"); // India results
    searchUrl.searchParams.append("hl", "en"); // English language

    console.log(`Searching for products with query: "${query}"`);
    
    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = parseProductResults(data);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-products:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        results: [] // Return empty array on error
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseProductResults(data: any): ProductResult[] {
  if (!data.shopping_results || !Array.isArray(data.shopping_results)) {
    return [];
  }

  return data.shopping_results.slice(0, 10).map((item: any) => ({
    name: item.title || "Unknown Product",
    venue: item.source || item.seller || "Unknown Retailer",
    description: item.snippet || null,
    image_url: item.thumbnail || "",
    api_source: "serpapi_shopping",
    api_ref: item.product_id || item.position?.toString() || "",
    metadata: {
      price: item.price || "Price not available",
      rating: item.rating ? parseFloat(item.rating) : null,
      seller: item.source || item.seller || "Unknown Retailer",
      purchase_url: item.link || "",
      extracted_price: item.extracted_price || null,
      shipping: item.shipping || null,
      sale_price: item.price_when_on_sale || null
    }
  }));
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
