
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

// Maximum number of retries for API calls
const MAX_RETRIES = 3;

// Retry function with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // If successful or out of retries, return the response
    if (response.ok || retries <= 0) {
      return response;
    }
    
    // If rate limited (429) or server error (5xx), wait and retry
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
      console.log(`Retrying fetch after ${delay}ms due to ${response.status} status`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    // For other errors, just return the response
    return response;
  } catch (error) {
    if (retries <= 0) throw error;
    
    const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
    console.log(`Retrying fetch after ${delay}ms due to error: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1);
  }
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

    console.log(`Processing request for Place ID: ${placeId}, Photo Reference: ${photoReference || 'none provided'}`);

    // If we have a photo reference, use it directly
    if (photoReference) {
      const imageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
      console.log(`Using provided photo reference to generate image URL`);
      return new Response(
        JSON.stringify({ imageUrl, photoReference }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no photo reference, fetch place details to get one
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.append("place_id", placeId);
    detailsUrl.searchParams.append("fields", "photos,name");
    detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

    console.log(`Fetching place details for ${placeId}`);
    
    const response = await fetchWithRetry(detailsUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error(`Google API error response:`, data);
      throw new Error(`Google Places API error: ${data.error_message || "Unknown error"} (status: ${response.status})`);
    }
    
    if (data.status === "REQUEST_DENIED") {
      console.error("Google Places API request denied:", data.error_message);
      throw new Error(`Google Places API request denied: ${data.error_message}`);
    }

    if (data.status === "INVALID_REQUEST") {
      console.error("Invalid Google Places API request:", data.error_message);
      throw new Error(`Invalid Google Places API request: ${data.error_message}`);
    }

    if (data.status !== "OK") {
      console.error(`Google Places API returned status: ${data.status}`, data);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    console.log(`Place details fetched successfully for: ${data.result?.name || placeId}`);

    // Check if the place has photos
    if (data.result?.photos && data.result.photos.length > 0) {
      const newPhotoRef = data.result.photos[0].photo_reference;
      
      if (newPhotoRef) {
        const imageUrl = buildGooglePhotoUrl(newPhotoRef, GOOGLE_PLACES_API_KEY);
        console.log(`Found new photo reference: ${newPhotoRef.substring(0, 20)}...`);
        
        return new Response(
          JSON.stringify({ 
            imageUrl, 
            photoReference: newPhotoRef,
            placeName: data.result.name
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // No photos available
    console.log(`No photos available for place: ${data.result?.name || placeId}`);
    return new Response(
      JSON.stringify({ 
        error: "No photos available for this place",
        placeName: data.result?.name
      }),
      { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in refresh-entity-image function:", error);
    
    // Return a more detailed error response
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
