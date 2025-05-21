
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Downloads a URL to a temporary file
 * @param url The URL to download
 * @returns The file data as a Blob
 */
async function downloadToBlob(url: string): Promise<Blob> {
  console.log("[refresh-entity-image] Downloading image from:", url);
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const blob = await response.blob();
  
  console.log("[refresh-entity-image] Image downloaded successfully, size:", blob.size, "type:", contentType);
  return blob;
}

/**
 * Gets photo URL from Google Places Photo API
 * @param photoReference The photo reference
 * @param maxWidth The max width
 * @returns The photo URL
 */
async function getPhotoFromReference(photoReference: string, maxWidth = 800): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    throw new Error("Google Places API key is not set");
  }
  
  console.log("[refresh-entity-image] Getting photo from Google Places API with reference:", photoReference);
  
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
}

serve(async (req) => {
  console.log("[refresh-entity-image] Edge function started");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }
  
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Parse request body
    let data;
    try {
      data = await req.json();
      console.log("[refresh-entity-image] Received data:", JSON.stringify(data));
    } catch (parseError) {
      console.error("[refresh-entity-image] Error parsing request JSON:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const { placeId, photoReference, entityId } = data;
    
    if (!entityId) {
      return new Response(JSON.stringify({ error: "Entity ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("[refresh-entity-image] Missing environment variables for Supabase");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Check if the entity exists
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, api_source, api_ref, metadata")
      .eq("id", entityId)
      .eq("is_deleted", false)
      .single();
    
    if (entityError) {
      console.error("[refresh-entity-image] Error fetching entity:", entityError);
      return new Response(JSON.stringify({ error: "Entity not found", details: entityError }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    console.log("[refresh-entity-image] Found entity:", entity.name);
    
    // Determine image source
    let imageUrl;
    let actualPhotoReference = photoReference;
    
    if (!actualPhotoReference && entity.metadata?.photo_reference) {
      actualPhotoReference = entity.metadata.photo_reference;
      console.log("[refresh-entity-image] Using photo reference from entity metadata:", actualPhotoReference);
    }
    
    if (actualPhotoReference) {
      try {
        // Get image URL from Places API
        imageUrl = await getPhotoFromReference(actualPhotoReference);
        console.log("[refresh-entity-image] Retrieved Google Places photo URL");
      } catch (placesError) {
        console.error("[refresh-entity-image] Error getting Places photo:", placesError);
        return new Response(JSON.stringify({ error: "Failed to get photo from Google Places API", details: placesError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else if (placeId) {
      console.log("[refresh-entity-image] Place ID provided but no photo reference, this needs extra work...");
      
      // Placeholder logic that might be implemented in the future
      // For now, we'll return an error
      return new Response(JSON.stringify({ 
        error: "Place ID provided without photo reference",
        message: "Currently this endpoint requires a photo reference to work" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ 
        error: "Insufficient parameters",
        message: "Either photo reference or place ID is required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    console.log("[refresh-entity-image] Image URL determined:", imageUrl);
    
    // Download the image
    let imageBlob;
    try {
      imageBlob = await downloadToBlob(imageUrl);
    } catch (downloadError) {
      console.error("[refresh-entity-image] Error downloading image:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download image", details: downloadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Determine file extension from content type
    const contentType = imageBlob.type;
    let fileExt = "jpg"; // Default
    
    if (contentType) {
      if (contentType.includes("png")) {
        fileExt = "png";
      } else if (contentType.includes("gif")) {
        fileExt = "gif";
      } else if (contentType.includes("webp")) {
        fileExt = "webp";
      }
    }
    
    // Generate file name and path
    const timestamp = new Date().getTime();
    const fileName = `${entityId}-${timestamp}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`[refresh-entity-image] Uploading image to storage: ${filePath} (${imageBlob.size} bytes, ${contentType})`);
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("entity-images")
      .upload(filePath, imageBlob, {
        contentType,
        upsert: true
      });
    
    if (uploadError) {
      console.error("[refresh-entity-image] Error uploading to storage:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload image", details: uploadError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    console.log("[refresh-entity-image] Upload successful:", uploadData.path);
    
    // Get the public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from("entity-images")
      .getPublicUrl(filePath);
    
    console.log("[refresh-entity-image] Public URL:", publicUrl);
    
    // Return the results - including the photo reference that was used
    return new Response(JSON.stringify({
      success: true,
      imageUrl: publicUrl,
      photoReference: actualPhotoReference,
      message: "Image refreshed successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("[refresh-entity-image] Unhandled error:", error);
    return new Response(JSON.stringify({ error: "Server error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
