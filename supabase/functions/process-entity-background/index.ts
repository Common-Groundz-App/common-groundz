
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
      .limit(5);

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

    // Process image if needed
    if (taskList.includes('image_processing') && original_data.api_source) {
      console.log(`Processing image for entity ${entity_id}`);
      const imageUrl = await processEntityImage(original_data, entity_id);
      if (imageUrl) {
        updateData.image_url = imageUrl;
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

      console.log(`✅ Entity ${entity_id} enhanced successfully`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error processing entity task:`, error);
    return false;
  }
}

/**
 * Process entity image (simplified version for background)
 */
async function processEntityImage(originalData: any, entityId: string): Promise<string | null> {
  try {
    // For Google Places entities, trigger image refresh
    if (originalData.api_source === 'google_places' && originalData.api_ref) {
      // Call the existing refresh-entity-image function
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-entity-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          entityId,
          placeId: originalData.api_ref,
          photoReference: originalData.metadata?.photo_reference
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.imageUrl;
      }
    }

    // For other sources, attempt to save external image
    if (originalData.metadata?.image_url) {
      // This would call image saving logic
      // For now, return the original URL
      return originalData.metadata.image_url;
    }

    return null;
  } catch (error) {
    console.error('Error processing entity image:', error);
    return null;
  }
}

/**
 * Enrich entity metadata (simplified version for background)
 */
async function enrichEntityMetadata(originalData: any): Promise<any> {
  const enrichedData: any = {};

  try {
    // Add enhanced metadata based on type
    if (originalData.type === 'book' && originalData.metadata) {
      enrichedData.authors = originalData.metadata.authors || [];
      enrichedData.publication_year = originalData.metadata.publish_year;
      enrichedData.isbn = originalData.metadata.isbn;
    }

    if (originalData.type === 'place' && originalData.metadata) {
      enrichedData.external_ratings = {
        google_rating: originalData.metadata.rating,
        user_ratings_total: originalData.metadata.user_ratings_total
      };
    }

    // Add enrichment source
    enrichedData.enrichment_source = originalData.api_source;

    return enrichedData;
  } catch (error) {
    console.error('Error enriching metadata:', error);
    return {};
  }
}
