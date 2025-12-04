import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Version tag for identifying Phase 3 journey tracking in logs
const MATCHING_MODE = 'entity_id_v1';
const PHASE_TAG = '[Phase3]';

interface ProductRelationship {
  target_entity_id: string;
  target_entity_name: string;
  relationship_type: 'upgrade' | 'alternative' | 'complementary';
  confidence: number;
  evidence_quote: string;
}

// Helper function to build entity display names with fallback logic
function buildEntityDisplayName(entity: any): string {
  if (!entity) return 'Unknown Entity';
  
  if (entity.authors && Array.isArray(entity.authors) && entity.authors.length > 0) {
    return `${entity.name} by ${entity.authors.join(', ')}`;
  }
  
  if (entity.venue) {
    return `${entity.name} by ${entity.venue}`;
  }
  
  return entity.name;
}

/**
 * Get candidate entity types based on source entity type
 */
function getCandidateTypes(sourceType: string): string[] {
  const typeMap: Record<string, string[]> = {
    'book': ['book'],
    'movie': ['movie'],
    'place': ['place'],
    'product': ['product', 'brand'],
    'brand': ['brand', 'product'],
  };
  
  return typeMap[sourceType] || [sourceType];
}

/**
 * Convert rating (1-5) to sentiment score (-5 to +5)
 */
function ratingToSentiment(rating: number): number {
  return Math.round((rating - 3) * 2.5);
}

/**
 * Infer user_stuff status from rating
 */
function inferStatusFromRating(rating: number): string {
  if (rating >= 4) return 'currently_using';
  if (rating >= 3) return 'used_before';
  return 'stopped';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().substring(0, 8);

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

    console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ${PHASE_TAG} Starting - mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, batch: ${batchMode}, limit: ${limit}`);

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
          console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Skipping ${processedReviewIds.size} already processed reviews`);
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

    console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Processing ${reviewsToProcess.length} reviews`);

    const extractedRelationships: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let stuffPopulated = 0;
    let journeysCreated = 0;
    let consensusUpdated = 0;

    for (const review of reviewsToProcess) {
      try {
        // Fetch source entity details
        const { data: sourceEntity, error: entityError } = await supabaseClient
          .from('entities')
          .select('id, name, type, authors, venue')
          .eq('id', review.entity_id)
          .single();

        if (entityError || !sourceEntity) {
          console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Source entity not found: ${review.entity_id}`);
          continue;
        }

        const sourceEntityName = buildEntityDisplayName(sourceEntity);

        // ========================================
        // PHASE 3.1: Auto-populate user_stuff
        // ========================================
        if (!dryRun && review.user_id) {
          const stuffStatus = inferStatusFromRating(review.rating || 3);
          const sentimentScore = ratingToSentiment(review.rating || 3);

          // Check if already exists in user_stuff
          const { data: existingStuff } = await supabaseClient
            .from('user_stuff')
            .select('id')
            .eq('user_id', review.user_id)
            .eq('entity_id', review.entity_id)
            .maybeSingle();

          if (!existingStuff) {
            const { error: stuffError } = await supabaseClient
              .from('user_stuff')
              .insert({
                user_id: review.user_id,
                entity_id: review.entity_id,
                status: stuffStatus,
                sentiment_score: sentimentScore,
                entity_type: sourceEntity.type,
                category: sourceEntity.type,
                source: 'auto_review',
                source_reference_id: review.id,
                started_using_at: new Date().toISOString()
              });

            if (stuffError) {
              console.error(`${PHASE_TAG}[runId=${runId}] Error populating user_stuff:`, stuffError);
            } else {
              stuffPopulated++;
              console.log(`${PHASE_TAG}[runId=${runId}] Auto-populated user_stuff: ${sourceEntityName} (status: ${stuffStatus}, sentiment: ${sentimentScore})`);
            }
          }
        }

        // Get allowed candidate types for this source entity
        const allowedTypes = getCandidateTypes(sourceEntity.type);
        console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Fetching candidates of types: ${allowedTypes.join(', ')}`);

        // Fetch type-filtered candidate entities
        const { data: candidateEntities, error: candidatesError } = await supabaseClient
          .from('entities')
          .select('id, name, type, authors, venue, description, popularity_score')
          .eq('is_deleted', false)
          .neq('id', review.entity_id)
          .in('type', allowedTypes)
          .order('popularity_score', { ascending: false })
          .limit(300);

        if (candidatesError) {
          console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Error fetching candidates:`, candidatesError);
          continue;
        }

        // Format candidates for Gemini
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

        console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Loaded ${candidatesList.length} candidates (types: ${allowedTypes.join(', ')})`);

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

        // Apply 20-character minimum threshold
        if (combinedText.length < 20) {
          console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Skipping review ${review.id} - too short (${combinedText.length} chars)`);
          skippedCount++;
          continue;
        }

        console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Analyzing review ${review.id} (${combinedText.length} chars, ${review.review_updates?.length || 0} updates)`);

        // Generate deterministic seed from review ID
        const reviewSeed = parseInt(review.id.replace(/-/g, '').substring(0, 8), 16) % 2147483647;

        // Define strict response schema
        const responseSchema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              target_entity_id: {
                type: "string",
                description: "UUID of the target entity from the Available Entities list"
              },
              target_entity_name: {
                type: "string",
                description: "Name of the target entity for logging"
              },
              relationship_type: {
                type: "string",
                enum: ["upgrade", "alternative", "complementary"]
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1
              },
              evidence_quote: {
                type: "string",
                description: "Exact quote from the review supporting this relationship"
              }
            },
            required: ["target_entity_id", "target_entity_name", "relationship_type", "confidence", "evidence_quote"]
          }
        };

        // Call Gemini API
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
1. You MUST select target entities ONLY from the "Available Entities" list above using their exact "id" values
2. NEVER invent, hallucinate, or return entity IDs that are not in the list
3. If you cannot confidently match an entity from the list, return an empty array []
4. Use the entity's ID, name, author, and description to disambiguate
5. ALWAYS prefer original works over summaries/study guides unless explicitly mentioned
6. If a review mentions a product and you see both the original and a "Summary of..." version, choose the ORIGINAL
7. Return ONLY valid JSON with entity IDs from the list - no free text names allowed

EXTRACTION RULES (BE CONSISTENT):
1. If a review says "X is better than Y" or "I prefer X over Y" → ALWAYS extract as "alternative"
2. If a review says "read X after Y" or "X complements Y" → ALWAYS extract as "complementary"
3. If a review says "switched from X to Y" or "replaced X with Y" → ALWAYS extract as "upgrade"
4. If relationship type is ambiguous, default to "complementary"
5. For confidence: clear explicit mentions = 0.9, implied mentions = 0.7, weak signals = 0.5
6. Extract ALL relationships that match these criteria - do not randomly skip some

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
                temperature: 0,
                seed: reviewSeed,
                maxOutputTokens: 1500,
                responseMimeType: 'application/json',
                responseSchema: responseSchema
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

        console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Gemini raw response:`, responseText.substring(0, 500));

        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Parse JSON with error handling
        let relationships: ProductRelationship[] = [];
        try {
          relationships = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] JSON parse error for review ${review.id}:`);
          console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Raw Gemini response:`, responseText);
          console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Cleaned response:`, cleanedResponse);
          
          const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              relationships = JSON.parse(jsonMatch[0]);
              console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ✅ Recovered ${relationships.length} relationships using fallback parser`);
            } catch (fallbackError) {
              console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Fallback parse also failed, skipping review`);
              continue;
            }
          } else {
            console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] No JSON array found in response, skipping review`);
            continue;
          }
        }

        console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Found ${relationships.length} potential relationships`);

        for (const rel of relationships) {
          // Validate required fields
          if (!rel.target_entity_id || typeof rel.target_entity_id !== 'string') {
            console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ⚠️ Invalid or missing target_entity_id from model - skipping relationship`);
            continue;
          }

          // Filter by confidence threshold
          if (rel.confidence < 0.5) {
            console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Skipping low confidence: ${rel.confidence} for ${rel.target_entity_name}`);
            continue;
          }

          // Validate entity ID from candidates
          const candidateMatch = candidatesList.find(e => e.id === rel.target_entity_id);

          if (!candidateMatch) {
            console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ⚠️ Invalid entity_id returned by model: ${rel.target_entity_id} - ID not in candidate list, skipping`);
            continue;
          }

          // Fetch full entity details
          const { data: fullTargetEntity, error: targetError } = await supabaseClient
            .from('entities')
            .select('id, name, authors, venue, type')
            .eq('id', rel.target_entity_id)
            .single();

          if (targetError || !fullTargetEntity) {
            console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Error fetching target entity:`, targetError);
            continue;
          }

          // Prevent self-references
          if (fullTargetEntity.id === review.entity_id) {
            console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ⚠️ Model returned source entity ID as target - skipping self-reference`);
            continue;
          }

          const targetEntityName = buildEntityDisplayName(fullTargetEntity);

          console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ✅ Matched: ${targetEntityName} (confidence: ${rel.confidence})`);

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

          // ========================================
          // PHASE 3.2: Write to user_entity_journeys
          // ========================================
          const fromSentiment = ratingToSentiment(review.rating || 3);
          // For upgrades, assume improved sentiment; for alternatives, keep same
          const toSentiment = rel.relationship_type === 'upgrade' 
            ? Math.min(fromSentiment + 2, 5) 
            : fromSentiment;

          // Check if journey already exists for this user
          const { data: existingJourney } = await supabaseClient
            .from('user_entity_journeys')
            .select('id')
            .eq('user_id', review.user_id)
            .eq('from_entity_id', review.entity_id)
            .eq('to_entity_id', fullTargetEntity.id)
            .maybeSingle();

          if (!existingJourney) {
            const { error: journeyError } = await supabaseClient
              .from('user_entity_journeys')
              .insert({
                user_id: review.user_id,
                from_entity_id: review.entity_id,
                to_entity_id: fullTargetEntity.id,
                from_category: sourceEntity.type,
                to_category: fullTargetEntity.type,
                from_entity_type: sourceEntity.type,
                to_entity_type: fullTargetEntity.type,
                transition_type: rel.relationship_type,
                from_sentiment: fromSentiment,
                to_sentiment: toSentiment,
                evidence_text: rel.evidence_quote,
                source_review_id: review.id,
                confidence: rel.confidence
              });

            if (journeyError) {
              console.error(`${PHASE_TAG}[runId=${runId}] Error creating journey:`, journeyError);
            } else {
              journeysCreated++;
              console.log(`${PHASE_TAG}[runId=${runId}] Created journey: ${sourceEntityName} → ${targetEntityName} (${rel.relationship_type})`);
            }
          }

          // ========================================
          // PHASE 3.3: Consensus tracking in product_relationships
          // ========================================
          const { data: existingRel } = await supabaseClient
            .from('product_relationships')
            .select('id, consensus_count, avg_confidence, confidence_score')
            .eq('entity_a_id', review.entity_id)
            .eq('entity_b_id', fullTargetEntity.id)
            .eq('relationship_type', rel.relationship_type)
            .maybeSingle();

          if (existingRel) {
            // Relationship exists - update consensus
            const currentConsensus = existingRel.consensus_count || 1;
            const currentAvgConfidence = existingRel.avg_confidence || existingRel.confidence_score || 0.5;
            
            const newCount = currentConsensus + 1;
            const newAvgConfidence = ((currentAvgConfidence * currentConsensus) + rel.confidence) / newCount;

            const { error: updateError } = await supabaseClient
              .from('product_relationships')
              .update({
                consensus_count: newCount,
                avg_confidence: newAvgConfidence,
                last_confirmed_at: new Date().toISOString(),
                confirmation_count: (existingRel.confirmation_count || 0) + 1
              })
              .eq('id', existingRel.id);

            if (updateError) {
              console.error(`${PHASE_TAG}[runId=${runId}] Error updating consensus:`, updateError);
            } else {
              consensusUpdated++;
              console.log(`${PHASE_TAG}[runId=${runId}] Updated consensus: ${newCount} users, avg confidence: ${newAvgConfidence.toFixed(2)}`);
            }

            extractedRelationships.push({
              source_entity_id: review.entity_id,
              source_entity_name: sourceEntityName,
              target_entity_id: fullTargetEntity.id,
              target_entity_name: targetEntityName,
              relationship_type: rel.relationship_type,
              confidence: rel.confidence,
              evidence: rel.evidence_quote,
              consensus_updated: true,
              new_consensus_count: newCount
            });
          } else {
            // New relationship - insert with initial consensus
            const { error: insertError } = await supabaseClient
              .from('product_relationships')
              .insert({
                entity_a_id: review.entity_id,
                entity_b_id: fullTargetEntity.id,
                relationship_type: rel.relationship_type,
                confidence_score: rel.confidence,
                evidence_text: rel.evidence_quote,
                discovered_from_user_id: review.user_id,
                consensus_count: 1,
                avg_confidence: rel.confidence,
                category: sourceEntity.type,
                metadata: {
                  review_id: review.id,
                  extracted_at: new Date().toISOString(),
                  processing_mode: batchMode ? 'batch' : 'single',
                  combined_text_length: combinedText.length,
                  update_count: review.review_updates?.length || 0,
                  matching_mode: MATCHING_MODE,
                  run_id: runId
                }
              });

            if (insertError) {
              if (insertError.code === '23505') {
                console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Duplicate (unique constraint), skipping`);
              } else {
                console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Insert error:`, insertError);
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
                evidence: rel.evidence_quote,
                new_relationship: true
              });
              console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ✅ Inserted new relationship: ${rel.relationship_type} → ${fullTargetEntity.name}`);
            }
          }
        }

        processedCount++;

      } catch (error) {
        console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Error processing review ${review.id}:`, error);
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
      errors: errorCount,
      runId,
      // Phase 3 metrics
      phase3: {
        stuffPopulated,
        journeysCreated,
        consensusUpdated
      }
    };

    console.log(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] ${PHASE_TAG} Completed:`, JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[extract-relationships][${MATCHING_MODE}][runId=${runId}] Fatal error:`, error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
