import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const requestData = await req.json();
    const { entityId, placeId } = requestData;

    console.log("🔄 Refreshing Google Places entity:", { entityId, placeId });

    if (!entityId || !placeId) {
      return new Response(
        JSON.stringify({ error: "Entity ID and Place ID are required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Fetch fresh place details from Google Places API
    console.log(`📍 Fetching fresh place details for: ${placeId}`);
    
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.append("place_id", placeId);
    detailsUrl.searchParams.append("fields", "photos,name,formatted_address,rating,user_ratings_total");
    detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

    const response = await fetch(detailsUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; EntityApp/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error_message) {
      throw new Error(`Google Places API error: ${data.error_message}`);
    }

    if (!data.result) {
      throw new Error("No place details found");
    }

    const placeDetails = data.result;
    console.log(`✅ Retrieved place details for: ${placeDetails.name || 'Unknown Place'}`);

    // Extract photo references
    let photoReferences = [];
    let primaryPhotoReference = null;

    if (placeDetails.photos && placeDetails.photos.length > 0) {
      photoReferences = placeDetails.photos.map((photo: any) => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        html_attributions: photo.html_attributions || []
      }));
      
      primaryPhotoReference = placeDetails.photos[0].photo_reference;
      console.log(`📸 Found ${photoReferences.length} photo references, primary: ${primaryPhotoReference.substring(0, 50)}...`);
    } else {
      console.log("⚠️ No photos found for this place");
    }

    // Generate new proxy image URL using the primary photo reference
    let newImageUrl = null;
    if (primaryPhotoReference) {
      newImageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${primaryPhotoReference}&maxWidth=800`;
      console.log(`🖼️ Generated new image URL: ${newImageUrl}`);
    }

    // Prepare updated metadata
    const updatedMetadata = {
      photo_references: photoReferences,
      photo_reference: primaryPhotoReference,
      last_refreshed_at: new Date().toISOString(),
      place_name: placeDetails.name,
      formatted_address: placeDetails.formatted_address,
      rating: placeDetails.rating,
      user_ratings_total: placeDetails.user_ratings_total
    };

    console.log(`✅ Successfully refreshed Google Places entity data`);

    return new Response(
      JSON.stringify({
        success: true,
        photoReferences,
        primaryPhotoReference,
        newImageUrl,
        updatedMetadata,
        placeDetails: {
          name: placeDetails.name,
          formatted_address: placeDetails.formatted_address,
          rating: placeDetails.rating,
          user_ratings_total: placeDetails.user_ratings_total
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("❌ Error in refresh-google-places-entity function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});