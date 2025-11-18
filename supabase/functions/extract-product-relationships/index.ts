import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductRelationship {
  target_product_name: string;
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
        // Fetch source entity details for display
        const { data: sourceEntity, error: entityError } = await supabaseClient
          .from('entities')
          .select('name, authors, venue')
          .eq('id', review.entity_id)
          .single();

        if (entityError) {
          console.error(`[extract-relationships] Error fetching source entity:`, entityError);
        }

        const sourceEntityName = buildEntityDisplayName(sourceEntity);

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
3. **Complementary**: Products used together (e.g., "I use this with X", "Pair with Y for best results", "Works great with X", "Use alongside X")

IMPORTANT:
- Only extract relationships where the user explicitly mentions another product by name
- Do not infer products that aren't explicitly mentioned
- Confidence should be 0.8+ if the relationship is very clear, 0.5-0.7 if somewhat implied
- Maximum 5 relationships per review

Return JSON array:
[
  {
    "target_product_name": "Full product name as mentioned in review",
    "relationship_type": "upgrade" | "alternative" | "complementary",
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
          // Filter by confidence threshold (minimum 0.5)
          if (rel.confidence < 0.5) {
            console.log(`[extract-relationships] Skipping low confidence: ${rel.confidence} for ${rel.target_product_name}`);
            continue;
          }

          // ============================================
          // NORMALIZE SUMMARY ENTITY NAMES
          // ============================================
          // Rule: ALWAYS strip "Summary of..." prefixes, regardless of review text
          // We NEVER want derivative/summary books as recommendation targets
          const extractedLower = rel.target_product_name.toLowerCase();

          if (extractedLower.startsWith('summary of') || extractedLower.startsWith('summary:')) {
            const originalName = rel.target_product_name;
            
            // Strip the summary prefix
            let normalized = rel.target_product_name
              .replace(/^summary of\s+/i, '')
              .replace(/^summary:\s*/i, '');
            
            // Extract core title (before " by author" if present)
            const byIndex = normalized.toLowerCase().indexOf(' by ');
            if (byIndex > 0) {
              normalized = normalized.substring(0, byIndex).trim();
            }
            
            // Remove known derivative author suffixes
            normalized = normalized
              .replace(/\s+by\s+quickread.*$/i, '')
              .replace(/\s+by\s+lea schullery.*$/i, '')
              .trim();
            
            rel.target_product_name = normalized;
            
            console.log(`[extract-relationships] 🧹 Normalized hallucinated entity name`);
            console.log(`[extract-relationships]   RAW: "${originalName}"`);
            console.log(`[extract-relationships]   CLEAN: "${rel.target_product_name}"`);
          }

          // Try exact match first
          let { data: matchingEntities } = await supabaseClient
            .from('entities')
            .select('id, name, type, authors, venue')
            .ilike('name', `%${rel.target_product_name}%`)
            .eq('is_deleted', false)
            .limit(10);

          // Fuzzy matching fallback
          if (!matchingEntities || matchingEntities.length === 0) {
            console.log(`[extract-relationships] No exact match for "${rel.target_product_name}", trying fuzzy match`);
            
            const { data: fuzzyMatches, error: fuzzyError } = await supabaseClient
              .rpc('fuzzy_match_entity', {
                target_name: rel.target_product_name,
                threshold: 0.3
              });

            if (!fuzzyError && fuzzyMatches && fuzzyMatches.length > 0) {
              matchingEntities = fuzzyMatches.slice(0, 10);
              console.log(`[extract-relationships] Fuzzy match found: ${matchingEntities[0].name} (score: ${fuzzyMatches[0].similarity_score})`);
            }
          }

          // Guard against hallucinated product names
          if (!matchingEntities || matchingEntities.length === 0) {
            console.log(`⚠️ No entity match found for "${rel.target_product_name}" — skipping (possible AI hallucination)`);
            continue;
          }

          // Sort matching entities to prefer original books over summaries/derivatives
          if (matchingEntities && matchingEntities.length > 1) {
            matchingEntities.sort((a, b) => {
              // Primary: Prefer entities WITHOUT "Summary of" or "Summary:" prefix
              const aIsSummary = a.name.toLowerCase().startsWith('summary of') || 
                                 a.name.toLowerCase().startsWith('summary:');
              const bIsSummary = b.name.toLowerCase().startsWith('summary of') || 
                                 b.name.toLowerCase().startsWith('summary:');
              
              if (aIsSummary && !bIsSummary) return 1;  // b wins (not a summary)
              if (!aIsSummary && bIsSummary) return -1; // a wins (not a summary)
              
              // Secondary: Prefer shorter names (usually the original)
              const lengthDiff = a.name.length - b.name.length;
              if (lengthDiff !== 0) return lengthDiff;
              
              // Tertiary: Prefer exact matches to extracted name
              const extractedLower = rel.target_product_name.toLowerCase();
              const aExact = a.name.toLowerCase() === extractedLower;
              const bExact = b.name.toLowerCase() === extractedLower;
              if (aExact && !bExact) return -1;
              if (!aExact && bExact) return 1;
              
              return 0;
            });
            
            console.log(`[extract-relationships] Multiple matches for "${rel.target_product_name}": found ${matchingEntities.length} candidates, selected "${matchingEntities[0].name}"`);
            if (matchingEntities.length > 1) {
              console.log(`[extract-relationships] Alternatives considered: ${matchingEntities.slice(1).map(e => e.name).join(', ')}`);
            }
          }

          const targetEntity = matchingEntities[0];

          // Verify we didn't accidentally select a summary entity
          if (targetEntity.name.toLowerCase().startsWith('summary of') || 
              targetEntity.name.toLowerCase().startsWith('summary:')) {
            console.log(`[extract-relationships] ⚠️ WARNING: Selected entity is still a summary: "${targetEntity.name}"`);
            console.log(`[extract-relationships] This may indicate a data quality issue in the entities table`);
          }

          // Prevent self-references (entity referring to itself)
          if (targetEntity.id === review.entity_id) {
            console.log(`⚠️ Skipping self-reference for entity: ${targetEntity.name}`);
            continue;
          }

          if (matchingEntities && matchingEntities.length > 0) {

            // DRY RUN MODE - Return preview only
            if (dryRun) {
              extractedRelationships.push({
                preview: true,
                source_entity_id: review.entity_id,
                source_entity_name: sourceEntityName,
                target_entity_id: targetEntity.id,
                target_entity_name: buildEntityDisplayName(targetEntity),
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
                source_entity_name: sourceEntityName,
                target_entity_id: targetEntity.id,
                target_entity_name: buildEntityDisplayName(targetEntity),
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
