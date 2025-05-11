
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

    const { query, latitude, longitude, radius = 5000, locationEnabled = false } = await req.json();
    if (!query && !(latitude && longitude)) {
      return new Response(
        JSON.stringify({ error: "Query or location parameters are required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Construct API URL based on whether we're doing a text search or nearby search
    let url: URL;
    
    if (query && (!latitude || !longitude)) {
      // Text search if no coordinates provided or query is provided
      url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.append("query", query);
      console.log(`Searching places for query: ${query}`);
    } else if (latitude && longitude) {
      if (query) {
        // Text search with location bias
        url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        url.searchParams.append("query", query);
        url.searchParams.append("location", `${latitude},${longitude}`);
        url.searchParams.append("radius", radius.toString());
        console.log(`Searching for ${query} near location: ${latitude},${longitude}`);
      } else {
        // Nearby search (no query, just location)
        url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.append("location", `${latitude},${longitude}`);
        url.searchParams.append("radius", radius.toString());
        url.searchParams.append("type", "restaurant");
        console.log(`Searching nearby places at location: ${latitude},${longitude}`);
      }
    } else {
      throw new Error("Invalid search parameters");
    }

    url.searchParams.append("key", GOOGLE_PLACES_API_KEY);
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${data.error_message || "Unknown error"}`);
    }

    // Format the response to match our entity structure
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

      // Only calculate distance if locationEnabled is explicitly true and coordinates are available
      let distance = null;
      if (locationEnabled === true && latitude && longitude && place.geometry?.location) {
        distance = calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
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
          business_status: place.business_status,
          // Include distance only if locationEnabled is true and distance was calculated
          ...(distance !== null && { distance })
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

// Calculate distance between two points in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}
