import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StoredPhotoUrl {
  reference: string;
  storedUrl: string;
  width: number;
  height: number;
  uploadedAt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_PLACES_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { entityId, placeId, photoReferences } = await req.json();

    console.log(`📦 Batch storing ${photoReferences.length} photos for entity ${entityId}`);

    if (!entityId || !photoReferences || !Array.isArray(photoReferences)) {
      return new Response(
        JSON.stringify({ error: "Invalid request parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storedPhotos: StoredPhotoUrl[] = [];

    for (const photo of photoReferences) {
      try {
        // Download high-res image from Google (1200px - single quality)
        const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
        
        console.log(`📸 Downloading photo ${photo.photo_reference.substring(0, 20)}...`);
        const response = await fetch(googleUrl);
        
        if (!response.ok) {
          console.error(`Failed to fetch photo ${photo.photo_reference}: ${response.status}`);
          continue;
        }
        
        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.split('/')[1] || 'jpg';
        
        // Upload to entity-images bucket with reference-based naming
        const fileName = `${photo.photo_reference}.${ext}`;
        const filePath = `${entityId}/places/${fileName}`;
        
        console.log(`⬆️ Uploading to storage: ${filePath}`);
        const { error: uploadError } = await supabase.storage
          .from('entity-images')
          .upload(filePath, blob, { contentType, upsert: true });
        
        if (uploadError) {
          console.error(`Failed to store photo ${photo.photo_reference}:`, uploadError);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('entity-images')
          .getPublicUrl(filePath);
        
        storedPhotos.push({
          reference: photo.photo_reference,
          storedUrl: publicUrl,
          width: photo.width,
          height: photo.height,
          uploadedAt: new Date().toISOString()
        });
        
        console.log(`✅ Stored photo: ${publicUrl}`);
      } catch (err) {
        console.error(`Error processing photo ${photo.photo_reference}:`, err);
      }
    }

    console.log(`✅ Successfully stored ${storedPhotos.length}/${photoReferences.length} photos`);

    return new Response(
      JSON.stringify({ 
        success: true,
        storedPhotos,
        count: storedPhotos.length,
        total: photoReferences.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error in batch-store-place-photos:", error);
    
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
