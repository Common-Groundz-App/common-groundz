
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENTITY_IMAGES_BUCKET = 'entity-images';

// Function to save an image from URL to our storage bucket
async function saveImageToStorage(imageUrl: string, entityId: string, supabase: any) {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const contentType = imageResponse.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error(`Not an image: ${contentType}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const fileExt = contentType.split("/")[1] || "jpeg";
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

// Check if an image URL is already from our storage
function isStorageImage(url: string): boolean {
  return url.includes(`/storage/v1/object/public/${ENTITY_IMAGES_BUCKET}`);
}

// Check if a URL is a valid image URL
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  // If it's already a data URL, it's valid
  if (url.startsWith('data:image/')) return true;
  
  // If it's from our storage, it's valid
  if (isStorageImage(url)) return true;
  
  // Google Places photos are valid
  if (url.includes('maps.googleapis.com/maps/api/place/photo')) return true;
  
  // Check common image extensions
  const imageExtensionRegex = /\.(jpeg|jpg|gif|png|webp)($|\?)/i;
  return imageExtensionRegex.test(url);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const { batchSize = 10, entityType, apiSource, skipStorage = true } = await req.json();
    
    // Build the query for entities with external images
    let query = supabase
      .from('entities')
      .select('id, image_url, type, api_source')
      .eq('is_deleted', false)
      .not('image_url', 'is', null);
    
    // Add filter for specific entity type if provided
    if (entityType) {
      query = query.eq('type', entityType);
    }
    
    // Add filter for specific API source if provided
    if (apiSource) {
      query = query.eq('api_source', apiSource);
    }
    
    // Skip entities with storage images if specified
    if (skipStorage) {
      query = query.not('image_url', 'ilike', `%/storage/v1/object/public/${ENTITY_IMAGES_BUCKET}%`);
    }
    
    // Limit the batch size
    query = query.limit(batchSize);
    
    // Execute the query
    const { data: entities, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching entities: ${error.message}`);
    }
    
    console.log(`Found ${entities.length} entities to process`);
    
    // Process each entity
    const results = [];
    for (const entity of entities) {
      try {
        // Skip if no image URL or invalid URL
        if (!entity.image_url || !isValidImageUrl(entity.image_url)) {
          results.push({
            entityId: entity.id,
            status: 'skipped',
            reason: 'Invalid image URL',
            originalUrl: entity.image_url
          });
          continue;
        }
        
        // Skip if already a storage image
        if (isStorageImage(entity.image_url)) {
          results.push({
            entityId: entity.id,
            status: 'skipped',
            reason: 'Already using storage',
            originalUrl: entity.image_url
          });
          continue;
        }
        
        // Save the image to storage
        const newImageUrl = await saveImageToStorage(entity.image_url, entity.id, supabase);
        
        if (!newImageUrl) {
          results.push({
            entityId: entity.id,
            status: 'failed',
            reason: 'Failed to save image',
            originalUrl: entity.image_url
          });
          continue;
        }
        
        // Update the entity with the new image URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: newImageUrl })
          .eq('id', entity.id);
          
        if (updateError) {
          results.push({
            entityId: entity.id,
            status: 'failed',
            reason: `Update error: ${updateError.message}`,
            originalUrl: entity.image_url,
            newUrl: newImageUrl
          });
          continue;
        }
        
        results.push({
          entityId: entity.id,
          status: 'success',
          originalUrl: entity.image_url,
          newUrl: newImageUrl,
          type: entity.type,
          apiSource: entity.api_source
        });
      } catch (entityError) {
        results.push({
          entityId: entity.id,
          status: 'error',
          reason: entityError.message,
          originalUrl: entity.image_url
        });
      }
    }
    
    // Summarize the results
    const summary = {
      total: entities.length,
      processed: results.length,
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      error: results.filter(r => r.status === 'error').length,
      details: results
    };

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in migrate-entity-images function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
