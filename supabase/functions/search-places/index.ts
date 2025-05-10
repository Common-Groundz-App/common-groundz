
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
    // Making sure we ONLY use the place name for the venue field
    const results = data.results.map((place: any) => {
      // Log the data structure for debugging
      console.log(`Processing place: ${place.name}, Address: ${place.formatted_address}`);
      
      // Properly construct the photo URL if available
      let imageUrl = null;
      if (place.photos && place.photos.length > 0) {
        const photoRef = place.photos[0].photo_reference;
        if (photoRef) {
          // Generate a direct URL for the photo
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
          console.log(`Generated image URL for ${place.name}:`, imageUrl);
        }
      }
      
      return {
        name: place.name,
        // IMPORTANT: Only use the name for venue, never the address
        venue: place.name, 
        // No description field
        description: null,
        image_url: imageUrl,
        api_source: "google_places",
        api_ref: place.place_id,
        metadata: {
          // Store the full address ONLY in metadata
          formatted_address: place.formatted_address || null,
          location: place.geometry?.location,
          types: place.types,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          business_status: place.business_status
        }
      };
    });

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
