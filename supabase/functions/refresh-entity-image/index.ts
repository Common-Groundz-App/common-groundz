
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENTITY_IMAGES_BUCKET = 'entity-images';

// Build a Google Places photo URL from photo reference
function buildGooglePhotoUrl(photoReference: string, apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${apiKey}`;
}

// Function to save an image from URL to our storage bucket
async function saveImageToStorage(imageUrl: string, entityId: string, supabase: any) {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const contentType = imageResponse.headers.get("content-type");
    const imageBlob = await imageResponse.blob();
    const fileExt = contentType?.split("/")[1] || "jpeg";
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`Uploading image to storage: ${filePath} (${contentType}, size: ${imageBlob.size} bytes)`);
    
    // Upload to our storage
    const { data, error: uploadError } = await supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .upload(filePath, imageBlob, {
        contentType,
        upsert: false,
      });
      
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .getPublicUrl(filePath);
      
    console.log(`Image saved to storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`Error saving image to storage:`, error);
    return null;
  }
}

// Create a bucket if it doesn't exist
async function ensureBucketExists(supabase: any, bucketName: string) {
  try {
    // List buckets to check if our bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      throw listError;
    }
    
    // Check if bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Bucket ${bucketName} doesn't exist, creating it...`);
      
      // Create the bucket
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}:`, createError);
        throw createError;
      }
      
      console.log(`Bucket ${bucketName} created successfully`);
    } else {
      console.log(`Bucket ${bucketName} already exists`);
    }
    
    return bucketExists;
  } catch (error) {
    console.error("Error ensuring bucket exists:", error);
    return false;
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
    const requestData = await req.json();
    const { placeId, photoReference, entityId } = requestData;
    
    console.log("Request received:", { placeId, photoReference, entityId });
    
    if (!placeId) {
      return new Response(
        JSON.stringify({ error: "Place ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "Entity ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Ensure the entity-images bucket exists
    await ensureBucketExists(supabase, ENTITY_IMAGES_BUCKET);

    // If we have a photo reference, use it directly
    if (photoReference) {
      const googleImageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
      
      console.log("Using provided photo reference to fetch image:", photoReference);
      
      // Save image to our storage
      const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
      
      if (!storedImageUrl) {
        throw new Error("Failed to save Google Places image to storage");
      }
      
      // Update entity record with new image URL
      const { error: updateError } = await supabase
        .from('entities')
        .update({ 
          image_url: storedImageUrl, 
          photo_reference: photoReference 
        })
        .eq('id', entityId);
        
      if (updateError) {
        console.error("Error updating entity record:", updateError);
      }
      
      return new Response(
        JSON.stringify({ 
          imageUrl: storedImageUrl,
          photoReference 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no photo reference, fetch place details to get one
    console.log("No photo reference provided, fetching place details for:", placeId);
    
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
        console.log("Found new photo reference:", newPhotoRef);
        
        const googleImageUrl = buildGooglePhotoUrl(newPhotoRef, GOOGLE_PLACES_API_KEY);
        
        // Save image to our storage
        const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
        
        if (!storedImageUrl) {
          throw new Error("Failed to save Google Places image to storage");
        }
        
        // Update entity record with new image URL and photo reference
        const { error: updateError } = await supabase
          .from('entities')
          .update({ 
            image_url: storedImageUrl, 
            photo_reference: newPhotoRef 
          })
          .eq('id', entityId);
          
        if (updateError) {
          console.error("Error updating entity record:", updateError);
        }
        
        return new Response(
          JSON.stringify({ 
            imageUrl: storedImageUrl, 
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

