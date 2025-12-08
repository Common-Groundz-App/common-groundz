import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RichnessMode = 'RICH' | 'MODERATE' | 'SPARSE';

interface JourneyRichnessClassification {
  mode: RichnessMode;
  similarUsersCount: number;
  totalJourneys: number;
  entitySpecificJourneys: number;
  globalConsensusCount: number;
}

interface TransitionRecommendation {
  id: string;
  from_entity: {
    id: string;
    name: string;
    type: string;
    image_url: string | null;
  };
  to_entity: {
    id: string;
    name: string;
    type: string;
    image_url: string | null;
  };
  transition_type: 'upgrade' | 'alternative' | 'complementary';
  weighted_score: number;
  story: {
    headline: string;
    description: string;
    sentiment_change: string | null;
    evidence_quote: string | null;
  };
  relevance_score: number;
  confidence: 'high' | 'medium' | 'low';
  consensus_count: number;
}

interface UserStuffItem {
  entity_id: string;
  status: string;
  sentiment_score: number | null;
  category: string | null;
}

// Compute relevance score for a journey recommendation
function computeRelevanceScore(
  journey: {
    from_entity_id: string;
    to_entity_id: string;
    transition_type: string;
    from_sentiment: number | null;
    created_at: string;
    category?: string;
  },
  userStuff: UserStuffItem[],
  similarityScore: number,
  queryContext: { entityId?: string; category?: string }
): number {
  let score = 0;

  // 1. Status match: user has the from_entity in their stuff (+0.3)
  const userItem = userStuff.find(s => s.entity_id === journey.from_entity_id);
  if (userItem) {
    score += 0.3;
    
    // 2. Sentiment alignment: user is unhappy with from_entity (+0.2)
    if (userItem.sentiment_score !== null && userItem.sentiment_score <= 0) {
      score += 0.2;
    }
  }

  // 3. Category match (+0.2)
  if (queryContext.category && journey.category === queryContext.category) {
    score += 0.2;
  } else if (userItem?.category && journey.category === userItem.category) {
    score += 0.15;
  }

  // 4. Similarity score contribution (+0.2 max)
  score += (similarityScore || 0) * 0.2;

  // 5. Recency: journeys within last 30 days get boost (+0.1)
  const daysSinceTransition = (Date.now() - new Date(journey.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceTransition < 30) {
    score += 0.1;
  } else if (daysSinceTransition < 90) {
    score += 0.05;
  }

  return score;
}

// Classify journey data richness
function classifyJourneyRichness(
  similarUsersCount: number,
  totalJourneys: number,
  entitySpecificJourneys: number,
  globalConsensusCount: number
): JourneyRichnessClassification {
  let mode: RichnessMode;

  // RICH: Many similar users AND sufficient journeys
  if (similarUsersCount >= 5 && totalJourneys >= 10) {
    mode = 'RICH';
  }
  // MODERATE: Some similar users OR some journeys OR global consensus
  else if (similarUsersCount >= 2 || totalJourneys >= 3 || globalConsensusCount >= 5) {
    mode = 'MODERATE';
  }
  // SPARSE: Very little data
  else {
    mode = 'SPARSE';
  }

  return {
    mode,
    similarUsersCount,
    totalJourneys,
    entitySpecificJourneys,
    globalConsensusCount
  };
}

// Generate story based on mode and data
function generateStory(
  mode: RichnessMode,
  fromEntityName: string,
  toEntityName: string,
  transitionType: string,
  similarUserCount: number,
  sentimentBefore: number | null,
  sentimentAfter: number | null,
  evidenceText: string | null,
  lifestyleFactors: string[]
): TransitionRecommendation['story'] {
  const sentimentChange = sentimentBefore !== null && sentimentAfter !== null
    ? sentimentAfter - sentimentBefore
    : null;

  let headline: string;
  let description: string;
  let sentimentChangeText: string | null = null;

  if (sentimentChange !== null) {
    if (sentimentChange > 0) {
      sentimentChangeText = `+${sentimentChange} improvement`;
    } else if (sentimentChange < 0) {
      sentimentChangeText = `${sentimentChange} change`;
    } else {
      sentimentChangeText = 'Similar satisfaction';
    }
  }

  switch (mode) {
    case 'RICH':
      // Full personalized story
      if (transitionType === 'upgrade') {
        headline = `${similarUserCount} people like you upgraded to ${toEntityName}`;
      } else if (transitionType === 'alternative') {
        headline = `${similarUserCount} similar users also tried ${toEntityName}`;
      } else {
        headline = `Users who have ${fromEntityName} often pair it with ${toEntityName}`;
      }

      if (lifestyleFactors.length > 0) {
        description = `Users with similar ${lifestyleFactors.slice(0, 2).join(' and ')} made this switch`;
      } else {
        description = `People with similar taste made this change`;
      }
      break;

    case 'MODERATE':
      // Simplified story
      if (transitionType === 'upgrade') {
        headline = `Users upgraded to ${toEntityName}`;
      } else if (transitionType === 'alternative') {
        headline = `${toEntityName} is a popular alternative`;
      } else {
        headline = `Often used together with ${toEntityName}`;
      }
      description = 'Based on user journeys and preferences';
      break;

    case 'SPARSE':
    default:
      // Generic story from global data
      if (transitionType === 'upgrade') {
        headline = `Popular upgrade: ${toEntityName}`;
      } else if (transitionType === 'alternative') {
        headline = `Alternative option: ${toEntityName}`;
      } else {
        headline = `Frequently paired with ${toEntityName}`;
      }
      description = 'Based on community patterns';
      break;
  }

  return {
    headline,
    description,
    sentiment_change: sentimentChangeText,
    evidence_quote: mode === 'RICH' ? evidenceText : null
  };
}

// Map mode to confidence level
function modeToConfidence(mode: RichnessMode): 'high' | 'medium' | 'low' {
  switch (mode) {
    case 'RICH': return 'high';
    case 'MODERATE': return 'medium';
    case 'SPARSE': return 'low';
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);
  console.log(`[Phase5][${runId}] Starting get-personalized-transitions`);

  try {
    const { userId, entityId, transitionType, limit = 10 } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Phase5][${runId}] Request: userId=${userId}, entityId=${entityId || 'none'}, type=${transitionType || 'all'}, limit=${limit}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get similar users from user_similarities
    console.log(`[Phase5][${runId}] Fetching similar users...`);
    const { data: similarUsers, error: simError } = await supabase
      .from('user_similarities')
      .select('user_b_id, overall_score, lifestyle_score, stuff_overlap, routines_similarity, calculation_metadata')
      .eq('user_a_id', userId)
      .gt('overall_score', 0.1)
      .order('overall_score', { ascending: false })
      .limit(50);

    if (simError) {
      console.error(`[Phase5][${runId}] Error fetching similar users:`, simError);
    }

    const similarUserIds = similarUsers?.map(u => u.user_b_id) || [];
    console.log(`[Phase5][${runId}] Found ${similarUserIds.length} similar users`);

    // Step 2: Get user's current stuff with sentiment and category
    const { data: userStuff, error: stuffError } = await supabase
      .from('user_stuff')
      .select('entity_id, status, sentiment_score, category')
      .eq('user_id', userId);

    if (stuffError) {
      console.error(`[Phase5][${runId}] Error fetching user stuff:`, stuffError);
    }

    const userStuffItems: UserStuffItem[] = userStuff || [];
    const userEntityIds = userStuffItems.map(s => s.entity_id);
    console.log(`[Phase5][${runId}] User has ${userEntityIds.length} items in stuff`);

    // Query context for relevance scoring
    const queryContext = { entityId, category: undefined as string | undefined };

    // Step 3: Fetch journeys from similar users
    let journeyQuery = supabase
      .from('user_entity_journeys')
      .select(`
        id,
        user_id,
        from_entity_id,
        to_entity_id,
        transition_type,
        from_sentiment,
        to_sentiment,
        confidence,
        evidence_text,
        created_at,
        category
      `)
      .order('confidence', { ascending: false })
      .limit(100);

    // Filter by similar users if we have them
    if (similarUserIds.length > 0) {
      journeyQuery = journeyQuery.in('user_id', similarUserIds);
    }

    // Filter by entity if provided
    if (entityId) {
      journeyQuery = journeyQuery.eq('from_entity_id', entityId);
    } else if (userEntityIds.length > 0) {
      // Otherwise filter by user's stuff
      journeyQuery = journeyQuery.in('from_entity_id', userEntityIds);
    }

    // Filter by transition type if provided
    if (transitionType) {
      journeyQuery = journeyQuery.eq('transition_type', transitionType);
    }

    const { data: journeys, error: journeyError } = await journeyQuery;

    if (journeyError) {
      console.error(`[Phase5][${runId}] Error fetching journeys:`, journeyError);
    }

    console.log(`[Phase5][${runId}] Found ${journeys?.length || 0} journeys from similar users`);

    // Step 4: Get global product_relationships for fallback
    let relationshipsQuery = supabase
      .from('product_relationships')
      .select('entity_a_id, entity_b_id, relationship_type, consensus_count, avg_confidence')
      .gt('consensus_count', 0)
      .order('consensus_count', { ascending: false })
      .limit(50);

    if (entityId) {
      relationshipsQuery = relationshipsQuery.eq('entity_a_id', entityId);
    } else if (userEntityIds.length > 0) {
      relationshipsQuery = relationshipsQuery.in('entity_a_id', userEntityIds);
    }

    if (transitionType) {
      relationshipsQuery = relationshipsQuery.eq('relationship_type', transitionType);
    }

    const { data: globalRelationships, error: relError } = await relationshipsQuery;

    if (relError) {
      console.error(`[Phase5][${runId}] Error fetching global relationships:`, relError);
    }

    console.log(`[Phase5][${runId}] Found ${globalRelationships?.length || 0} global relationships`);

    // Step 5: Classify richness
    const entitySpecificJourneys = entityId 
      ? journeys?.filter(j => j.from_entity_id === entityId).length || 0
      : journeys?.length || 0;

    const richness = classifyJourneyRichness(
      similarUserIds.length,
      journeys?.length || 0,
      entitySpecificJourneys,
      globalRelationships?.length || 0
    );

    console.log(`[Phase5][${runId}] Richness mode: ${richness.mode}`);

    // Step 6: Build recommendations based on mode
    const recommendations: TransitionRecommendation[] = [];
    const entityCache = new Map<string, { name: string; type: string; image_url: string | null }>();

    // Helper to fetch entity details
    async function getEntityDetails(entityId: string) {
      if (entityCache.has(entityId)) {
        return entityCache.get(entityId)!;
      }
      const { data } = await supabase
        .from('entities')
        .select('id, name, type, image_url')
        .eq('id', entityId)
        .single();
      
      const details = data || { name: 'Unknown', type: 'others', image_url: null };
      entityCache.set(entityId, details);
      return details;
    }

    // Extract lifestyle factors from similarity data
    function extractLifestyleFactors(similarUser: typeof similarUsers[0] | undefined): string[] {
      const factors: string[] = [];
      if (!similarUser) return factors;

      const stuffOverlap = similarUser.stuff_overlap as { common_categories?: string[] } | null;
      const routinesSim = similarUser.routines_similarity as { common_categories?: string[] } | null;

      if (routinesSim?.common_categories?.length) {
        factors.push(...routinesSim.common_categories.map(c => `${c} routine`));
      }
      if (stuffOverlap?.common_categories?.length) {
        factors.push(...stuffOverlap.common_categories);
      }
      return factors.slice(0, 3);
    }

    if (richness.mode === 'RICH' || richness.mode === 'MODERATE') {
      // Process journeys with conflict resolution
      const journeyGroups = new Map<string, {
        toEntityId: string;
        totalScore: number;
        journeyCount: number;
        bestEvidence: string | null;
        avgSentimentBefore: number;
        avgSentimentAfter: number;
        transitionType: string;
        lifestyleFactors: string[];
        relevanceScore: number;
      }>();

      for (const journey of journeys || []) {
        const key = `${journey.from_entity_id}->${journey.to_entity_id}`;
        const similarUser = similarUsers?.find(u => u.user_b_id === journey.user_id);
        const similarityScore = similarUser?.overall_score || 0.1;
        const journeyConfidence = journey.confidence || 0.5;
        
        // Compute relevance score for this journey
        const relevanceScore = computeRelevanceScore(
          journey,
          userStuffItems,
          similarityScore,
          queryContext
        );
        
        const weightedScore = similarityScore * journeyConfidence * (1 + relevanceScore);

        if (journeyGroups.has(key)) {
          const group = journeyGroups.get(key)!;
          group.totalScore += weightedScore;
          group.journeyCount += 1;
          group.relevanceScore = Math.max(group.relevanceScore, relevanceScore);
          if (journey.from_sentiment) group.avgSentimentBefore += journey.from_sentiment;
          if (journey.to_sentiment) group.avgSentimentAfter += journey.to_sentiment;
          if (!group.bestEvidence && journey.evidence_text) {
            group.bestEvidence = journey.evidence_text;
          }
          group.lifestyleFactors.push(...extractLifestyleFactors(similarUser));
        } else {
          journeyGroups.set(key, {
            toEntityId: journey.to_entity_id,
            totalScore: weightedScore,
            journeyCount: 1,
            bestEvidence: journey.evidence_text,
            avgSentimentBefore: journey.from_sentiment || 0,
            avgSentimentAfter: journey.to_sentiment || 0,
            transitionType: journey.transition_type,
            lifestyleFactors: extractLifestyleFactors(similarUser),
            relevanceScore: relevanceScore
          });
        }
      }

      // Apply consensus boost from global relationships
      for (const [key, group] of journeyGroups) {
        const [fromId, toId] = key.split('->');
        const globalRel = globalRelationships?.find(
          r => r.entity_a_id === fromId && r.entity_b_id === group.toEntityId
        );
        if (globalRel) {
          group.totalScore *= Math.sqrt(globalRel.consensus_count || 1);
        }
      }

      // Sort by relevance score first, then by weighted score
      const sortedGroups = Array.from(journeyGroups.entries())
        .sort((a, b) => {
          // Primary: relevance score
          const relevanceDiff = b[1].relevanceScore - a[1].relevanceScore;
          if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
          // Secondary: total weighted score
          return b[1].totalScore - a[1].totalScore;
        })
        .slice(0, limit);

      for (const [key, group] of sortedGroups) {
        const [fromId] = key.split('->');
        const fromEntity = await getEntityDetails(fromId);
        const toEntity = await getEntityDetails(group.toEntityId);

        const avgSentBefore = group.journeyCount > 0 ? group.avgSentimentBefore / group.journeyCount : null;
        const avgSentAfter = group.journeyCount > 0 ? group.avgSentimentAfter / group.journeyCount : null;

        const globalRel = globalRelationships?.find(
          r => r.entity_a_id === fromId && r.entity_b_id === group.toEntityId
        );

        // Dedupe lifestyle factors
        const uniqueFactors = [...new Set(group.lifestyleFactors)];

        recommendations.push({
          id: `${fromId}-${group.toEntityId}`,
          from_entity: { id: fromId, ...fromEntity },
          to_entity: { id: group.toEntityId, ...toEntity },
          transition_type: group.transitionType as 'upgrade' | 'alternative' | 'complementary',
          weighted_score: group.totalScore,
          relevance_score: group.relevanceScore,
          story: generateStory(
            richness.mode,
            fromEntity.name,
            toEntity.name,
            group.transitionType,
            group.journeyCount,
            avgSentBefore,
            avgSentAfter,
            group.bestEvidence,
            uniqueFactors
          ),
          confidence: modeToConfidence(richness.mode),
          consensus_count: globalRel?.consensus_count || group.journeyCount
        });
      }
    }

    // SPARSE mode or supplement with global relationships
    if (richness.mode === 'SPARSE' || recommendations.length < limit) {
      const existingPairs = new Set(recommendations.map(r => `${r.from_entity.id}-${r.to_entity.id}`));
      
      for (const rel of globalRelationships || []) {
        if (recommendations.length >= limit) break;
        
        const pairKey = `${rel.entity_a_id}-${rel.entity_b_id}`;
        if (existingPairs.has(pairKey)) continue;

        const fromEntity = await getEntityDetails(rel.entity_a_id);
        const toEntity = await getEntityDetails(rel.entity_b_id);

        recommendations.push({
          id: pairKey,
          from_entity: { id: rel.entity_a_id, ...fromEntity },
          to_entity: { id: rel.entity_b_id, ...toEntity },
          transition_type: rel.relationship_type as 'upgrade' | 'alternative' | 'complementary',
          weighted_score: (rel.avg_confidence || 0.5) * Math.sqrt(rel.consensus_count || 1),
          relevance_score: 0, // Global fallback has no personal relevance
          story: generateStory(
            'SPARSE',
            fromEntity.name,
            toEntity.name,
            rel.relationship_type,
            rel.consensus_count || 1,
            null,
            null,
            null,
            []
          ),
          confidence: 'low',
          consensus_count: rel.consensus_count || 1
        });

        existingPairs.add(pairKey);
      }
    }

    console.log(`[Phase5][${runId}] Returning ${recommendations.length} recommendations in ${richness.mode} mode`);

    return new Response(
      JSON.stringify({
        recommendations,
        metadata: {
          richness_mode: richness.mode,
          similar_users_found: richness.similarUsersCount,
          journeys_analyzed: richness.totalJourneys,
          global_relationships_available: richness.globalConsensusCount,
          entity_specific: entityId ? true : false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[Phase5][${runId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
