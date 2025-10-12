import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Lightweight edge function to fetch Google Places photo references
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("Missing GOOGLE_PLACES_API_KEY");
    }

    const { placeId } = await req.json();
    
    console.log(`📸 Fetching photos for place_id: ${placeId}`);
    
    // Fetch Place Details with photos field only (lightweight request)
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(detailsUrl);
    const data = await response.json();
    
    if (data.status !== "OK" || !data.result?.photos) {
      console.warn(`⚠️ No photos found for place_id: ${placeId}`);
      return new Response(
        JSON.stringify({ photos: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const photos = data.result.photos.map((photo: any) => ({
      photo_reference: photo.photo_reference,
      width: photo.width,
      height: photo.height,
      attributions: photo.html_attributions
    }));
    
    console.log(`✅ Found ${photos.length} photos for place_id: ${placeId}`);
    
    return new Response(
      JSON.stringify({ photos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("❌ Error fetching place photos:", error);
    return new Response(
      JSON.stringify({ error: error.message, photos: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
