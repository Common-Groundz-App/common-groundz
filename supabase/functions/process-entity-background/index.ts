
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackgroundTask {
  id: string;
  entity_id: string;
  metadata: {
    operation: string;
    original_data: any;
    tasks: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Background entity processing started');

    // Get pending tasks (limit to avoid overload)
    const { data: tasks, error: tasksError } = await supabase
      .from('entity_enrichment_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10); // Increased limit for better throughput

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    if (!tasks || tasks.length === 0) {
      console.log('No pending tasks found');
      return new Response(
        JSON.stringify({ message: 'No pending tasks', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    // Process each task
    for (const task of tasks) {
      try {
        console.log(`Processing task ${task.id} for entity ${task.entity_id}`);
        
        // Mark as processing
        await supabase
          .from('entity_enrichment_queue')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('id', task.id);

        // Process the task
        const success = await processEntityTask(supabase, task);
        
        if (success) {
          // Mark as completed
          await supabase
            .from('entity_enrichment_queue')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id);
          
          processed++;
          console.log(`✅ Task ${task.id} completed successfully`);
        } else {
          throw new Error('Task processing failed');
        }
      } catch (error) {
        console.error(`❌ Task ${task.id} failed:`, error);
        
        // Update retry count and mark as failed if max retries exceeded
        const newRetryCount = (task.retry_count || 0) + 1;
        const maxRetries = 3;
        
        await supabase
          .from('entity_enrichment_queue')
          .update({ 
            status: newRetryCount >= maxRetries ? 'failed' : 'pending',
            retry_count: newRetryCount,
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);
        
        failed++;
      }
    }

    console.log(`🏁 Background processing completed: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        message: 'Background processing completed',
        processed,
        failed,
        total: tasks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Background processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/**
 * Process individual entity enhancement task
 */
async function processEntityTask(supabase: any, task: BackgroundTask): Promise<boolean> {
  try {
    const { entity_id, metadata } = task;
    const { original_data, tasks: taskList } = metadata;
    
    // Get current entity data
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', entity_id)
      .single();

    if (entityError || !entity) {
      throw new Error(`Entity not found: ${entityError?.message}`);
    }

    let updateData: any = {};

    // Process image if needed and entity has API data
    if (taskList.includes('image_processing') && original_data.api_source) {
      console.log(`Processing image for entity ${entity_id} from ${original_data.api_source}`);
      const imageUrl = await processEntityImage(supabase, original_data, entity_id);
      if (imageUrl && imageUrl !== entity.image_url) {
        updateData.image_url = imageUrl;
        console.log(`✅ New image URL for entity ${entity_id}: ${imageUrl}`);
      }
    }

    // Process enhanced metadata if needed
    if (taskList.includes('metadata_enrichment')) {
      console.log(`Enriching metadata for entity ${entity_id}`);
      const enhancedData = await enrichEntityMetadata(original_data);
      updateData = { ...updateData, ...enhancedData };
    }

    // Update entity with enhanced data
    if (Object.keys(updateData).length > 0) {
      updateData.last_enriched_at = new Date().toISOString();
      updateData.data_quality_score = Math.min((entity.data_quality_score || 0) + 20, 100);
      
      const { error: updateError } = await supabase
        .from('entities')
        .update(updateData)
        .eq('id', entity_id);

      if (updateError) {
        throw new Error(`Failed to update entity: ${updateError.message}`);
      }

      console.log(`✅ Entity ${entity_id} enhanced successfully with updates:`, Object.keys(updateData));
    } else {
      console.log(`ℹ️ No updates needed for entity ${entity_id}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error processing entity task:`, error);
    return false;
  }
}

/**
 * Process entity image with improved handling for different sources
 */
async function processEntityImage(supabase: any, originalData: any, entityId: string): Promise<string | null> {
  try {
    console.log(`🖼️ Processing image for entity ${entityId}, source: ${originalData.api_source}`);
    
    // Handle Google Places images
    if (originalData.api_source === 'google_places' && originalData.api_ref) {
      console.log(`📍 Processing Google Places image for place: ${originalData.api_ref}`);
      
      const photoReference = originalData.metadata?.photo_reference;
      if (!photoReference) {
        console.log(`⚠️ No photo reference found for Google Places entity ${entityId}`);
        return null;
      }

      // Call the refresh-entity-image function for Google Places
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-entity-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          entityId,
          placeId: originalData.api_ref,
          photoReference: photoReference
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Google Places image processed successfully: ${result.imageUrl}`);
        return result.imageUrl;
      } else {
        const errorText = await response.text();
        console.error(`❌ Google Places image processing failed: ${errorText}`);
      }
    }

    // Handle OpenLibrary book covers
    if (originalData.api_source === 'openlibrary') {
      console.log(`📚 Processing OpenLibrary image for book: ${originalData.name}`);
      
      // OpenLibrary images are already in the metadata, just use them directly
      const coverUrl = originalData.metadata?.image_url;
      if (coverUrl && coverUrl.includes('covers.openlibrary.org')) {
        console.log(`✅ Using OpenLibrary cover: ${coverUrl}`);
        return coverUrl;
      }
    }

    // Handle TMDB movie posters
    if (originalData.api_source === 'tmdb') {
      console.log(`🎬 Processing TMDB image for movie: ${originalData.name}`);
      
      const posterPath = originalData.metadata?.poster_path;
      if (posterPath) {
        const fullImageUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
        console.log(`✅ Using TMDB poster: ${fullImageUrl}`);
        return fullImageUrl;
      }
    }

    // Handle other external images
    if (originalData.metadata?.image_url) {
      console.log(`🌐 Processing external image: ${originalData.metadata.image_url}`);
      // For now, return the original URL - could implement saving to storage here
      return originalData.metadata.image_url;
    }

    console.log(`ℹ️ No suitable image found for entity ${entityId}`);
    return null;
  } catch (error) {
    console.error('❌ Error processing entity image:', error);
    return null;
  }
}

/**
 * Enrich entity metadata with better data extraction
 */
async function enrichEntityMetadata(originalData: any): Promise<any> {
  const enrichedData: any = {};

  try {
    // Add enhanced metadata based on type and source
    if (originalData.type === 'book' && originalData.metadata) {
      enrichedData.authors = originalData.metadata.authors || [];
      enrichedData.publication_year = originalData.metadata.publish_year || originalData.metadata.first_publish_year;
      enrichedData.isbn = originalData.metadata.isbn;
      
      if (originalData.metadata.subjects) {
        enrichedData.subjects = originalData.metadata.subjects.slice(0, 10); // Limit subjects
      }
    }

    if (originalData.type === 'place' && originalData.metadata) {
      enrichedData.external_ratings = {
        google_rating: originalData.metadata.rating,
        user_ratings_total: originalData.metadata.user_ratings_total,
        price_level: originalData.metadata.price_level
      };
      
      if (originalData.metadata.formatted_address) {
        enrichedData.formatted_address = originalData.metadata.formatted_address;
      }
    }

    if (originalData.type === 'movie' && originalData.metadata) {
      enrichedData.external_ratings = {
        tmdb_rating: originalData.metadata.vote_average,
        vote_count: originalData.metadata.vote_count
      };
      
      if (originalData.metadata.release_date) {
        enrichedData.publication_year = new Date(originalData.metadata.release_date).getFullYear();
      }
    }

    // Add enrichment source and timestamp
    enrichedData.enrichment_source = originalData.api_source;
    enrichedData.enriched_at = new Date().toISOString();

    console.log(`🔧 Enhanced metadata for ${originalData.type}:`, Object.keys(enrichedData));
    return enrichedData;
  } catch (error) {
    console.error('❌ Error enriching metadata:', error);
    return {};
  }
}
