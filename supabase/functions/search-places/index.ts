
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Using Google Places API - Text Search
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.append("query", query);
    url.searchParams.append("key", GOOGLE_PLACES_API_KEY);
    
    console.log(`Searching places for query: ${query}`);
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${data.error_message || "Unknown error"}`);
    }

    // Format the response to match our entity structure
    // Modified: Changed how we structure the data to avoid incorrect field mapping
    const results = data.results.map((place: any) => ({
      name: place.name,
      venue: place.name, // Now only storing the place name as venue, not the full address
      // No description field to avoid auto-filling the "Your thoughts" field
      image_url: place.photos && place.photos.length > 0 
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}` 
        : null,
      api_source: "google_places",
      api_ref: place.place_id,
      metadata: {
        location: place.geometry?.location,
        types: place.types,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        business_status: place.business_status,
        formatted_address: place.formatted_address || null, // Store full address in metadata
      }
    }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-places function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
