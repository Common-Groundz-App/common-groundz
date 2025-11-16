import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductRelationship {
  target_product_name: string;
  relationship_type: 'upgrade' | 'alternative' | 'complement';
  confidence: number;
  evidence_quote: string;
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

        // Apply 50-character minimum threshold
        if (combinedText.length < 50) {
          console.log(`[extract-relationships] Skipping review ${review.id} - too short (${combinedText.length} chars)`);
          skippedCount++;
          continue;
        }

        console.log(`[extract-relationships] Analyzing review ${review.id} (${combinedText.length} chars, ${review.review_updates?.length || 0} updates)`);

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

Look for:
1. **Upgrades**: User switched from one product to another (e.g., "I upgraded from X to Y", "This replaced my old X", "Switched from X")
2. **Alternatives**: User compared products (e.g., "This is better than X", "X vs Y", "Instead of X I use Y", "Better than X")
3. **Complements**: Products used together (e.g., "I use this with X", "Pair with Y for best results", "Works great with X", "Use alongside X")

IMPORTANT:
- Only extract relationships where the user explicitly mentions another product by name
- Do not infer products that aren't explicitly mentioned
- Confidence should be 0.8+ if the relationship is very clear, 0.5-0.7 if somewhat implied
- Maximum 5 relationships per review

Return JSON array:
[
  {
    "target_product_name": "Full product name as mentioned in review",
    "relationship_type": "upgrade" | "alternative" | "complement",
    "confidence": 0.0-1.0,
    "evidence_quote": "Exact quote from review showing the relationship"
  }
]

If no relationships found, return: []

CRITICAL: Return ONLY the JSON array, no markdown code blocks, no explanation.`
                }]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1000
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

        const relationships: ProductRelationship[] = JSON.parse(cleanedResponse);

        console.log(`[extract-relationships] Found ${relationships.length} potential relationships`);

        for (const rel of relationships) {
          // Filter by confidence threshold (minimum 0.5)
          if (rel.confidence < 0.5) {
            console.log(`[extract-relationships] Skipping low confidence: ${rel.confidence} for ${rel.target_product_name}`);
            continue;
          }

          // Try exact match first
          let { data: matchingEntities } = await supabaseClient
            .from('entities')
            .select('id, name, type')
            .ilike('name', `%${rel.target_product_name}%`)
            .eq('is_deleted', false)
            .limit(3);

          // Fuzzy matching fallback
          if (!matchingEntities || matchingEntities.length === 0) {
            console.log(`[extract-relationships] No exact match for "${rel.target_product_name}", trying fuzzy match`);
            
            const { data: fuzzyMatches, error: fuzzyError } = await supabaseClient
              .rpc('fuzzy_match_entity', {
                target_name: rel.target_product_name,
                threshold: 0.3
              });

            if (!fuzzyError && fuzzyMatches && fuzzyMatches.length > 0) {
              matchingEntities = fuzzyMatches.slice(0, 3);
              console.log(`[extract-relationships] Fuzzy match found: ${matchingEntities[0].name} (score: ${fuzzyMatches[0].similarity_score})`);
            }
          }

          if (matchingEntities && matchingEntities.length > 0) {
            const targetEntity = matchingEntities[0];

            // DRY RUN MODE - Return preview only
            if (dryRun) {
              extractedRelationships.push({
                preview: true,
                source_entity_id: review.entity_id,
                target_entity_id: targetEntity.id,
                target_entity_name: targetEntity.name,
                relationship_type: rel.relationship_type,
                confidence: rel.confidence,
                evidence: rel.evidence_quote,
                matched_via: matchingEntities.length > 0 && matchingEntities[0].name !== rel.target_product_name ? 'fuzzy' : 'exact'
              });
              continue;
            }

            // LIVE MODE - Check for existing relationship
            const { data: existingRel } = await supabaseClient
              .from('product_relationships')
              .select('id')
              .eq('entity_a_id', review.entity_id)
              .eq('entity_b_id', targetEntity.id)
              .eq('relationship_type', rel.relationship_type)
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
                entity_b_id: targetEntity.id,
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
                target_entity_id: targetEntity.id,
                target_entity_name: targetEntity.name,
                relationship_type: rel.relationship_type,
                confidence: rel.confidence,
                evidence: rel.evidence_quote
              });
              console.log(`[extract-relationships] ✅ Inserted: ${rel.relationship_type} → ${targetEntity.name}`);
            }
          } else {
            console.log(`[extract-relationships] No matching entity found for: "${rel.target_product_name}"`);
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
