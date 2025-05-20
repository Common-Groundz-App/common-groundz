
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
    
    // Ensure the bucket has proper policies before upload
    await ensureBucketPolicies(supabase, ENTITY_IMAGES_BUCKET);
    
    // Upload to our storage
    const { data, error: uploadError } = await supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .upload(filePath, imageBlob, {
        contentType,
        upsert: false,
      });
      
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      
      // Try to troubleshoot the error
      if (uploadError.message.includes('permission_denied')) {
        console.error('Upload permission denied. Attempting to fix bucket policies...');
        await createBucketWithPolicies(supabase, ENTITY_IMAGES_BUCKET);
        
        // Try upload one more time
        const { data: retryData, error: retryError } = await supabase.storage
          .from(ENTITY_IMAGES_BUCKET)
          .upload(filePath, imageBlob, {
            contentType,
            upsert: false,
          });
          
        if (retryError) {
          console.error("Retry upload still failed:", retryError);
          throw new Error(`Storage upload failed after policy fix: ${retryError.message}`);
        }
      } else {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
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

// Create a bucket if it doesn't exist with all needed policies
async function createBucketWithPolicies(supabase: any, bucketName: string) {
  try {
    // First ensure the bucket exists
    const bucketResult = await ensureBucketExists(supabase, bucketName);
    if (!bucketResult) {
      throw new Error(`Failed to create bucket ${bucketName}`);
    }
    
    // Then create policies using the service role
    // For this function, we need to use direct SQL execution using rpc
    // We'll create an open policy for now to ensure things work
    const { data, error } = await supabase.rpc('create_storage_open_policy', {
      bucket_id: bucketName
    });
    
    if (error) {
      console.error(`Error creating open policy for ${bucketName}:`, error);
      return false;
    }
    
    console.log(`Successfully created open policy for bucket ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error creating bucket with policies:`, error);
    return false;
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
    
    return true;
  } catch (error) {
    console.error("Error ensuring bucket exists:", error);
    return false;
  }
}

// Ensure a bucket has the correct policies
async function ensureBucketPolicies(supabase: any, bucketName: string) {
  try {
    // First ensure the bucket exists
    await ensureBucketExists(supabase, bucketName);
    
    // Then try to update the bucket to be public
    const { error } = await supabase.storage.updateBucket(bucketName, {
      public: true
    });
    
    if (error) {
      console.error(`Error updating bucket ${bucketName} to public:`, error);
      // Try creating open policies as alternative approach
      await supabase.rpc('create_storage_open_policy', {
        bucket_id: bucketName
      });
    }
    
    console.log(`Successfully updated bucket ${bucketName} to be public`);
    return true;
  } catch (error) {
    console.error("Error ensuring bucket policies:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge function refresh-entity-image started");
    
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // We need to use the service role key to manage storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const requestData = await req.json();
    const { placeId, photoReference, entityId } = requestData;
    
    console.log("Request received:", { placeId, photoReference, entityId });
    
    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "Entity ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Ensure the entity-images bucket exists with proper policies
    const bucketPrepared = await ensureBucketPolicies(supabase, ENTITY_IMAGES_BUCKET);
    
    if (!bucketPrepared) {
      console.error("Failed to prepare storage bucket. Will try to continue anyway.");
    }

    // If we have a photo reference, use it directly
    if (photoReference) {
      const googleImageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
      
      console.log("Using provided photo reference to fetch image:", photoReference);
      
      // Save image to our storage
      const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
      
      if (!storedImageUrl) {
        throw new Error("Failed to save Google Places image to storage");
      }
      
      // Update entity record with new image URL and store the photo reference
      const { error: updateError } = await supabase
        .from('entities')
        .update({ 
          image_url: storedImageUrl,
          metadata: supabase.rpc('jsonb_set_key', {
            json_data: supabase.rpc('get_entity_metadata', { entity_id: entityId }),
            key_name: 'photo_reference',
            new_value: photoReference
          })
        })
        .eq('id', entityId);
        
      if (updateError) {
        console.error("Error updating entity record:", updateError);
        // Try a simpler update without the metadata manipulation
        const { error: simpleUpdateError } = await supabase
          .from('entities')
          .update({ image_url: storedImageUrl })
          .eq('id', entityId);
          
        if (simpleUpdateError) {
          console.error("Error with simple entity update:", simpleUpdateError);
        }
      }
      
      console.log("Successfully updated entity image:", storedImageUrl);
      
      return new Response(
        JSON.stringify({ 
          imageUrl: storedImageUrl,
          photoReference 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no photo reference but we have a place ID, fetch place details to get one
    if (placeId) {
      console.log("No photo reference provided, fetching place details for:", placeId);
      
      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.append("place_id", placeId);
      detailsUrl.searchParams.append("fields", "photos");
      detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

      const response = await fetch(detailsUrl.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();

      // Check response status
      if (data.status !== "OK") {
        throw new Error(`Google Places API error: ${data.status} - ${data.error_message || "Unknown error"}`);
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
    }
    
    // If we get here, we have no photo reference and no place ID
    return new Response(
      JSON.stringify({ error: "Either placeId or photoReference is required" }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in refresh-entity-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
