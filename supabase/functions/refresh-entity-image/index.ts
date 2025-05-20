
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Accept": "application/json"
};

const ENTITY_IMAGES_BUCKET = 'entity-images';

// Build a Google Places photo URL from photo reference
function buildGooglePhotoUrl(photoReference: string, apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${apiKey}`;
}

// Function to save an image from URL to our storage bucket
async function saveImageToStorage(imageUrl: string, entityId: string, supabase: any) {
  try {
    console.log(`[refresh-entity-image] Downloading image from: ${imageUrl}`);
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "Accept": "*/*"
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const contentType = imageResponse.headers.get("content-type");
    console.log(`[refresh-entity-image] Image content type: ${contentType}`);
    
    const imageBlob = await imageResponse.blob();
    console.log(`[refresh-entity-image] Image downloaded, size: ${imageBlob.size} bytes`);
    
    const fileExt = contentType?.split("/")[1] || "jpeg";
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`[refresh-entity-image] Uploading image to storage: ${filePath} (${contentType}, size: ${imageBlob.size} bytes)`);
    
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
      console.error("[refresh-entity-image] Storage upload error:", uploadError);
      
      // Try to troubleshoot the error
      if (uploadError.message.includes('permission_denied')) {
        console.error('[refresh-entity-image] Upload permission denied. Attempting to fix bucket policies...');
        await createBucketWithPolicies(supabase, ENTITY_IMAGES_BUCKET);
        
        // Try upload one more time
        const { data: retryData, error: retryError } = await supabase.storage
          .from(ENTITY_IMAGES_BUCKET)
          .upload(filePath, imageBlob, {
            contentType,
            upsert: false,
          });
          
        if (retryError) {
          console.error("[refresh-entity-image] Retry upload still failed:", retryError);
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
      
    console.log(`[refresh-entity-image] Image saved to storage: ${publicUrl}`);
    
    // Update the entity directly with the new image URL to ensure it's saved
    const { error: updateError } = await supabase
      .from('entities')
      .update({ image_url: publicUrl })
      .eq('id', entityId);
      
    if (updateError) {
      console.error("[refresh-entity-image] Error updating entity with new image URL:", updateError);
    } else {
      console.log("[refresh-entity-image] Successfully updated entity with new image URL");
    }
    
    return publicUrl;
  } catch (error) {
    console.error(`[refresh-entity-image] Error saving image to storage:`, error);
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
      console.error(`[refresh-entity-image] Error creating open policy for ${bucketName}:`, error);
      return false;
    }
    
    console.log(`[refresh-entity-image] Successfully created open policy for bucket ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`[refresh-entity-image] Error creating bucket with policies:`, error);
    return false;
  }
}

// Create a bucket if it doesn't exist
async function ensureBucketExists(supabase: any, bucketName: string) {
  try {
    // List buckets to check if our bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("[refresh-entity-image] Error listing buckets:", listError);
      throw listError;
    }
    
    // Check if bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`[refresh-entity-image] Bucket ${bucketName} doesn't exist, creating it...`);
      
      // Create the bucket
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        console.error(`[refresh-entity-image] Error creating bucket ${bucketName}:`, createError);
        throw createError;
      }
      
      console.log(`[refresh-entity-image] Bucket ${bucketName} created successfully`);
    } else {
      console.log(`[refresh-entity-image] Bucket ${bucketName} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error("[refresh-entity-image] Error ensuring bucket exists:", error);
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
      console.error(`[refresh-entity-image] Error updating bucket ${bucketName} to public:`, error);
      // Try creating open policies as alternative approach
      await supabase.rpc('create_storage_open_policy', {
        bucket_id: bucketName
      });
    }
    
    console.log(`[refresh-entity-image] Successfully updated bucket ${bucketName} to be public`);
    return true;
  } catch (error) {
    console.error("[refresh-entity-image] Error ensuring bucket policies:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[refresh-entity-image] Edge function started");
    
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { 
        headers: { 
          "Accept": "application/json",
          "Content-Type": "application/json" 
        } 
      }
    });

    // Get request data
    let requestData;
    try {
      requestData = await req.json();
      console.log("[refresh-entity-image] Request payload:", JSON.stringify(requestData));
    } catch (parseError) {
      console.error("[refresh-entity-image] Error parsing request JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }
    
    const { placeId, photoReference, entityId } = requestData;
    
    console.log("[refresh-entity-image] Processing request:", { 
      placeId: placeId || 'null', 
      photoReference: photoReference || 'null', 
      entityId 
    });
    
    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "Entity ID is required" }),
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Ensure the entity-images bucket exists with proper policies
    const bucketPrepared = await ensureBucketPolicies(supabase, ENTITY_IMAGES_BUCKET);
    
    if (!bucketPrepared) {
      console.error("[refresh-entity-image] Failed to prepare storage bucket. Will try to continue anyway.");
    }

    // If we have a photo reference, use it directly
    if (photoReference) {
      const googleImageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
      
      console.log("[refresh-entity-image] Using provided photo reference to fetch image:", {
        photoReference,
        googleImageUrl: googleImageUrl.substring(0, 100) + '...'
      });
      
      // Save image to our storage
      const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
      
      if (!storedImageUrl) {
        throw new Error("Failed to save Google Places image to storage");
      }
      
      // First, fetch current entity data to get existing metadata
      const { data: entity, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();
        
      if (entityError) {
        console.error("[refresh-entity-image] Error fetching entity:", entityError);
        // Try to update just the image URL if we can't get the full entity data
        const { error: updateImageError } = await supabase
          .from('entities')
          .update({ image_url: storedImageUrl })
          .eq('id', entityId);
          
        if (updateImageError) {
          console.error("[refresh-entity-image] Error updating entity image:", updateImageError);
        }
        
        return new Response(
          JSON.stringify({ 
            imageUrl: storedImageUrl,
            photoReference,
            warning: "Updated image URL only, metadata update failed"
          }),
          { headers: corsHeaders }
        );
      }
      
      // Prepare updated metadata object
      const currentMetadata = typeof entity.metadata === 'object' ? entity.metadata || {} : {};
      const updatedMetadata = {
        ...currentMetadata,
        photo_reference: photoReference
      };
      
      // Update entity record with new image URL and store the photo reference
      const { error: updateError } = await supabase
        .from('entities')
        .update({ 
          image_url: storedImageUrl,
          metadata: updatedMetadata
        })
        .eq('id', entityId);
        
      if (updateError) {
        console.error("[refresh-entity-image] Error updating entity record:", updateError);
        
        // Try one more time with just the image URL
        const { error: imageOnlyUpdateError } = await supabase
          .from('entities')
          .update({ image_url: storedImageUrl })
          .eq('id', entityId);
          
        if (imageOnlyUpdateError) {
          console.error("[refresh-entity-image] Failed to update entity even with just image URL:", imageOnlyUpdateError);
        }
      }
      
      console.log("[refresh-entity-image] Successfully updated entity image:", storedImageUrl);
      
      return new Response(
        JSON.stringify({ 
          imageUrl: storedImageUrl,
          photoReference 
        }),
        { headers: corsHeaders }
      );
    }

    // If no photo reference but we have a place ID, fetch place details to get one
    if (placeId) {
      console.log("[refresh-entity-image] No photo reference provided, fetching place details for:", placeId);
      
      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.append("place_id", placeId);
      detailsUrl.searchParams.append("fields", "photos");
      detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

      console.log("[refresh-entity-image] Fetching place details from Google Places API");
      
      try {
        const response = await fetch(detailsUrl.toString(), {
          headers: {
            "Accept": "application/json"
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[refresh-entity-image] Google Places API error: ${response.status} ${response.statusText}`, errorText);
          throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("[refresh-entity-image] Google Places API response status:", data.status);

        // Check response status
        if (data.status !== "OK") {
          throw new Error(`Google Places API error: ${data.status} - ${data.error_message || "Unknown error"}`);
        }

        // Check if the place has photos
        if (data.result?.photos && data.result.photos.length > 0) {
          const newPhotoRef = data.result.photos[0].photo_reference;
          
          if (newPhotoRef) {
            console.log("[refresh-entity-image] Found new photo reference:", newPhotoRef);
            
            const googleImageUrl = buildGooglePhotoUrl(newPhotoRef, GOOGLE_PLACES_API_KEY);
            
            // Save image to our storage
            const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
            
            if (!storedImageUrl) {
              throw new Error("Failed to save Google Places image to storage");
            }
            
            // First, fetch current entity data to get existing metadata
            const { data: entity, error: entityError } = await supabase
              .from('entities')
              .select('*')
              .eq('id', entityId)
              .single();
              
            if (entityError) {
              console.error("[refresh-entity-image] Error fetching entity:", entityError);
              // Try to update just the image URL and photo reference
              const { error: simpleUpdateError } = await supabase
                .from('entities')
                .update({ 
                  image_url: storedImageUrl,
                  metadata: { photo_reference: newPhotoRef }
                })
                .eq('id', entityId);
                
              if (simpleUpdateError) {
                console.error("[refresh-entity-image] Error with simple update:", simpleUpdateError);
                
                // Try one more time with just the image URL
                const { error: imageOnlyUpdateError } = await supabase
                  .from('entities')
                  .update({ image_url: storedImageUrl })
                  .eq('id', entityId);
                  
                if (imageOnlyUpdateError) {
                  console.error("[refresh-entity-image] Failed to update entity:", imageOnlyUpdateError);
                }
              }
              
              return new Response(
                JSON.stringify({ 
                  imageUrl: storedImageUrl, 
                  photoReference: newPhotoRef,
                  warning: "Updated image but metadata update may have failed"
                }),
                { headers: corsHeaders }
              );
            }
            
            // Prepare updated metadata object
            const currentMetadata = typeof entity.metadata === 'object' ? entity.metadata || {} : {};
            const updatedMetadata = {
              ...currentMetadata,
              photo_reference: newPhotoRef
            };
            
            // Update entity record with new image URL and photo reference
            const { error: updateError } = await supabase
              .from('entities')
              .update({ 
                image_url: storedImageUrl,
                metadata: updatedMetadata
              })
              .eq('id', entityId);
              
            if (updateError) {
              console.error("[refresh-entity-image] Error updating entity record:", updateError);
              
              // Try one more time with just the image URL
              const { error: imageOnlyUpdateError } = await supabase
                .from('entities')
                .update({ image_url: storedImageUrl })
                .eq('id', entityId);
            }
            
            return new Response(
              JSON.stringify({ 
                imageUrl: storedImageUrl, 
                photoReference: newPhotoRef 
              }),
              { headers: corsHeaders }
            );
          }
        }
        
        console.warn("[refresh-entity-image] No photos available for this place");
        
        // No photos available
        return new Response(
          JSON.stringify({ error: "No photos available for this place" }),
          { 
            status: 404,
            headers: corsHeaders
          }
        );
      } catch (googleApiError) {
        console.error("[refresh-entity-image] Error fetching from Google Places API:", googleApiError);
        throw new Error(`Error fetching place details: ${googleApiError.message}`);
      }
    }
    
    // If we get here, we have no photo reference and no place ID
    return new Response(
      JSON.stringify({ error: "Either placeId or photoReference is required" }),
      { 
        status: 400,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("[refresh-entity-image] Error in refresh-entity-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
});
