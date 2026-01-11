import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Backfill Review Embeddings
 * 
 * This function fetches all reviews that don't have embeddings,
 * builds rich content from review + entity data, and generates embeddings.
 * 
 * Run this once to populate embeddings for existing reviews.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('backfill-review-embeddings: Started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse options from request body
    const { batchSize = 20, dryRun = false, forceRegenerate = false } = await req.json().catch(() => ({}));

    console.log(`Options: batchSize=${batchSize}, dryRun=${dryRun}, forceRegenerate=${forceRegenerate}`);

    // Fetch reviews without embeddings (or all if forceRegenerate)
    // Note: Use LEFT JOIN (entities) instead of INNER JOIN (entities!inner) to include reviews without entities
    let query = supabaseClient
      .from('reviews')
      .select(`
        id,
        title,
        description,
        category,
        venue,
        rating,
        entity_id,
        user_id,
        entities(id, name, description, type, venue)
      `)
      .order('created_at', { ascending: false });

    if (!forceRegenerate) {
      query = query.is('embedding', null);
    }

    const { data: reviews, error: fetchError } = await query.limit(batchSize);

    if (fetchError) {
      console.error('Error fetching reviews:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reviews', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reviews || reviews.length === 0) {
      console.log('No reviews need embedding backfill');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No reviews need embedding backfill',
          processed: 0,
          duration: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${reviews.length} reviews to process`);

    // Build rich content for each review
    const textsToEmbed = reviews.map((review: any) => {
      const entity = review.entities;
      
      // Build comprehensive content for semantic matching
      const contentParts = [
        review.category ? `Category: ${review.category}` : null,
        review.title ? `Title: ${review.title}` : null,
        entity?.name ? `Product/Place: ${entity.name}` : null,
        entity?.type ? `Type: ${entity.type}` : null,
        review.venue || entity?.venue ? `Location: ${review.venue || entity.venue}` : null,
        review.rating ? `Rating: ${review.rating} stars` : null,
        review.description ? `Review: ${review.description}` : null,
        entity?.description ? `About: ${entity.description.slice(0, 300)}` : null
      ].filter(Boolean);

      const content = contentParts.join('. ');
      
      console.log(`Review ${review.id}: ${content.slice(0, 100)}...`);

      return {
        id: review.id,
        content,
        type: 'review' as const
      };
    });

    if (dryRun) {
      console.log('Dry run - not generating embeddings');
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          reviewsToProcess: reviews.length,
          sampleContent: textsToEmbed.slice(0, 3).map(t => ({ id: t.id, content: t.content.slice(0, 200) })),
          duration: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call generate-embeddings function
    console.log(`Calling generate-embeddings for ${textsToEmbed.length} reviews`);
    
    const embeddingResponse = await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ texts: textsToEmbed })
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('Embedding generation failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Embedding generation failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingResult = await embeddingResponse.json();
    
    console.log(`Embedding generation complete:`, {
      savedCount: embeddingResult.savedCount,
      totalCount: embeddingResult.totalCount,
      errors: embeddingResult.errors?.length || 0
    });

    // Count remaining reviews without embeddings
    const { count: remainingCount } = await supabaseClient
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        processed: embeddingResult.totalCount,
        saved: embeddingResult.savedCount,
        failed: embeddingResult.totalCount - embeddingResult.savedCount,
        remaining: remainingCount || 0,
        saveResults: embeddingResult.saveResults,
        errors: embeddingResult.errors,
        duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-review-embeddings:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
