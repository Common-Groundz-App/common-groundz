
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BATCH_SIZE = 10;
const ENTITY_IMAGES_BUCKET = 'entity-images';

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Build a Google Places photo URL from photo reference
function buildGooglePhotoUrl(photoReference: string): string {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${apiKey}`;
}

// Function to save an image from URL to our storage bucket
async function saveImageToStorage(imageUrl: string, entityId: string): Promise<string | null> {
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
    
    console.log(`Uploading image to storage: ${filePath}`);
    
    // Upload to our storage
    const { data, error: uploadError } = await supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .upload(filePath, imageBlob, {
        contentType,
        upsert: false,
      });
      
    if (uploadError) {
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

// Process a batch of entities for migration
async function processEntityBatch(offset = 0): Promise<{ 
  processed: number, 
  successful: number, 
  failed: number,
  hasMore: boolean,
  errors: Array<{ id: string, error: string }>
}> {
  // Fetch entities that need image migration
  const { data: entities, error } = await supabase
    .from('entities')
    .select('*')
    .eq('is_deleted', false)
    .neq('image_url', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);
  
  if (error) {
    console.error("Error fetching entities:", error);
    throw error;
  }

  if (!entities || entities.length === 0) {
    return { processed: 0, successful: 0, failed: 0, hasMore: false, errors: [] };
  }

  const results = {
    processed: entities.length,
    successful: 0,
    failed: 0,
    hasMore: entities.length === BATCH_SIZE,
    errors: [] as Array<{ id: string, error: string }>
  };

  // Process each entity
  for (const entity of entities) {
    console.log(`Processing entity: ${entity.id} (${entity.name})`);
    
    try {
      let newImageUrl: string | null = null;
      let photoReference: string | null = null;
      
      // For Google Places entities
      if (entity.api_source === 'google_places' && entity.api_ref) {
        // Extract photo reference from metadata if available
        if (entity.metadata && 
            typeof entity.metadata === 'object' && 
            !Array.isArray(entity.metadata) &&
            entity.metadata.photo_reference) {
          
          photoReference = String(entity.metadata.photo_reference);
          const googleImageUrl = buildGooglePhotoUrl(photoReference);
          
          // Save the image to storage
          newImageUrl = await saveImageToStorage(googleImageUrl, entity.id);
        } else {
          // Try to refresh the image using the edge function
          try {
            const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-entity-image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`
              },
              body: JSON.stringify({
                placeId: entity.api_ref,
                entityId: entity.id
              })
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              newImageUrl = data.imageUrl;
              photoReference = data.photoReference;
            } else {
              throw new Error(`Refresh image failed: ${await refreshResponse.text()}`);
            }
          } catch (refreshError) {
            console.error(`Error refreshing image for ${entity.id}:`, refreshError);
            throw refreshError;
          }
        }
      } else {
        // For non-Google Places entities
        if (entity.image_url) {
          newImageUrl = await saveImageToStorage(entity.image_url, entity.id);
        }
      }

      // If we have a new image URL, update the entity
      if (newImageUrl) {
        const { error: updateError } = await supabase
          .from('entities')
          .update({ 
            image_url: newImageUrl,
            photo_reference: photoReference,
            updated_at: new Date().toISOString()
          })
          .eq('id', entity.id);
          
        if (updateError) {
          throw new Error(`Error updating entity: ${updateError.message}`);
        }
        
        results.successful++;
        console.log(`Successfully migrated image for entity: ${entity.id}`);
      } else {
        throw new Error("Failed to generate new image URL");
      }
    } catch (error) {
      console.error(`Error processing entity ${entity.id}:`, error);
      results.failed++;
      results.errors.push({
        id: entity.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { offset = 0, limit = BATCH_SIZE } = await req.json();
    
    // Process a batch of entities
    const results = await processEntityBatch(offset);
    
    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error in migrate-entity-images function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
