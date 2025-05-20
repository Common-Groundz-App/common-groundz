
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build a Google Places photo URL from photo reference
function buildGooglePhotoUrl(photoReference: string, apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${apiKey}`;
}

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get request data
    const { placeId, photoReference } = await req.json();
    
    if (!placeId) {
      return new Response(
        JSON.stringify({ error: "Place ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // If we have a photo reference, use it directly
    if (photoReference) {
      const imageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
      return new Response(
        JSON.stringify({ imageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no photo reference, fetch place details to get one
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.append("place_id", placeId);
    detailsUrl.searchParams.append("fields", "photos");
    detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

    const response = await fetch(detailsUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Google Places API error: ${data.error_message || "Unknown error"}`);
    }

    // Check if the place has photos
    if (data.result?.photos && data.result.photos.length > 0) {
      const newPhotoRef = data.result.photos[0].photo_reference;
      
      if (newPhotoRef) {
        const imageUrl = buildGooglePhotoUrl(newPhotoRef, GOOGLE_PLACES_API_KEY);
        
        return new Response(
          JSON.stringify({ 
            imageUrl, 
            photoReference: newPhotoRef 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // No photos available
    return new Response(
      JSON.stringify({ error: "No photos available for this place" }),
      { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in refresh-entity-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
