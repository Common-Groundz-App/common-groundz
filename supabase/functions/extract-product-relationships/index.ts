import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductRelationship {
  target_entity_id: string; // UUID from database
  target_entity_name: string; // For logging only
  relationship_type: 'upgrade' | 'alternative' | 'complementary';
  confidence: number;
  evidence_quote: string;
}

// Helper function to build entity display names with fallback logic
function buildEntityDisplayName(entity: any): string {
  if (!entity) return 'Unknown Entity';
  
  // Books: Try authors array first (most reliable)
  if (entity.authors && Array.isArray(entity.authors) && entity.authors.length > 0) {
    return `${entity.name} by ${entity.authors.join(', ')}`;
  }
  
  // Fallback to venue field (used for authors in some older entities)
  if (entity.venue) {
    return `${entity.name} by ${entity.venue}`;
  }
  
  // Default: just the name (for places, products without brands, etc.)
  return entity.name;
}

/**
 * Get candidate entity types based on source entity type
 * Prevents cross-category pollution while allowing logical relationships
 */
function getCandidateTypes(sourceType: string): string[] {
  const typeMap: Record<string, string[]> = {
    'book': ['book'],
    'movie': ['movie'],
    'place': ['place'],
    'product': ['product', 'brand'], // Products can relate to brands
    'brand': ['brand', 'product'], // Brands can relate to products
  };
  
  return typeMap[sourceType] || [sourceType];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { reviewId, batchMode = false, limit = 50, skipProcessed = true, dryRun = false } = await req.json();

    console.log(`[extract-relationships] Starting - mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, batch: ${batchMode}, limit: ${limit}`);

    let reviewsToProcess = [];

    if (reviewId) {
      const { data: review, error } = await supabaseClient
        .from('reviews')
        .select(`
          id, entity_id, title, description, user_id, rating,
          review_updates (id, comment, rating, created_at)
        `)
        .eq('id', reviewId)
        .single();

      if (error || !review) throw new Error('Review not found');
      reviewsToProcess = [review];
    } else if (batchMode) {
      let query = supabaseClient
        .from('reviews')
        .select(`
          id, entity_id, title, description, user_id, rating,
          review_updates (id, comment, rating, created_at)
        `)
        .not('entity_id', 'is', null)
        .order('created_at', { ascending: false });

      if (skipProcessed && !dryRun) {
        const { data: processedReviews } = await supabaseClient
          .from('product_relationships')
          .select('metadata')
          .not('metadata->review_id', 'is', null);

        const processedReviewIds = new Set(
          processedReviews?.map(r => r.metadata?.review_id).filter(Boolean) || []
        );

        if (processedReviewIds.size > 0) {
          console.log(`[extract-relationships] Skipping ${processedReviewIds.size} already processed reviews`);
          query = query.not('id', 'in', `(${Array.from(processedReviewIds).join(',')})`);
        }
      }

      query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      reviewsToProcess = data || [];
    } else {
      throw new Error('Either reviewId or batchMode must be specified');
    }

    console.log(`[extract-relationships] Processing ${reviewsToProcess.length} reviews`);

    const extractedRelationships: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const review of reviewsToProcess) {
      try {
        // Fetch source entity details
        const { data: sourceEntity, error: entityError } = await supabaseClient
          .from('entities')
          .select('id, name, type, authors, venue')
          .eq('id', review.entity_id)
          .single();

        if (entityError || !sourceEntity) {
          console.error(`[extract-relationships] Source entity not found: ${review.entity_id}`);
          continue;
        }

        const sourceEntityName = buildEntityDisplayName(sourceEntity);

        // Get allowed candidate types for this source entity
        const allowedTypes = getCandidateTypes(sourceEntity.type);
        console.log(`[extract-relationships] Fetching candidates of types: ${allowedTypes.join(', ')}`);

        // Fetch type-filtered candidate entities
        const { data: candidateEntities, error: candidatesError } = await supabaseClient
          .from('entities')
          .select('id, name, type, authors, venue, description, popularity_score')
          .eq('is_deleted', false)
          .neq('id', review.entity_id) // Exclude source entity
          .in('type', allowedTypes) // CRITICAL: Only fetch relevant types
          .order('popularity_score', { ascending: false })
          .limit(300);

        if (candidatesError) {
          console.error(`[extract-relationships] Error fetching candidates:`, candidatesError);
          continue;
        }

        // Format candidates for Gemini (compact representation)
        const candidatesList = candidateEntities.map(e => {
          const authorInfo = e.authors?.join(', ') || e.venue || '';
          return {
            id: e.id,
            name: e.name,
            type: e.type,
            author: authorInfo,
            description: e.description?.substring(0, 100)
          };
        });

        console.log(`[extract-relationships] Loaded ${candidatesList.length} candidates (types: ${allowedTypes.join(', ')})`);


        // Combine initial review + all timeline updates
        let combinedText = '';

        const initialText = `${review.title || ''} ${review.description || ''}`.trim();
        if (initialText) {
          combinedText += `Initial Review: ${initialText}`;
          if (review.rating) {
            combinedText += ` (Rating: ${review.rating}/5)`;
          }
        }

        if (review.review_updates && review.review_updates.length > 0) {
          const sortedUpdates = review.review_updates.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          sortedUpdates.forEach((update, idx) => {
            if (update.comment && update.comment.trim()) {
              combinedText += `\n\nUpdate ${idx + 1}: ${update.comment.trim()}`;
              if (update.rating) {
                combinedText += ` (Rating: ${update.rating}/5)`;
              }
            }
          });
        }

        // Apply 20-character minimum threshold (to capture short timeline updates like "switched to Y")
        if (combinedText.length < 20) {
          console.log(`[extract-relationships] Skipping review ${review.id} - too short (${combinedText.length} chars)`);
          skippedCount++;
          continue;
        }

        console.log(`[extract-relationships] Analyzing review ${review.id} (${combinedText.length} chars, ${review.review_updates?.length || 0} updates)`);

        // Call Gemini API with candidates list
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Analyze this product review timeline and extract product relationships.

Review Timeline:
"""
${combinedText}
"""

Available Entities in System:
"""
${JSON.stringify(candidatesList, null, 2)}
"""

CRITICAL RULES:
1. You MUST select target entities ONLY from the "Available Entities" list above
2. NEVER hallucinate or invent new entity names
3. Use the entity's ID, name, author, and description to disambiguate
4. ALWAYS prefer original works over summaries/study guides unless explicitly mentioned
5. If a review mentions a product and you see both the original and a "Summary of..." version, choose the ORIGINAL

Relationship Types:
- **upgrade**: User switched from one product to another
- **alternative**: User compared products as alternatives
- **complementary**: Products used together

Return JSON array with this EXACT schema:
[
  {
    "target_entity_id": "UUID from Available Entities list",
    "target_entity_name": "Name for logging purposes",
    "relationship_type": "upgrade" | "alternative" | "complementary",
    "confidence": 0.0-1.0,
    "evidence_quote": "Exact quote from review"
  }
]

Requirements:
- Confidence 0.8+ if relationship is very clear
- Confidence 0.5-0.7 if somewhat implied
- Maximum 5 relationships per review
- If no relationships found, return: []
- RETURN ONLY JSON, no markdown, no explanation`
                }]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1500
              }
            })
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          throw new Error(`Gemini API error ${geminiResponse.status}: ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Try to parse JSON with error handling
        let relationships: ProductRelationship[] = [];
        try {
          relationships = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error(`[extract-relationships] JSON parse error for review ${review.id}:`);
          console.error(`[extract-relationships] Raw Gemini response:`);
          console.error(responseText);  // ✅ Log FULL raw response (not truncated)
          console.error(`[extract-relationships] Cleaned response:`);
          console.error(cleanedResponse);
          console.error(`[extract-relationships] Parse error: ${parseError.message}`);
          
          // Try to extract JSON array from text (fallback)
          const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              relationships = JSON.parse(jsonMatch[0]);
              console.log(`[extract-relationships] ✅ Recovered ${relationships.length} relationships using fallback parser`);
            } catch (fallbackError) {
              console.error(`[extract-relationships] Fallback parse also failed, skipping review`);
              continue; // Skip this review and continue with others
            }
          } else {
            console.error(`[extract-relationships] No JSON array found in response, skipping review`);
            continue;
          }
        }

        console.log(`[extract-relationships] Found ${relationships.length} potential relationships`);

        for (const rel of relationships) {
          // Filter by confidence threshold
          if (rel.confidence < 0.5) {
            console.log(`[extract-relationships] Skipping low confidence: ${rel.confidence} for ${rel.target_entity_name}`);
            continue;
          }

          // Validate that Gemini returned a valid entity ID from our candidates
          const candidateMatch = candidatesList.find(e => e.id === rel.target_entity_id);

          if (!candidateMatch) {
            console.log(`[extract-relationships] ⚠️ Invalid entity ID: ${rel.target_entity_id} for "${rel.target_entity_name}"`);
            console.log(`[extract-relationships] Gemini should only return IDs from the provided list`);
            continue;
          }

          // Fetch full entity details for display
          const { data: fullTargetEntity, error: targetError } = await supabaseClient
            .from('entities')
            .select('id, name, authors, venue, type')
            .eq('id', rel.target_entity_id)
            .single();

          if (targetError || !fullTargetEntity) {
            console.error(`[extract-relationships] Error fetching target entity:`, targetError);
            continue;
          }

          // Prevent self-references (double-check)
          if (fullTargetEntity.id === review.entity_id) {
            console.log(`[extract-relationships] ⚠️ Skipping self-reference: ${fullTargetEntity.name}`);
            continue;
          }

          const targetEntityName = buildEntityDisplayName(fullTargetEntity);

          console.log(`[extract-relationships] ✅ Matched: ${targetEntityName} (confidence: ${rel.confidence})`);

          // DRY RUN MODE
          if (dryRun) {
            extractedRelationships.push({
              preview: true,
              source_entity_id: review.entity_id,
              source_entity_name: sourceEntityName,
              target_entity_id: fullTargetEntity.id,
              target_entity_name: targetEntityName,
              relationship_type: rel.relationship_type,
              confidence: rel.confidence,
              evidence: rel.evidence_quote,
              matched_via: 'entity_id'
            });
            continue;
          }

          // LIVE MODE - Check for duplicates
          const { data: existingRel } = await supabaseClient
            .from('product_relationships')
            .select('id')
            .eq('entity_a_id', review.entity_id)
            .eq('entity_b_id', fullTargetEntity.id)
            .single();

          if (existingRel) {
            console.log(`[extract-relationships] Relationship already exists, skipping`);
            continue;
          }

          // Insert new relationship
          const { error: insertError } = await supabaseClient
            .from('product_relationships')
            .insert({
              entity_a_id: review.entity_id,
              entity_b_id: fullTargetEntity.id,
              relationship_type: rel.relationship_type,
              confidence_score: rel.confidence,
              evidence_text: rel.evidence_quote,
              discovered_from_user_id: review.user_id,
              metadata: {
                review_id: review.id,
                extracted_at: new Date().toISOString(),
                processing_mode: batchMode ? 'batch' : 'single',
                combined_text_length: combinedText.length,
                update_count: review.review_updates?.length || 0
              }
            });

          if (insertError) {
            if (insertError.code === '23505') {
              console.log(`[extract-relationships] Duplicate (unique constraint), skipping`);
            } else {
              console.error(`[extract-relationships] Insert error:`, insertError);
              errorCount++;
            }
          } else {
            extractedRelationships.push({
              source_entity_id: review.entity_id,
              source_entity_name: sourceEntityName,
              target_entity_id: fullTargetEntity.id,
              target_entity_name: targetEntityName,
              relationship_type: rel.relationship_type,
              confidence: rel.confidence,
              evidence: rel.evidence_quote
            });
            console.log(`[extract-relationships] ✅ Inserted: ${rel.relationship_type} → ${fullTargetEntity.name}`);
          }
        }

        processedCount++;

      } catch (error) {
        console.error(`[extract-relationships] Error processing review ${review.id}:`, error);
        errorCount++;
      }

      // Rate limiting: 500ms delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const result = {
      success: true,
      dryRun,
      processedReviews: processedCount,
      skippedReviews: skippedCount,
      extractedRelationships: extractedRelationships.length,
      relationships: extractedRelationships,
      errors: errorCount
    };

    console.log(`[extract-relationships] Completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[extract-relationships] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
