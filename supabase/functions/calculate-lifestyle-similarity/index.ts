import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Richness classification thresholds
const RICH_THRESHOLDS = { stuff: 20, journeys: 5, routines: 1 };
const MODERATE_THRESHOLDS = { stuff: 5, reviews: 5 };

// Full weights for RICH mode
const FULL_WEIGHTS = {
  stuff_overlap: 0.30,
  routines_similarity: 0.20,
  journey_alignment: 0.20,
  rating_patterns: 0.15,
  category_preferences: 0.15
};

type RichnessLevel = 'RICH' | 'MODERATE' | 'SPARSE';

interface UserDataCounts {
  stuffCount: number;
  journeysCount: number;
  routinesCount: number;
  reviewsCount: number;
}

interface AvailableData {
  hasStuff: boolean;
  hasRoutines: boolean;
  hasJourneys: boolean;
  hasRatings: boolean;
  hasCategories: boolean;
}

interface DynamicWeights {
  stuff_overlap: number;
  routines_similarity: number;
  journey_alignment: number;
  rating_patterns: number;
  category_preferences: number;
}

// Classify user data richness
async function classifyUserDataRichness(
  supabaseClient: any,
  userId: string
): Promise<{ richness: RichnessLevel; counts: UserDataCounts }> {
  console.log(`[Phase4] Classifying data richness for user ${userId}`);
  
  const [stuffResult, journeysResult, routinesResult, reviewsResult] = await Promise.all([
    supabaseClient.from('user_stuff').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('user_entity_journeys').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('user_routines').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  const counts: UserDataCounts = {
    stuffCount: stuffResult.count || 0,
    journeysCount: journeysResult.count || 0,
    routinesCount: routinesResult.count || 0,
    reviewsCount: reviewsResult.count || 0
  };

  console.log(`[Phase4] User ${userId} counts:`, counts);

  // RICH: Full lifestyle engine
  if (counts.stuffCount >= RICH_THRESHOLDS.stuff && 
      counts.journeysCount >= RICH_THRESHOLDS.journeys && 
      counts.routinesCount >= RICH_THRESHOLDS.routines) {
    return { richness: 'RICH', counts };
  }
  
  // MODERATE: Partial weighted similarity
  if (counts.stuffCount >= MODERATE_THRESHOLDS.stuff || counts.reviewsCount >= MODERATE_THRESHOLDS.reviews) {
    return { richness: 'MODERATE', counts };
  }
  
  // SPARSE: Fallback to rating-based only
  return { richness: 'SPARSE', counts };
}

// Get minimum richness level between two users
function getMinRichness(a: RichnessLevel, b: RichnessLevel): RichnessLevel {
  const levels: RichnessLevel[] = ['SPARSE', 'MODERATE', 'RICH'];
  const indexA = levels.indexOf(a);
  const indexB = levels.indexOf(b);
  return levels[Math.min(indexA, indexB)];
}

// Check available data for both users
async function checkAvailableData(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<AvailableData> {
  const [stuffA, stuffB, routinesA, routinesB, journeysA, journeysB, reviewsA, reviewsB] = await Promise.all([
    supabaseClient.from('user_stuff').select('id', { count: 'exact', head: true }).eq('user_id', userAId),
    supabaseClient.from('user_stuff').select('id', { count: 'exact', head: true }).eq('user_id', userBId),
    supabaseClient.from('user_routines').select('id', { count: 'exact', head: true }).eq('user_id', userAId),
    supabaseClient.from('user_routines').select('id', { count: 'exact', head: true }).eq('user_id', userBId),
    supabaseClient.from('user_entity_journeys').select('id', { count: 'exact', head: true }).eq('user_id', userAId),
    supabaseClient.from('user_entity_journeys').select('id', { count: 'exact', head: true }).eq('user_id', userBId),
    supabaseClient.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userAId),
    supabaseClient.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userBId)
  ]);

  return {
    hasStuff: (stuffA.count || 0) > 0 && (stuffB.count || 0) > 0,
    hasRoutines: (routinesA.count || 0) > 0 && (routinesB.count || 0) > 0,
    hasJourneys: (journeysA.count || 0) > 0 && (journeysB.count || 0) > 0,
    hasRatings: (reviewsA.count || 0) > 0 && (reviewsB.count || 0) > 0,
    hasCategories: true // Always available via reviews/stuff
  };
}

// Get dynamic weights based on richness and available data
function getDynamicWeights(richness: RichnessLevel, availableData: AvailableData): DynamicWeights {
  if (richness === 'RICH') {
    return { ...FULL_WEIGHTS };
  }

  if (richness === 'MODERATE') {
    let weights = { ...FULL_WEIGHTS };
    let redistributePool = 0;
    let availableDimensions: (keyof DynamicWeights)[] = ['rating_patterns', 'category_preferences'];

    if (!availableData.hasRoutines) {
      redistributePool += weights.routines_similarity;
      weights.routines_similarity = 0;
    } else {
      availableDimensions.push('routines_similarity');
    }

    if (!availableData.hasJourneys) {
      redistributePool += weights.journey_alignment;
      weights.journey_alignment = 0;
    } else {
      availableDimensions.push('journey_alignment');
    }

    if (!availableData.hasStuff) {
      redistributePool += weights.stuff_overlap;
      weights.stuff_overlap = 0;
    } else {
      availableDimensions.push('stuff_overlap');
    }

    // Redistribute to available dimensions
    const perDimension = redistributePool / availableDimensions.length;
    availableDimensions.forEach(dim => {
      weights[dim] += perDimension;
    });

    return weights;
  }

  // SPARSE: Rating patterns and categories only
  return {
    stuff_overlap: 0,
    routines_similarity: 0,
    journey_alignment: 0,
    rating_patterns: 0.60,
    category_preferences: 0.40
  };
}

// Calculate stuff overlap between two users
async function calculateStuffOverlap(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<{ score: number; commonEntities: string[]; commonCategories: string[] }> {
  const [stuffA, stuffB] = await Promise.all([
    supabaseClient.from('user_stuff').select('entity_id, status, sentiment_score, category').eq('user_id', userAId),
    supabaseClient.from('user_stuff').select('entity_id, status, sentiment_score, category').eq('user_id', userBId)
  ]);

  const entitiesA = new Set(stuffA.data?.map((s: any) => s.entity_id) || []);
  const entitiesB = new Set(stuffB.data?.map((s: any) => s.entity_id) || []);
  
  const intersection = [...entitiesA].filter(id => entitiesB.has(id));
  const union = new Set([...entitiesA, ...entitiesB]);

  if (union.size === 0) return { score: 0, commonEntities: [], commonCategories: [] };

  // Base Jaccard similarity
  let jaccardScore = intersection.length / union.size;

  // Boost for status alignment and sentiment alignment
  let statusBoost = 0;
  let sentimentBoost = 0;
  const stuffAMap = new Map(stuffA.data?.map((s: any) => [s.entity_id, s]) || []);
  const stuffBMap = new Map(stuffB.data?.map((s: any) => [s.entity_id, s]) || []);

  intersection.forEach(entityId => {
    const itemA = stuffAMap.get(entityId);
    const itemB = stuffBMap.get(entityId);
    if (itemA && itemB) {
      if (itemA.status === itemB.status) statusBoost += 0.1;
      const sentimentDiff = Math.abs((itemA.sentiment_score || 0) - (itemB.sentiment_score || 0));
      if (sentimentDiff <= 2) sentimentBoost += 0.05;
    }
  });

  // Category overlap
  const categoriesA = new Set(stuffA.data?.map((s: any) => s.category).filter(Boolean) || []);
  const categoriesB = new Set(stuffB.data?.map((s: any) => s.category).filter(Boolean) || []);
  const commonCategories = [...categoriesA].filter(c => categoriesB.has(c));

  const finalScore = Math.min(1, jaccardScore + statusBoost + sentimentBoost);

  return {
    score: finalScore,
    commonEntities: intersection,
    commonCategories
  };
}

// Calculate routines similarity between two users
async function calculateRoutinesSimilarity(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<{ score: number; commonCategories: string[] }> {
  const [routinesA, routinesB] = await Promise.all([
    supabaseClient.from('user_routines').select('category, frequency, steps').eq('user_id', userAId),
    supabaseClient.from('user_routines').select('category, frequency, steps').eq('user_id', userBId)
  ]);

  if (!routinesA.data?.length || !routinesB.data?.length) {
    return { score: 0, commonCategories: [] };
  }

  const categoriesA = new Set(routinesA.data.map((r: any) => r.category));
  const categoriesB = new Set(routinesB.data.map((r: any) => r.category));
  const commonCategories = [...categoriesA].filter(c => categoriesB.has(c));

  if (commonCategories.length === 0) return { score: 0, commonCategories: [] };

  let categoryScore = commonCategories.length / Math.max(categoriesA.size, categoriesB.size);
  
  // Frequency match bonus
  let frequencyBonus = 0;
  commonCategories.forEach(category => {
    const routineA = routinesA.data.find((r: any) => r.category === category);
    const routineB = routinesB.data.find((r: any) => r.category === category);
    if (routineA?.frequency === routineB?.frequency) frequencyBonus += 0.1;
  });

  // Entity overlap in steps bonus
  let entityOverlapBonus = 0;
  const allStepEntitiesA = new Set<string>();
  const allStepEntitiesB = new Set<string>();
  
  routinesA.data.forEach((r: any) => {
    (r.steps || []).forEach((s: any) => {
      if (s.entity_id) allStepEntitiesA.add(s.entity_id);
    });
  });
  
  routinesB.data.forEach((r: any) => {
    (r.steps || []).forEach((s: any) => {
      if (s.entity_id) allStepEntitiesB.add(s.entity_id);
    });
  });

  const commonStepEntities = [...allStepEntitiesA].filter(e => allStepEntitiesB.has(e));
  if (commonStepEntities.length > 0) {
    entityOverlapBonus = Math.min(0.2, commonStepEntities.length * 0.05);
  }

  return {
    score: Math.min(1, categoryScore + frequencyBonus + entityOverlapBonus),
    commonCategories
  };
}

// Calculate journey alignment between two users
async function calculateJourneyAlignment(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<{ score: number; identicalJourneys: number; divergentPaths: number }> {
  const [journeysA, journeysB] = await Promise.all([
    supabaseClient.from('user_entity_journeys').select('from_entity_id, to_entity_id, transition_type').eq('user_id', userAId),
    supabaseClient.from('user_entity_journeys').select('from_entity_id, to_entity_id, transition_type').eq('user_id', userBId)
  ]);

  if (!journeysA.data?.length || !journeysB.data?.length) {
    return { score: 0, identicalJourneys: 0, divergentPaths: 0 };
  }

  let identicalJourneys = 0;
  let divergentPaths = 0;
  let transitionTypeMatches = 0;

  // Create journey maps
  const journeysAMap = new Map<string, Set<string>>();
  journeysA.data.forEach((j: any) => {
    if (!journeysAMap.has(j.from_entity_id)) {
      journeysAMap.set(j.from_entity_id, new Set());
    }
    journeysAMap.get(j.from_entity_id)!.add(j.to_entity_id);
  });

  const journeysBMap = new Map<string, Set<string>>();
  journeysB.data.forEach((j: any) => {
    if (!journeysBMap.has(j.from_entity_id)) {
      journeysBMap.set(j.from_entity_id, new Set());
    }
    journeysBMap.get(j.from_entity_id)!.add(j.to_entity_id);
  });

  // Find identical journeys and divergent paths
  journeysAMap.forEach((toEntitiesA, fromEntityId) => {
    if (journeysBMap.has(fromEntityId)) {
      const toEntitiesB = journeysBMap.get(fromEntityId)!;
      toEntitiesA.forEach(toId => {
        if (toEntitiesB.has(toId)) {
          identicalJourneys++;
        } else {
          divergentPaths++;
        }
      });
    }
  });

  // Count transition type matches
  const typesA = new Map<string, number>();
  const typesB = new Map<string, number>();
  
  journeysA.data.forEach((j: any) => {
    typesA.set(j.transition_type, (typesA.get(j.transition_type) || 0) + 1);
  });
  journeysB.data.forEach((j: any) => {
    typesB.set(j.transition_type, (typesB.get(j.transition_type) || 0) + 1);
  });

  // Calculate type pattern similarity
  const allTypes = new Set([...typesA.keys(), ...typesB.keys()]);
  let typeSimilarity = 0;
  allTypes.forEach(type => {
    const countA = typesA.get(type) || 0;
    const countB = typesB.get(type) || 0;
    typeSimilarity += Math.min(countA, countB) / Math.max(countA, countB, 1);
  });
  typeSimilarity /= allTypes.size || 1;

  // Calculate final score
  const identicalScore = identicalJourneys * 0.3;
  const divergentScore = divergentPaths * 0.1; // Exploring same space is still valuable
  const typeScore = typeSimilarity * 0.2;

  return {
    score: Math.min(1, identicalScore + divergentScore + typeScore),
    identicalJourneys,
    divergentPaths
  };
}

// Calculate rating patterns using existing DB function
async function calculateRatingPatterns(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<number> {
  const { data: similarityResult, error } = await supabaseClient
    .rpc('calculate_user_similarity', {
      user_a_id: userAId,
      user_b_id: userBId
    });

  if (error) {
    console.error('[Phase4] Error calculating rating patterns:', error);
    return 0;
  }

  return similarityResult || 0;
}

// Calculate category preferences similarity
async function calculateCategoryPreferences(
  supabaseClient: any,
  userAId: string,
  userBId: string
): Promise<number> {
  // Get category distribution from reviews and stuff
  const [reviewsA, reviewsB, stuffA, stuffB] = await Promise.all([
    supabaseClient.from('reviews').select('category').eq('user_id', userAId),
    supabaseClient.from('reviews').select('category').eq('user_id', userBId),
    supabaseClient.from('user_stuff').select('category').eq('user_id', userAId),
    supabaseClient.from('user_stuff').select('category').eq('user_id', userBId)
  ]);

  // Build category vectors
  const categoriesA: Record<string, number> = {};
  const categoriesB: Record<string, number> = {};

  [...(reviewsA.data || []), ...(stuffA.data || [])].forEach((item: any) => {
    if (item.category) {
      categoriesA[item.category] = (categoriesA[item.category] || 0) + 1;
    }
  });

  [...(reviewsB.data || []), ...(stuffB.data || [])].forEach((item: any) => {
    if (item.category) {
      categoriesB[item.category] = (categoriesB[item.category] || 0) + 1;
    }
  });

  // Normalize vectors
  const totalA = Object.values(categoriesA).reduce((a, b) => a + b, 0) || 1;
  const totalB = Object.values(categoriesB).reduce((a, b) => a + b, 0) || 1;

  Object.keys(categoriesA).forEach(k => categoriesA[k] /= totalA);
  Object.keys(categoriesB).forEach(k => categoriesB[k] /= totalB);

  // Cosine similarity
  const allCategories = new Set([...Object.keys(categoriesA), ...Object.keys(categoriesB)]);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  allCategories.forEach(cat => {
    const valA = categoriesA[cat] || 0;
    const valB = categoriesB[cat] || 0;
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  });

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);
  console.log(`[Phase4][${runId}] Starting calculate-lifestyle-similarity`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { userId, limit = 20, forceRecalculate = false } = await req.json();

    if (!userId) {
      throw new Error('userId is required');
    }

    console.log(`[Phase4][${runId}] Calculating similarities for user ${userId}, limit: ${limit}`);

    // Classify target user's data richness
    const { richness: userRichness, counts: userCounts } = await classifyUserDataRichness(supabaseClient, userId);
    console.log(`[Phase4][${runId}] User ${userId} richness: ${userRichness}`, userCounts);

    // Get candidate users to compare against
    const { data: candidateUsers, error: candidateError } = await supabaseClient
      .from('profiles')
      .select('id')
      .neq('id', userId)
      .limit(100);

    if (candidateError) throw candidateError;
    if (!candidateUsers?.length) {
      console.log(`[Phase4][${runId}] No candidate users found`);
      return new Response(JSON.stringify({ 
        success: true, 
        similaritiesCalculated: 0,
        mode: userRichness 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Phase4][${runId}] Found ${candidateUsers.length} candidate users`);

    const similarities: any[] = [];
    let processedCount = 0;

    for (const candidate of candidateUsers) {
      const candidateId = candidate.id;
      
      // Classify candidate's richness
      const { richness: candidateRichness, counts: candidateCounts } = 
        await classifyUserDataRichness(supabaseClient, candidateId);

      // Use minimum richness level
      const effectiveRichness = getMinRichness(userRichness, candidateRichness);
      
      // Check available data for this pair
      const availableData = await checkAvailableData(supabaseClient, userId, candidateId);
      
      // Get dynamic weights
      const weights = getDynamicWeights(effectiveRichness, availableData);
      
      console.log(`[Phase4][${runId}] Comparing ${userId} <-> ${candidateId}, mode: ${effectiveRichness}`);

      // Calculate each dimension based on weights
      const scores: Record<string, number> = {};
      const details: Record<string, any> = {};

      if (weights.stuff_overlap > 0) {
        const stuffResult = await calculateStuffOverlap(supabaseClient, userId, candidateId);
        scores.stuff_overlap = stuffResult.score;
        details.stuff_overlap = stuffResult;
      }

      if (weights.routines_similarity > 0) {
        const routinesResult = await calculateRoutinesSimilarity(supabaseClient, userId, candidateId);
        scores.routines_similarity = routinesResult.score;
        details.routines_similarity = routinesResult;
      }

      if (weights.journey_alignment > 0) {
        const journeyResult = await calculateJourneyAlignment(supabaseClient, userId, candidateId);
        scores.journey_alignment = journeyResult.score;
        details.journey_alignment = journeyResult;
      }

      if (weights.rating_patterns > 0) {
        scores.rating_patterns = await calculateRatingPatterns(supabaseClient, userId, candidateId);
      }

      if (weights.category_preferences > 0) {
        scores.category_preferences = await calculateCategoryPreferences(supabaseClient, userId, candidateId);
      }

      // Calculate weighted overall score
      let overallScore = 0;
      Object.entries(weights).forEach(([key, weight]) => {
        const score = scores[key] || 0;
        overallScore += score * weight;
      });

      // Calculate lifestyle score (routines + categories weighted higher)
      const lifestyleScore = (
        (scores.routines_similarity || 0) * 0.5 +
        (scores.category_preferences || 0) * 0.5
      );

      // Only store meaningful similarities
      if (overallScore > 0.01) {
        const similarityData = {
          user_a_id: userId,
          user_b_id: candidateId,
          similarity_type: 'lifestyle',
          similarity_score: overallScore,
          overall_score: overallScore,
          lifestyle_score: lifestyleScore,
          category_overlap: scores.category_preferences || 0,
          journey_alignment: scores.journey_alignment || 0,
          stuff_overlap: details.stuff_overlap || { score: 0, commonEntities: [], commonCategories: [] },
          routines_similarity: details.routines_similarity || { score: 0, commonCategories: [] },
          calculation_metadata: {
            richness_a: userRichness,
            richness_b: candidateRichness,
            effective_mode: effectiveRichness,
            weights_used: weights,
            scores: scores,
            calculated_at: new Date().toISOString()
          },
          last_calculated: new Date().toISOString()
        };

        const { error: upsertError } = await supabaseClient
          .from('user_similarities')
          .upsert(similarityData, {
            onConflict: 'user_a_id,user_b_id,similarity_type'
          });

        if (upsertError) {
          console.error(`[Phase4][${runId}] Error upserting similarity:`, upsertError);
        } else {
          similarities.push({ 
            candidateId, 
            overallScore, 
            mode: effectiveRichness 
          });
        }
      }

      processedCount++;
      
      // Limit processed users
      if (processedCount >= limit) break;
    }

    // Sort by score and return top results
    similarities.sort((a, b) => b.overallScore - a.overallScore);

    console.log(`[Phase4][${runId}] Completed. Calculated ${similarities.length} similarities`);

    return new Response(JSON.stringify({
      success: true,
      similaritiesCalculated: similarities.length,
      processedUsers: processedCount,
      userMode: userRichness,
      userCounts,
      topSimilarities: similarities.slice(0, 10)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[Phase4][${runId}] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
