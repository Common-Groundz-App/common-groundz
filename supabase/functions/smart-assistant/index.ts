import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== HELPER FUNCTIONS ==========

/**
 * ARCHITECTURAL INVARIANT - DO NOT MODIFY
 *
 * - NEVER send google_search and function_declarations in the same Gemini request.
 *   This causes 400 INVALID_ARGUMENT errors due to Gemini API constraints.
 * - Tool selection MUST happen before the API call via intent routing (classifyQueryIntent).
 * - Internal tools ADD value; they do NOT gate intelligence.
 * - General knowledge questions MUST be answered even if tools return empty.
 *
 * Trust hierarchy:
 * 1. User constraints (Things to Avoid) - ALWAYS respect
 * 2. Explicit user data (tools: get_user_stuff, search_user_memory)
 * 3. Gemini knowledge (direct answers for general questions)
 * 4. Web grounding (google_search for real-time info)
 * 5. Common Groundz reviews (search_reviews_semantic for product discovery)
 *
 * Breaking these invariants will cause API errors and regression to tool-first logic.
 */

/**
 * Classify user intent to determine which tools to use.
 * This enables separate API calls to avoid google_search + function_declarations conflict.
 * 
 * NOTE: "general" includes both:
 * 1. Pure general knowledge (facts, explanations) - e.g., "What is BPA?"
 * 2. Context-aware opinions (apply user constraints, no tools) - e.g., "Is Tupperware okay for me?"
 * These MUST NOT trigger function calls or web search by default.
 * 
 * IMPORTANT: "what are" is NOT in the explanatory override because it's often used for
 * product discovery (e.g., "What are the best steel bottles?")
 */
function classifyQueryIntent(message: string): 'realtime' | 'product_user' | 'general' {
  const lowerMessage = message.toLowerCase();
  
  // PRIORITY: Explanatory questions should always be general knowledge
  // NOTE: "what are" is intentionally NOT included - it's often used for product discovery
  // e.g., "What are the best steel bottles?" should use search tools
  if (
    lowerMessage.startsWith('why ') ||
    lowerMessage.startsWith('how ') ||
    lowerMessage.startsWith('what is ') ||
    lowerMessage.startsWith('explain ')
  ) {
    console.log('[classifyQueryIntent] Explanatory question detected, using general');
    return 'general';
  }
  
  // Real-time info patterns (use google_search)
  const realtimePatterns = [
    'latest', 'recent', 'current', 'today', 'now', 'news',
    'price of', 'cost of', 'happening', 'update on',
    'what is the price', 'how much does', 'trending',
    'this week', 'this month', 'right now', '2024', '2025', '2026',
    'research', 'study', 'paper', 'evidence', 'findings'
  ];
  
  // Product/User data patterns (use function_declarations)
  const productUserPatterns = [
    'my stuff', 'my preferences', 'what do i use', 'what am i using',
    'my history', 'my profile', 'i own', 'i have', 'i bought',
    'best product', 'recommend me', 'reviews of', 'reviews for',
    'on common groundz', 'common groundz', 'find me',
    'save this', 'remember this', 'similar users', 'people like me'
  ];
  
  // Check real-time patterns first (web search needed)
  for (const pattern of realtimePatterns) {
    if (lowerMessage.includes(pattern)) {
      console.log(`[classifyQueryIntent] Matched realtime pattern: "${pattern}"`);
      return 'realtime';
    }
  }
  
  // Check product/user patterns (internal tools needed)
  for (const pattern of productUserPatterns) {
    if (lowerMessage.includes(pattern)) {
      console.log(`[classifyQueryIntent] Matched product_user pattern: "${pattern}"`);
      return 'product_user';
    }
  }
  
  // Default to general knowledge (no tools, Gemini answers directly)
  console.log('[classifyQueryIntent] No patterns matched, using general knowledge');
  return 'general';
}

/**
 * Timeout wrapper to prevent hanging requests
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Fetch with exponential backoff retry logic for 503 and 429 errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wrap fetch in timeout (8 seconds)
      const response = await withTimeout(fetch(url, options), 8000);
      
      // If 503 (Service Unavailable) or 429 (Rate Limit), retry with backoff
      if (response.status === 503 || response.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`[fetchWithRetry] Received ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] ${isTimeout ? 'Timeout' : 'Network error'}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  // User-friendly fallback message
  throw new Error("I'm having trouble reaching the AI service right now. Please try again in 10–15 seconds.");
}

// ========== NEW PHASE 6 TOOL FUNCTIONS ==========

async function getUserStuff(
  supabaseClient: any,
  userId: string,
  category?: string,
  status?: string,
  limit: number = 20
): Promise<any> {
  try {
    console.log('[getUserStuff] UserId:', userId, 'Category:', category, 'Status:', status, 'Limit:', limit);

    let query = supabaseClient
      .from('user_stuff')
      .select(`
        id,
        entity_id,
        status,
        sentiment_score,
        category,
        started_using_at,
        stopped_using_at,
        entity:entity_id(id, name, type, slug, image_url)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getUserStuff] Error:', error);
      throw error;
    }

    // Format as compact inventory for system prompt
    const compactInventory = data?.reduce((acc: any, item: any) => {
      const cat = item.category || item.entity?.type || 'other';
      if (!acc[cat]) acc[cat] = [];
      const sentiment = item.sentiment_score !== null ? ` (${item.sentiment_score > 0 ? '+' : ''}${item.sentiment_score})` : '';
      acc[cat].push({
        name: item.entity?.name || 'Unknown',
        status: item.status,
        sentiment: item.sentiment_score,
        displayText: `${item.entity?.name}${sentiment}`
      });
      return acc;
    }, {});

    return {
      success: true,
      items: data || [],
      compact_inventory: compactInventory,
      total_count: data?.length || 0
    };

  } catch (error) {
    console.error('[getUserStuff] Error:', error);
    return {
      success: false,
      error: error.message,
      items: []
    };
  }
}

async function getPersonalizedTransitions(
  supabaseClient: any,
  userId: string,
  entityId?: string,
  transitionType?: string,
  limit: number = 5
): Promise<any> {
  try {
    console.log('[getPersonalizedTransitions] UserId:', userId, 'EntityId:', entityId, 'Type:', transitionType, 'Limit:', limit);

    // Call the get-personalized-transitions edge function
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-personalized-transitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId,
        entityId,
        transitionType,
        limit
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getPersonalizedTransitions] Error:', errorText);
      throw new Error('Failed to get personalized transitions');
    }

    const data = await response.json();

    return {
      success: true,
      recommendations: data.recommendations || [],
      metadata: data.metadata,
      total_count: data.recommendations?.length || 0
    };

  } catch (error) {
    console.error('[getPersonalizedTransitions] Error:', error);
    return {
      success: false,
      error: error.message,
      recommendations: []
    };
  }
}

async function saveInsightFromChat(
  supabaseClient: any,
  userId: string,
  insightType: string,
  entityFromId: string,
  entityToId: string,
  insightData: any
): Promise<any> {
  try {
    console.log('[saveInsightFromChat] UserId:', userId, 'Type:', insightType, 'From:', entityFromId, 'To:', entityToId);

    const { data, error } = await supabaseClient
      .from('saved_insights')
      .insert({
        user_id: userId,
        insight_type: insightType,
        entity_from_id: entityFromId,
        entity_to_id: entityToId,
        insight_data: insightData
      })
      .select()
      .single();

    if (error) {
      console.error('[saveInsightFromChat] Error:', error);
      throw error;
    }

    return {
      success: true,
      message: 'Insight saved successfully! You can find it in your Saved Insights.',
      saved_insight_id: data.id
    };

  } catch (error) {
    console.error('[saveInsightFromChat] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ========== TOOL EXECUTION FUNCTIONS ==========

async function searchReviewsSemantic(
  supabaseClient: any,
  query: string,
  entityId?: string,
  limit: number = 5
): Promise<any> {
  try {
    console.log('[searchReviewsSemantic] Query:', query, 'EntityId:', entityId, 'Limit:', limit);
    
    // Generate embedding for the search query
  const embeddingResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({ 
      texts: [{ 
        id: 'search_query', 
        content: query, 
        type: 'review' 
      }] 
    })
  });

  if (!embeddingResponse.ok) {
    const errorText = await embeddingResponse.text();
    console.error('[searchReviewsSemantic] Embedding API error:', errorText);
    throw new Error('Failed to generate embedding for search query');
  }

  const { embeddings } = await embeddingResponse.json();
  const embedding = embeddings[0].embedding;

    // Use match_reviews RPC for vector similarity search
    const { data, error } = await supabaseClient.rpc('match_reviews', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
      filter_entity_id: entityId || null
    });

    if (error) {
      console.error('[searchReviewsSemantic] Error:', error);
      throw error;
    }

    // Enrich results with entity and user information
    if (data && data.length > 0) {
      const enrichedData = await Promise.all(
        data.map(async (review: any) => {
          const { data: entity } = await supabaseClient
            .from('entities')
            .select('id, name, type, slug')
            .eq('id', review.entity_id)
            .single();

          const { data: user } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name')
            .eq('id', review.user_id)
            .single();

          return {
            ...review,
            entity,
            user,
            relevance_score: review.similarity
          };
        })
      );

      return {
        success: true,
        results: enrichedData,
        count: enrichedData.length
      };
    }

    return {
      success: true,
      results: [],
      count: 0,
      message: 'No relevant reviews found for this query.'
    };

  } catch (error) {
    console.error('[searchReviewsSemantic] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

async function findSimilarUsers(
  supabaseClient: any,
  userId: string,
  limit: number = 3
): Promise<any> {
  try {
    console.log('[findSimilarUsers] UserId:', userId, 'Limit:', limit);

    // Get the user's profile embedding
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('profile_embedding')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile?.profile_embedding) {
      return {
        success: false,
        error: 'User profile embedding not found. User may need to create more content.',
        results: []
      };
    }

    // Use match_profiles RPC for vector similarity search
    const { data, error } = await supabaseClient.rpc('match_profiles', {
      query_embedding: userProfile.profile_embedding,
      match_threshold: 0.75,
      match_count: limit,
      exclude_user_id: userId
    });

    if (error) {
      console.error('[findSimilarUsers] Error:', error);
      throw error;
    }

    // Enrich with follow status and shared interests
    if (data && data.length > 0) {
      const enrichedData = await Promise.all(
        data.map(async (profile: any) => {
          // Check if current user follows this profile
          const { data: followData } = await supabaseClient
            .from('user_follows')
            .select('id')
            .eq('follower_id', userId)
            .eq('following_id', profile.id)
            .maybeSingle();

          // Get shared entity interests
          const { data: currentUserReviews } = await supabaseClient
            .from('reviews')
            .select('entity_id')
            .eq('user_id', userId)
            .limit(100);

          const currentUserEntityIds = currentUserReviews?.map((r: any) => r.entity_id) || [];

          const { data: sharedInterests } = await supabaseClient
            .from('reviews')
            .select('entity_id')
            .eq('user_id', profile.id)
            .in('entity_id', currentUserEntityIds)
            .limit(5);

          return {
            ...profile,
            is_following: !!followData,
            shared_interests_count: sharedInterests?.length || 0,
            similarity_score: profile.similarity
          };
        })
      );

      return {
        success: true,
        results: enrichedData,
        count: enrichedData.length
      };
    }

    return {
      success: true,
      results: [],
      count: 0,
      message: 'No similar users found.'
    };

  } catch (error) {
    console.error('[findSimilarUsers] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

async function getProductRelationships(
  supabaseClient: any,
  entityId: string,
  relationshipType?: string
): Promise<any> {
  try {
    console.log('[getProductRelationships] EntityId:', entityId, 'Type:', relationshipType);

    // Build query for product_relationships table
    let query = supabaseClient
      .from('product_relationships')
      .select(`
        id,
        relationship_type,
        confidence_score,
        extracted_context,
        verified_by_admin,
        source:source_entity_id(id, name, type, slug, image_url),
        target:target_entity_id(id, name, type, slug, image_url)
      `)
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
      .order('confidence_score', { ascending: false });

    if (relationshipType) {
      query = query.eq('relationship_type', relationshipType);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('[getProductRelationships] Error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      // Organize by relationship type
      const organized = data.reduce((acc: any, rel: any) => {
        const type = rel.relationship_type;
        if (!acc[type]) acc[type] = [];
        
        // Determine which entity is the "related" one
        const relatedEntity = rel.source.id === entityId ? rel.target : rel.source;
        
        acc[type].push({
          entity: relatedEntity,
          confidence: rel.confidence_score,
          context: rel.extracted_context,
          verified: rel.verified_by_admin
        });
        
        return acc;
      }, {});

      return {
        success: true,
        relationships: organized,
        total_count: data.length
      };
    }

    return {
      success: true,
      relationships: {},
      total_count: 0,
      message: 'No product relationships found yet. Relationships are discovered from user reviews.'
    };

  } catch (error) {
    console.error('[getProductRelationships] Error:', error);
    return {
      success: false,
      error: error.message,
      relationships: {}
    };
  }
}

async function getUserContext(
  supabaseClient: any,
  userId: string,
  contextType: 'preferences' | 'history' | 'goals' | 'interests',
  entityType?: string
): Promise<any> {
  try {
    console.log('[getUserContext] UserId:', userId, 'Type:', contextType, 'EntityType:', entityType);

    switch (contextType) {
      case 'preferences': {
        // Get user's preferences from profile and memories
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('bio, preferences')
          .eq('id', userId)
          .single();

        const { data: memories } = await supabaseClient
          .from('user_conversation_memory')
          .select('memory_summary, context_data')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(5);

        return {
          success: true,
          data: {
            bio: profile?.bio,
            preferences: profile?.preferences,
            learned_preferences: memories?.map((m: any) => ({
              summary: m.memory_summary,
              data: m.context_data
            }))
          }
        };
      }

      case 'history': {
        // Get user's review and interaction history
        let query = supabaseClient
          .from('reviews')
          .select(`
            id,
            title,
            rating,
            is_recommended,
            created_at,
            entity:entity_id(id, name, type, slug)
          `)
          .eq('user_id', userId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20);

        if (entityType) {
          // Need to filter after join - Supabase limitation
          const { data: allReviews } = await query;
          const filtered = allReviews?.filter((r: any) => r.entity?.type === entityType);
          
          const { data: savedEntities } = await supabaseClient
            .from('saved_entities')
            .select('entity:entity_id(id, name, type, slug)')
            .eq('user_id', userId)
            .limit(10);

          return {
            success: true,
            data: {
              reviews: filtered || [],
              saved_entities: savedEntities || [],
              total_reviews: filtered?.length || 0
            }
          };
        }

        const { data: reviews } = await query;

        // Get saved/liked entities
        const { data: savedEntities } = await supabaseClient
          .from('saved_entities')
          .select('entity:entity_id(id, name, type, slug)')
          .eq('user_id', userId)
          .limit(10);

        return {
          success: true,
          data: {
            reviews: reviews || [],
            saved_entities: savedEntities || [],
            total_reviews: reviews?.length || 0
          }
        };
      }

      case 'goals': {
        // Get user's stated goals from memories and preferences
        const { data: memories } = await supabaseClient
          .from('user_conversation_memory')
          .select('memory_summary, context_data')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(10);

        // Extract goal-related information
        const goalRelatedMemories = memories?.filter((m: any) => 
          m.memory_summary.toLowerCase().includes('want') ||
          m.memory_summary.toLowerCase().includes('looking for') ||
          m.memory_summary.toLowerCase().includes('goal') ||
          m.context_data?.goals
        );

        return {
          success: true,
          data: {
            goals: goalRelatedMemories?.map((m: any) => ({
              summary: m.memory_summary,
              details: m.context_data?.goals
            })) || [],
            message: goalRelatedMemories?.length === 0 
              ? 'No specific goals identified yet. Continue chatting to help me learn your preferences!'
              : undefined
          }
        };
      }

      case 'interests': {
        // Similar to preferences but focused on entity-level interests
        const { data: reviews } = await supabaseClient
          .from('reviews')
          .select(`
            rating,
            is_recommended,
            entity:entity_id(id, name, type)
          `)
          .eq('user_id', userId)
          .eq('status', 'published')
          .gte('rating', 4)
          .order('created_at', { ascending: false })
          .limit(30);

        // Group by entity type
        const interestsByType = reviews?.reduce((acc: any, review: any) => {
          const type = review.entity?.type || 'other';
          if (!acc[type]) acc[type] = [];
          acc[type].push(review.entity);
          return acc;
        }, {});

        return {
          success: true,
          data: {
            interests_by_type: interestsByType || {},
            high_rated_count: reviews?.length || 0
          }
        };
      }

      default:
        return {
          success: false,
          error: 'Invalid context type'
        };
    }

  } catch (error) {
    console.error('[getUserContext] Error:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

async function webSearch(query: string): Promise<any> {
  try {
    console.log('[webSearch] Query:', query);

    // Web search is now handled via intent router -> google_search grounding
    // This function is kept for backward compatibility
    return {
      success: true,
      message: `Web search for "${query}" is handled by google_search grounding via intent router.`,
      results: [],
      note: 'Use queries with real-time keywords (latest, news, current, research) to trigger web search'
    };

  } catch (error) {
    console.error('[webSearch] Error:', error);
    return {
      success: false,
      error: error.message,
      results: [],
      fallback_message: 'Answer from your knowledge instead.'
    };
  }
}

async function searchUserMemory(
  supabaseClient: any,
  userId: string,
  query: string,
  scope?: string
): Promise<any> {
  try {
    console.log('[searchUserMemory] Query:', query, 'Scope:', scope, 'User:', userId);
    
    const { data: userMemory } = await supabaseClient
      .from('user_conversation_memory')
      .select('memory_summary, metadata')
      .eq('user_id', userId)
      .single();
    
    if (!userMemory) {
      return {
        success: false,
        message: 'No memory found for this user yet.'
      };
    }
    
    const scopes = userMemory.metadata?.scopes || {};
    
    // Filter by scope if specified
    if (scope && scope !== 'all') {
      return {
        success: true,
        scope: scope,
        data: scopes[scope] || {},
        summary: userMemory.memory_summary
      };
    }
    
    // Return all scopes
    return {
      success: true,
      data: scopes,
      summary: userMemory.memory_summary
    };
    
  } catch (error) {
    console.error('[searchUserMemory] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ========== DETECTED PREFERENCE TYPES ==========

interface DetectedPreferenceInfo {
  trigger: boolean;
  reason?: string;
  preferenceType?: 'avoid' | 'preference';
  extractedValue?: string;
  scope?: string;
  confidence?: number;
  targetType?: 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule';
}

// Pattern definitions with confidence scores
const PREFERENCE_PATTERNS = [
  // High confidence (0.9+) - Very explicit statements
  { pattern: /\bi(?:'m| am) allergic to\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.95, scope: 'health' },
  { pattern: /\bi have (?:a )?(.+?) allergy/i, type: 'avoid' as const, confidence: 0.95, scope: 'health' },
  { pattern: /\bi(?:'m| am) (?:highly )?sensitive to\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'health' },
  { pattern: /\bi never (?:use|eat|consume|watch|read)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'general' },
  { pattern: /\bi always avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'general' },
  
  // Good confidence (0.8-0.89) - Clear preferences
  { pattern: /\bi avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.85, scope: 'general' },
  { pattern: /\bi(?:'m| am) (?:vegan|vegetarian|pescatarian)/i, type: 'preference' as const, confidence: 0.85, scope: 'food', extractFixed: true },
  { pattern: /\bi(?:'m| am) gluten[- ]?free/i, type: 'avoid' as const, confidence: 0.85, scope: 'food', extractValue: 'gluten' },
  { pattern: /\bi can(?:'t|not) (?:eat|use|have|stand|tolerate)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.85, scope: 'general' },
  
  // CONFIDENCE & ORDERING GUARDRAIL
  // This generalized avoid-pattern intentionally uses confidence 0.85.
  // Do NOT raise its confidence above medical/allergy patterns (0.95+).
  // Any future pattern with confidence >= 0.9 MUST be placed ABOVE this block.
  // Pattern matching is first-match-wins.
  { 
    pattern: /\bi (?:don(?:'t| not)|never|avoid|can(?:'t| not))\s+(?:use|eat|drink|watch|read|consume|have|want|listen to)\s+(.+?)(?:\.|,|$)/i, 
    type: 'avoid' as const, 
    confidence: 0.85, 
    scope: 'general' 
  },
  
  // INTENT-LEVEL COMMITMENT PATTERN
  // NOTE: This pattern captures *commitment intent*, not confirmed habit.
  // Confidence intentionally capped at 0.85.
  // Must remain below medical/allergy rules (0.95+).
  // Covers: "From now on I will avoid X", "I'll avoid X", "Going forward I'm gonna avoid X"
  // The (?!not\b) negative look-ahead prevents matching "I will avoid not X" false positives
  { 
    pattern: /\b(?:from now on|going forward|in the future)?\s*(?:i\s*(?:will|am going to|gonna|'ll))\s*avoid\s+(?!not\b)(.+?)(?:\.|,|$)/i, 
    type: 'avoid' as const, 
    confidence: 0.85, 
    scope: 'general' 
  },
  
  { pattern: /\bi(?:'ve| have) (?:oily|dry|sensitive|combination) skin/i, type: 'preference' as const, confidence: 0.85, scope: 'skincare', extractFixed: true },
  { pattern: /\bmy skin (?:type )?is\s+(\w+)/i, type: 'preference' as const, confidence: 0.85, scope: 'skincare' },
  { pattern: /\bmy hair (?:type )?is\s+(\w+)/i, type: 'preference' as const, confidence: 0.85, scope: 'haircare' },
  { pattern: /\bi prefer\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.8, scope: 'general' },
  { pattern: /\bi love\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.8, scope: 'general' },
  { pattern: /\bi hate\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.8, scope: 'general' },
  
  // Medium confidence (0.7-0.79) - Less explicit
  { pattern: /\bi don't like\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.75, scope: 'general' },
  { pattern: /\bi like\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.75, scope: 'general' },
  { pattern: /\bi usually (?:avoid|skip)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.7, scope: 'general' },
  
  // Low confidence (<0.7) - Vague statements (won't show chips, only LFC)
  { pattern: /\bi sometimes avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.5, scope: 'general' },
  { pattern: /\bi(?:'m| am) not (?:a fan of|into)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.6, scope: 'general' },
];

function inferScope(value: string, defaultScope: string): string {
  const lowerValue = value.toLowerCase();
  
  // Food-related
  if (/\b(caffeine|dairy|gluten|nuts|shellfish|soy|eggs?|meat|fish|sugar|carbs?|alcohol)\b/.test(lowerValue)) {
    return 'food';
  }
  // Skincare-related
  if (/\b(retinol|fragrance|parabens?|sulfates?|alcohol|vitamin c|acids?|niacinamide|hyaluronic)\b/.test(lowerValue)) {
    return 'skincare';
  }
  // Entertainment-related
  if (/\b(horror|comedy|romance|action|thriller|drama|sci-fi|documentary|anime)\b/.test(lowerValue)) {
    return 'entertainment';
  }
  
  return defaultScope;
}

function inferTargetType(value: string, scope: string): 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule' {
  const lowerValue = value.toLowerCase();
  
  // Behavioral/temporal rules (should display in General/Other category)
  const behaviorPatterns = [
    /\b(before|after)\s+\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)?/i,  // "after 9 pm"
    /\b(phone|screen|device|laptop|computer|tv|television|social media)/i, // devices
    /\b(sleep|bed|morning|night|evening|bedtime)/i,  // time-related
    /\b(exercise|workout|gym|walk|run|jog)/i,  // activities
    /\b(work|meeting|email|calls?)/i,  // work-related
    /\b(nap|rest|break)/i,  // rest-related
  ];
  
  if (behaviorPatterns.some(p => p.test(lowerValue))) {
    return 'rule';
  }
  
  // Entertainment genres
  if (/\b(horror|comedy|romance|action|thriller|drama|sci-fi|documentary|anime|musical)\b/.test(lowerValue)) {
    return 'genre';
  }
  
  // Food-related (when scope is food or contains food keywords)
  if (scope === 'food' || /\b(caffeine|dairy|gluten|nuts|shellfish|sugar|meat|fish|eggs?|soy|alcohol|carbs?)\b/.test(lowerValue)) {
    return 'food_type';
  }
  
  // Skincare/haircare ingredients
  if (/\b(retinol|fragrance|parabens?|sulfates?|niacinamide|hyaluronic|salicylic|glycolic|vitamin\s*c|acids?)\b/.test(lowerValue)) {
    return 'ingredient';
  }
  
  // Brand detection
  if (/\b(brand|company|products? from)\b/.test(lowerValue)) {
    return 'brand';
  }
  
  // Format detection
  if (/\b(gel|cream|serum|oil|foam|spray|lotion|balm|powder|capsule)\b/.test(lowerValue)) {
    return 'format';
  }
  
  // Default: if scope is general/global and no specific match, treat as rule
  if (scope === 'general' || scope === 'global') {
    return 'rule';
  }
  
  return 'ingredient';
}

function extractPreferenceFromMessage(userMessage: string): DetectedPreferenceInfo | null {
  for (const patternDef of PREFERENCE_PATTERNS) {
    const match = userMessage.match(patternDef.pattern);
    if (match) {
      let extractedValue: string;
      
      if ((patternDef as any).extractValue) {
        extractedValue = (patternDef as any).extractValue;
      } else if ((patternDef as any).extractFixed) {
        // Extract the matched portion directly (e.g., "vegan", "oily skin")
        extractedValue = match[0].replace(/^i(?:'m| am| have| ve)\s*/i, '').trim();
      } else if (match[1]) {
        // Clean up extracted value
        extractedValue = match[1]
          .replace(/\s+(because|since|due to|as|so).*/i, '') // Remove trailing explanations
          .replace(/[.,!?]+$/, '') // Remove punctuation
          .trim();
      } else {
        continue;
      }
      
      // Skip if extracted value is too long (likely captured too much)
      if (extractedValue.length > 50 || extractedValue.split(' ').length > 6) {
        continue;
      }
      
      const scope = inferScope(extractedValue, patternDef.scope);
      const targetType = inferTargetType(extractedValue, scope);
      
      return {
        trigger: true,
        reason: 'preference-detected',
        preferenceType: patternDef.type,
        extractedValue,
        scope,
        confidence: patternDef.confidence,
        targetType,
      };
    }
  }
  
  return null;
}

function detectMemoryUpdateTrigger(
  userMessage: string,
  assistantMessage: string
): DetectedPreferenceInfo {
  const lowerUser = userMessage.toLowerCase();
  const lowerAssistant = assistantMessage.toLowerCase();
  
  // === FIRST: Check for extractable preferences ===
  const extracted = extractPreferenceFromMessage(userMessage);
  if (extracted) {
    return extracted;
  }
  
  // === USER MESSAGE TRIGGERS (fallback to existing logic) ===
  
  // Conversation ending phrases
  const endPhrases = ['thanks', 'thank you', 'bye', 'goodbye', "that's all", 'perfect', 'great thanks'];
  if (endPhrases.some(p => lowerUser.includes(p))) {
    return { trigger: true, reason: 'conversation-end' };
  }
  
  // Personal information patterns (Phase 6.0 enhancement)
  const personalInfoPatterns = [
    /\bi(?:'m| am) allergic to\b/i,
    /\bi(?:'m| am) sensitive to\b/i,
    /\bi have (?:a )?\w+ allergy\b/i,
    /\bi (?:never|always|usually|prefer to|hate|love|avoid)\b/i,
    /\bmy skin (?:type )?is\b/i,
    /\bmy hair (?:type )?is\b/i,
    /\bi(?:'m| am) (?:vegan|vegetarian|pescatarian|gluten-free)\b/i,
    /\bi can(?:'t|not) (?:eat|use|have|stand|watch)\b/i,
    /\bi(?:'ve| have) (?:oily|dry|sensitive|combination) skin\b/i,
    /\bmy budget is\b/i,
    /\bi(?:'m| am) on a \w+ budget\b/i,
    /\bi(?:'m| am) looking for\b/i,
    /\bi don't like\b/i,
  ];
  
  if (personalInfoPatterns.some(pattern => pattern.test(userMessage))) {
    return { trigger: true, reason: 'personal-info-shared' };
  }
  
  // === ASSISTANT MESSAGE TRIGGERS ===
  
  // Assistant acknowledged understanding something important
  const assistantAcknowledgmentPatterns = [
    /based on your (?:constraints|preferences|allergies|requirements)/i,
    /(?:i'll|i will) (?:avoid|remember|note|keep in mind)/i,
    /you (?:mentioned|said|told me|indicated|are|have).+(?:allerg|sensitiv|avoid|prefer)/i,
    /avoiding .+ (?:as you requested|per your|based on)/i,
    /noted.+(?:allergy|preference|constraint|sensitivity)/i,
    /since you (?:can't|cannot|don't|prefer not to)/i,
    /given your (?:allergy|sensitivity|preference|constraint)/i,
  ];
  
  if (assistantAcknowledgmentPatterns.some(pattern => pattern.test(assistantMessage))) {
    return { trigger: true, reason: 'assistant-identified-preference' };
  }
  
  // AI needs more context
  if (lowerAssistant.includes("don't know your") || 
      lowerAssistant.includes("tell me more about") ||
      lowerAssistant.includes("what are your preferences")) {
    return { trigger: true, reason: 'context-needed' };
  }
  
  return { trigger: false };
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { conversationId, message, context } = await req.json();

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[smart-assistant] Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    console.log('[smart-assistant] Starting request for user:', user.id);
    console.log('[smart-assistant] Conversation ID:', conversationId);

    // 1. Load or create conversation
    let conversation;
    if (conversationId) {
      const { data, error } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('[smart-assistant] Error loading conversation:', error);
        throw new Error('Conversation not found');
      }
      conversation = data;
    } else {
      // Create new conversation with title from first message
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      const { data, error } = await supabaseClient
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title,
          metadata: { entity_id: context?.entityId }
        })
        .select()
        .single();
      
      if (error) {
        console.error('[smart-assistant] Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
      conversation = data;
      console.log('[smart-assistant] Created new conversation:', conversation.id);
    }

    // 2. Save user message
    const { error: userMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message
      });

    if (userMsgError) {
      console.error('[smart-assistant] Error saving user message:', userMsgError);
    }

    // 3. Load conversation history (last 15 messages for context)
    const { data: historyData, error: historyError } = await supabaseClient
      .from('conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(15);

    if (historyError) {
      console.error('[smart-assistant] Error loading history:', historyError);
    }

    const conversationHistory = historyData?.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    // 4. Load user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, first_name, last_name, bio, preferences')
      .eq('id', user.id)
      .single();

    // 5. Load user conversation memory directly from table
    const { data: userMemory } = await supabaseClient
      .from('user_conversation_memory')
      .select('memory_summary, metadata, last_accessed_at')
      .eq('user_id', user.id)
      .single();

    // 6. Build dynamic system prompt with user context
    const userName = profile?.first_name || profile?.username || 'User';
    const userBio = profile?.bio || 'No bio yet';
    
    // Extract profile preferences
    let profilePreferences = '';
    if (profile?.preferences && Object.keys(profile.preferences).length > 0) {
      const prefs = profile.preferences as any;
      const prefTexts = [];
      
      if (prefs.skinType) prefTexts.push(`Skin Type: ${prefs.skinType}`);
      if (prefs.hairType) prefTexts.push(`Hair Type: ${Array.isArray(prefs.hairType) ? prefs.hairType.join(', ') : prefs.hairType}`);
      if (prefs.foodPreferences) prefTexts.push(`Food Preferences: ${Array.isArray(prefs.foodPreferences) ? prefs.foodPreferences.join(', ') : prefs.foodPreferences}`);
      if (prefs.lifestyle) prefTexts.push(`Lifestyle: ${Array.isArray(prefs.lifestyle) ? prefs.lifestyle.join(', ') : prefs.lifestyle}`);
      if (prefs.genrePreferences) prefTexts.push(`Genre Preferences: ${Array.isArray(prefs.genrePreferences) ? prefs.genrePreferences.join(', ') : prefs.genrePreferences}`);
      if (prefs.goals) prefTexts.push(`Goals: ${Array.isArray(prefs.goals) ? prefs.goals.join(', ') : prefs.goals}`);
      
      if (prefTexts.length > 0) {
        profilePreferences = '\n\nProfile Preferences:\n' + prefTexts.join('\n');
      }
    }
    
    let memoryContext = '';
    if (userMemory) {
      const scopes = userMemory.metadata?.scopes || {};
      const scopeTexts = [];
      
      if (scopes.skincare) scopeTexts.push(`Skincare: ${JSON.stringify(scopes.skincare)}`);
      if (scopes.food) scopeTexts.push(`Food: ${JSON.stringify(scopes.food)}`);
      if (scopes.movies) scopeTexts.push(`Movies: ${JSON.stringify(scopes.movies)}`);
      if (scopes.routines) scopeTexts.push(`Routines: ${JSON.stringify(scopes.routines)}`);
      
      if (scopeTexts.length > 0) {
        memoryContext = '\n' + scopeTexts.join('\n');
      }
    }

    // Extract constraints from preferences (Phase 6.1 - Unified format with scope-aware logic)
    const prefs = profile?.preferences as any;
    const constraintsData = prefs?.constraints || {};
    
    // Read from unified items array (primary source)
    const unifiedItems = (constraintsData.items || []) as Array<{
      id: string;
      targetType: string;
      targetValue: string;
      scope: string;
      intent: string;
      source?: string;
      addedAt?: string;
    }>;
    
    // Group constraints by intent level for enforcement logic
    const neverConstraints: typeof unifiedItems = [];
    const avoidConstraints: typeof unifiedItems = [];
    const limitConstraints: typeof unifiedItems = [];
    
    unifiedItems.forEach(item => {
      const intent = item.intent?.toLowerCase() || 'avoid';
      if (intent === 'never' || intent === 'strictly_avoid') {
        neverConstraints.push(item);
      } else if (intent === 'avoid') {
        avoidConstraints.push(item);
      } else if (intent === 'limit') {
        limitConstraints.push(item);
      }
    });
    
    // Also read legacy format for backward compatibility
    const legacyConstraints = {
      avoidIngredients: constraintsData.avoidIngredients || [],
      avoidBrands: constraintsData.avoidBrands || [],
      avoidProductForms: constraintsData.avoidProductForms || [],
      budget: constraintsData.budget || 'no_preference'
    };
    
    // Build human-readable summary with scope context
    const constraintsSummary: string[] = [];
    
    // Add NEVER constraints (hard blocks)
    if (neverConstraints.length > 0) {
      const neverItems = neverConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- NEVER recommend (hard block): ${neverItems.join(', ')}`);
    }
    
    // Add AVOID constraints (soft blocks with scope)
    if (avoidConstraints.length > 0) {
      const avoidItems = avoidConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- Avoid: ${avoidItems.join(', ')}`);
    }
    
    // Add LIMIT constraints
    if (limitConstraints.length > 0) {
      const limitItems = limitConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- Limit usage: ${limitItems.join(', ')}`);
    }
    
    // Add legacy constraints if no unified items but legacy exists
    if (unifiedItems.length === 0) {
      if (legacyConstraints.avoidIngredients.length) {
        constraintsSummary.push(`- Avoid ingredients: ${legacyConstraints.avoidIngredients.join(', ')}`);
      }
      if (legacyConstraints.avoidBrands.length) {
        constraintsSummary.push(`- Avoid brands: ${legacyConstraints.avoidBrands.join(', ')}`);
      }
      if (legacyConstraints.avoidProductForms.length) {
        constraintsSummary.push(`- Avoid product forms: ${legacyConstraints.avoidProductForms.join(', ')}`);
      }
    }
    
    if (legacyConstraints.budget !== 'no_preference') {
      constraintsSummary.push(`- Budget: ${legacyConstraints.budget}`);
    }
    
    const constraintsSummaryText = constraintsSummary.length > 0 
      ? constraintsSummary.join('\n') 
      : '- No specific constraints';
    
    // Build JSON block for deterministic LLM parsing with full scope + intent data
    const constraintsJsonBlock = JSON.stringify({
      constraints: {
        // Grouped by intent for enforcement logic
        never: neverConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        avoid: avoidConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        limit: limitConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        // Legacy format for backward compatibility
        legacy: legacyConstraints,
        // Raw items for full context
        rawItems: unifiedItems.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          intent: c.intent,
          source: c.source
        }))
      }
    }, null, 2);
    
    // TODO: Future enhancement - Clarification Memory Hook
    // When user responds to scope clarification questions (e.g., "Yes, avoid coconut in haircare too"),
    // their answer should be saved as a new constraint with source: 'assistant_clarification'.
    // This would use the saveInsightFromChat tool or a dedicated constraint creation tool.
    // Example flow:
    // 1. Assistant asks: "I see you avoid coconut in skincare. This is haircare. Is that okay?"
    // 2. User responds: "No, avoid it everywhere"
    // 3. System creates: { targetType: 'ingredient', targetValue: 'coconut', scope: 'global', intent: 'avoid', source: 'assistant_clarification' }

    const systemPrompt = `You are the Common Groundz AI Assistant. You help users discover products, analyze reviews, and get personalized recommendations based on real user experiences.

=== INTENT DETECTION ===
Before responding, classify the user's intent:
- upgrade_intent: User wants to find something better than what they have
- alternative_intent: User wants similar options to consider
- comparison_intent: User wants to compare two or more items
- dissatisfaction_intent: User expresses unhappiness with a product
- discovery_intent: User is researching new options
- general_query: General question or conversation

Use this intent to decide which tools to call and how detailed to respond.

=== USER CONTEXT (STRATIFIED MEMORY) ===

[LONG-TERM IDENTITY]
- Name: ${userName}
- Bio: ${userBio}${profilePreferences}

[LEARNED PREFERENCES]${memoryContext || '\n- No learned preferences yet'}

=== USER CONSTRAINTS (CRITICAL - NEVER VIOLATE) ===

Summary:
${constraintsSummaryText}

Structured data for precise parsing:
\`\`\`json
${constraintsJsonBlock}
\`\`\`

=== PREFERENCE ACKNOWLEDGMENT RULES ===

When a user shares a preference or avoid statement (e.g., "I avoid caffeine after 6 pm", "I prefer natural products"):

1. ACKNOWLEDGE, DON'T CLAIM SAVED:
   - Say "I've noted..." or "Got it, I'll keep in mind..." NOT "I've added..."
   - The user will see confirmation chips below your message to actually save it
   - Never claim something has been added to their preferences before they confirm
   - If confirmation chips are shown, imply this is pending user confirmation, not permanent memory

2. USE CORRECT TERMINOLOGY:
   - For avoid statements: "I've noted that you avoid [X]" or "Got it, I'll keep that in mind"
   - For preferences: "I've noted that you prefer [X]"
   - Never say "added to preferences" for an avoid statement

3. EXAMPLES:
   - User: "I avoid caffeine after 6 pm"
     Good: "Got it! I've noted that you avoid caffeine after 6 PM — you can save this below if you'd like."
     Bad: "I've added 'avoid caffeine after 6 PM' to your preferences."
   
   - User: "I avoid my phone after 9 pm"
     Good: "That's a great habit! I'll keep in mind that you avoid phone usage after 9 PM — save it below if you want."
     Bad: "I've saved 'phone after 9 PM' to your preferences."

4. KEEP RESPONSES NATURAL:
   - Brief acknowledgment is fine
   - Gently point to the save option without being verbose

=== PREFERENCE PRIORITY RULES (PHASE 6.1) ===

When preferences conflict, follow this STRICT order:

1. CONSTRAINTS (highest priority - NEVER violate "never" intent)
   - All items in the constraints JSON above
   - These are rules the user has explicitly set
   - Pay attention to scope and intent for each constraint

2. USER-EDITED PREFERENCES (high priority, confidence = 1.0)
   - Any preference manually set or approved by user
   - These override chatbot-learned preferences

3. CHATBOT-LEARNED PREFERENCES (lower priority)
   - Use these to personalize, but don't contradict #1 or #2
   - If confidence < 0.7, treat as suggestion not fact

=== SCOPE-AWARE CONSTRAINT ENFORCEMENT RULES (CRITICAL) ===

When evaluating products against user constraints, follow this decision tree:

1. HARD BLOCK (intent = "never" or "strictly_avoid"):
   - ALWAYS enforce, NO EXCEPTIONS
   - Do NOT ask for clarification - these represent allergies, medical needs, religious/ethical rules, or firm boundaries
   - Response format: "I cannot recommend this because you've indicated you strictly avoid [X]."

2. GLOBAL SCOPE (scope = "global" AND intent = "avoid"):
   - Soft block everywhere
   - Recommend against but explain why
   - Response format: "This contains [X] which you avoid. I'd recommend looking at alternatives."

3. MATCHING SCOPE (constraint scope = product category AND intent = "avoid"):
   - Soft block in that category
   - Recommend against but explain why
   - Response format: "Since you avoid [X] in [category], I wouldn't recommend this."

4. DIFFERENT SCOPE (constraint scope ≠ product category AND intent = "avoid"):
   - ASK FOR CLARIFICATION instead of rejecting
   - The user may have different preferences for different product categories
   - Response format: "I see you avoid [X] in [constraint scope] products. This is a [product category] product that contains [X]. Would you like me to avoid [X] in [product category] as well, or is this okay for you?"

5. LIMIT INTENT (intent = "limit"):
   - Only flag if there's a specific concern
   - Can recommend with a note about the user's preference to limit usage
   - Response format: "This contains [X] which you prefer to limit. It's still a good option if you're okay with occasional use."

IMPORTANT SAFETY RULES:
- NEVER assume a skincare constraint applies to haircare or vice versa without asking
- NEVER ask for clarification on "never" or "strictly_avoid" constraints - always enforce them
- When in doubt about scope, ask for clarification rather than blocking or ignoring

=== CONSTRAINT MATCHING LOGIC ===

Product categories and their domains:
- skincare: cleansers, moisturizers, serums, sunscreens, masks, toners, exfoliators
- haircare: shampoos, conditioners, hair treatments, styling products, hair oils
- makeup: foundations, lipsticks, eyeshadows, mascaras, blushes, primers
- fragrance: perfumes, colognes, body mists
- supplements: vitamins, minerals, protein, wellness products
- food: ingredients, recipes, restaurants, meals
- movies: films, shows, documentaries, series
- books: novels, non-fiction, audiobooks
- global: applies to ALL categories above

When a product is identified, determine its category and compare against each constraint's scope.

When you detect a potential conflict between a recommendation and a constraint:
1. Check the intent level first (never/strictly_avoid = hard block)
2. Check scope match (global or matching category = soft block)
3. If scope differs, ask for clarification
4. NEVER assume chatbot-learned data overrides user-set constraints

=== RESPONSE STRATEGY ===

BEFORE selecting any tool, CLASSIFY the query intent:

1. GENERAL KNOWLEDGE (facts, definitions, comparisons, "what is", "why does"):
   - Answer directly from your knowledge - NO tool call needed
   - Examples: "What is BPA?", "Why is plastic bad?"

2. REAL-TIME INFO (news, current events, prices, research, "latest", "recent"):
   - Web search will be used automatically via google_search grounding
   - Always cite sources when available

3. PRODUCT DISCOVERY (reviews, recommendations, "best X", "what are the best"):
   - Use search_reviews_semantic FIRST (Common Groundz database)
   - If no results -> answer from knowledge with disclaimer

4. USER-SPECIFIC (what do I use, my preferences, my history):
   - Use get_user_stuff, search_user_memory, get_user_context
   - NEVER guess user data - always use tools

5. OPINION/ADVICE (context-aware recommendations):
   - Combine your knowledge with user constraints
   - Apply user's Things to Avoid constraints
   - This is still "general" intent - no tools needed

=== CRITICAL SOFT-FALLBACK RULE ===

If a tool returns empty or irrelevant results AND the question is NOT user-specific:
-> Answer from your knowledge instead of refusing
-> Add a brief disclaimer like "I didn't find specific Common Groundz reviews, but here's what I know..."
-> NEVER say "I don't have enough information" for general knowledge questions

=== INVARIANT ===

Never block a general-knowledge answer just because internal search tools return empty results.
Internal tools ADD VALUE; they do NOT GATE intelligence.

=== TRUST HIERARCHY ===

1. User constraints (Things to Avoid) - ALWAYS respect
2. Explicit user data (tools: get_user_stuff, search_user_memory)
3. Your knowledge (direct answers for general questions)
4. Web grounding (google_search for real-time info)
5. Common Groundz reviews (search_reviews_semantic for product discovery)

=== REASONING VISIBILITY ===
When recommending, ALWAYS explain WHY:
- "Based on your goal to reduce acne, I suggest..."
- "3 users with similar skincare routines upgraded to..."
- "Since you mentioned avoiding fragrance, this option..."
- "I noticed you have 'retinol' as strictly_avoid, so I excluded products with retinol"

Current Context:
${context?.entityId ? `- User is viewing entity: ${context.entityId}` : '- General conversation'}

Be helpful, concise, and always prioritize user experience. ALWAYS respect user constraints.`;

    // 7. Define function calling tools (Phase 3 will implement execution)
    const tools = [
      {
        type: "function",
        function: {
          name: "search_reviews_semantic",
          description: "PRIMARY TOOL: Search Common Groundz reviews database using semantic similarity. Use this FIRST for ANY query about products, books, movies, places, or user experiences. Examples: 'Zero to One book', 'best laptops', 'Italian restaurants', 'noise cancelling headphones'.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language query to search for (e.g., 'battery life issues', 'best for sensitive skin')"
              },
              entity_id: {
                type: "string",
                description: "Optional: Filter by specific product/entity UUID"
              },
              limit: {
                type: "number",
                description: "Number of results to return (default 5, max 10)"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_similar_users",
          description: "Find users with similar tastes and preferences based on their profile embeddings and interests.",
          parameters: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "Optional: User UUID to find similar users for (defaults to current user)"
              },
              limit: {
                type: "number",
                description: "Number of similar users to return (default 3, max 10)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_product_relationships",
          description: "Find relationships between products: upgrades (better alternatives), downgrades (cheaper alternatives), alternatives (similar products), or complements (products used together).",
          parameters: {
            type: "object",
            properties: {
              entity_id: {
                type: "string",
                description: "Product entity UUID to find relationships for"
              },
              relationship_type: {
                type: "string",
                enum: ["upgrade", "downgrade", "alternative", "complement"],
                description: "Type of relationship to find"
              }
            },
            required: ["entity_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_user_context",
          description: "Retrieve specific user preferences, history, or goals from their profile and activity.",
          parameters: {
            type: "object",
            properties: {
              context_type: {
                type: "string",
                enum: ["preferences", "history", "goals", "interests"],
                description: "Type of context to retrieve"
              },
              entity_type: {
                type: "string",
                description: "Optional: Filter by entity type (e.g., 'book', 'product', 'movie')"
              }
            },
            required: ["context_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "web_search",
          description: "FOR REAL-TIME INFORMATION ONLY: Use when you need current/recent information that your knowledge may not have (news, prices, availability, recent events). The google_search grounding tool will automatically search the web. Do NOT use for general factual questions you can answer directly. Do NOT refuse to answer if this returns empty - fall back to your knowledge.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for real-time web information"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_user_memory",
          description: "Search user's long-term memory for preferences, past context, and learned patterns. Use when you need to recall what you know about the user.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "What to search for (e.g., 'skincare preferences', 'food dislikes', 'workout routine')"
              },
              scope: {
                type: "string",
                enum: ["skincare", "food", "movies", "routines", "all"],
                description: "Optional: limit search to specific scope"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_user_stuff",
          description: "Get user's personal inventory - items they own, use, or want to try. Use to understand what products/items the user has.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional: filter by category (e.g., 'skincare', 'books', 'electronics')"
              },
              status: {
                type: "string",
                enum: ["currently_using", "used_before", "want_to_try", "wishlist", "stopped"],
                description: "Optional: filter by usage status"
              },
              limit: {
                type: "number",
                description: "Number of items to return (default 20)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_personalized_transitions",
          description: "Get personalized journey recommendations - upgrades, alternatives, and complementary items based on similar users' experiences.",
          parameters: {
            type: "object",
            properties: {
              entity_id: {
                type: "string",
                description: "Optional: specific product to get transitions for"
              },
              transition_type: {
                type: "string",
                enum: ["upgrade", "alternative", "complementary"],
                description: "Optional: filter by transition type"
              },
              limit: {
                type: "number",
                description: "Number of recommendations (default 5)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "save_insight",
          description: "Save a journey insight/recommendation for the user to reference later.",
          parameters: {
            type: "object",
            properties: {
              insight_type: {
                type: "string",
                enum: ["upgrade", "alternative", "complementary"],
                description: "Type of insight"
              },
              entity_from_id: {
                type: "string",
                description: "Source entity UUID"
              },
              entity_to_id: {
                type: "string",
                description: "Target entity UUID"
              },
              insight_data: {
                type: "object",
                description: "Insight details (headline, description, etc.)"
              }
            },
            required: ["insight_type", "entity_from_id", "entity_to_id", "insight_data"]
          }
        }
      }
    ];

    // 8. Call Google Gemini API directly
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('[smart-assistant] Calling Gemini AI with', conversationHistory.length, 'history messages');

    // Classify intent to determine which tools to use
    const queryIntent = classifyQueryIntent(message);
    console.log(`[smart-assistant] Query intent: ${queryIntent}`);

    // Build tools array based on intent (to avoid google_search + function_declarations conflict)
    let geminiTools: any[] = [];
    let toolMode = 'none';

    if (queryIntent === 'realtime') {
      // Use ONLY google_search for real-time information
      geminiTools = [{ google_search: {} }];
      toolMode = 'google_search';
      console.log('[smart-assistant] Using google_search tool for real-time info');
    } else if (queryIntent === 'product_user') {
      // Use ONLY function_declarations for product/user queries
      geminiTools = [{
        function_declarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
      toolMode = 'functions';
      console.log('[smart-assistant] Using function_declarations for product/user query');
    } else {
      // General knowledge - no tools, let Gemini answer directly
      geminiTools = [];
      toolMode = 'none';
      console.log('[smart-assistant] No tools - general knowledge query');
    }

    // Structured debug log - captures all routing decisions in one line
    console.log('[assistant-routing]', {
      intent: queryIntent,
      toolMode,
      toolsAttached: geminiTools.length
    });

    // Convert conversation history to Gemini format
    const geminiMessages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I will follow the response strategy and trust hierarchy.' }] },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    // Build request body - only include tools if we have any
    const requestBody: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    if (geminiTools.length > 0) {
      requestBody.tools = geminiTools;
    }

    // Track retry state to prevent loops
    let retryAttempted = false;

    const aiResponse = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      3, // maxRetries
      1000 // initialDelay (1 second)
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[smart-assistant] Gemini API error:', aiResponse.status, errorText);
      
      // User-friendly error messages
      if (aiResponse.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      } else if (aiResponse.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else {
        throw new Error(`Gemini API error: ${aiResponse.statusText}`);
      }
    }

    const aiData = await aiResponse.json();
    console.log('[smart-assistant] Gemini response received');

    const candidate = aiData.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const assistantMessage = candidate.content?.parts?.find((p: any) => p.text)?.text || '';
    const functionCalls = candidate.content?.parts?.filter((p: any) => p.functionCall) || [];

    // Extract grounding metadata (web search citations)
    const groundingMetadata = candidate.groundingMetadata;
    if (groundingMetadata?.groundingChunks?.length > 0) {
      console.log('[smart-assistant] Web grounding used, citations:', groundingMetadata.groundingChunks.length);
      groundingMetadata.groundingChunks.forEach((chunk: any, i: number) => {
        console.log(`[smart-assistant] Citation ${i + 1}: ${chunk.web?.title} - ${chunk.web?.uri}`);
      });
    }
    
    // Convert Gemini function calls to OpenAI-style tool calls
    const toolCalls = functionCalls.map((fc: any, idx: number) => ({
      id: `call_${Date.now()}_${idx}`,
      type: 'function',
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args)
      }
    }));

    console.log('[smart-assistant] AI response received, tool_calls:', toolCalls?.length || 0);

    // 9. Execute tool calls if AI requested them
    let finalMessage = assistantMessage;

    if (toolCalls && toolCalls.length > 0) {
      console.log('[smart-assistant] Executing', toolCalls.length, 'tool calls');
      
      const toolResults = [];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log('[smart-assistant] Executing tool:', functionName, 'with args:', functionArgs);

        let result;

        try {
          switch (functionName) {
            case 'search_reviews_semantic':
              result = await searchReviewsSemantic(
                supabaseClient,
                functionArgs.query,
                functionArgs.entity_id,
                functionArgs.limit || 5
              );
              break;

            case 'find_similar_users':
              result = await findSimilarUsers(
                supabaseClient,
                functionArgs.user_id || user.id,
                functionArgs.limit || 3
              );
              break;

            case 'get_product_relationships':
              result = await getProductRelationships(
                supabaseClient,
                functionArgs.entity_id,
                functionArgs.relationship_type
              );
              break;

            case 'get_user_context':
              result = await getUserContext(
                supabaseClient,
                user.id,
                functionArgs.context_type,
                functionArgs.entity_type
              );
              break;

            case 'web_search':
              result = await webSearch(functionArgs.query);
              break;

            case 'search_user_memory':
              result = await searchUserMemory(
                supabaseClient,
                user.id,
                functionArgs.query,
                functionArgs.scope
              );
              break;

            case 'get_user_stuff':
              result = await getUserStuff(
                supabaseClient,
                user.id,
                functionArgs.category,
                functionArgs.status,
                functionArgs.limit || 20
              );
              break;

            case 'get_personalized_transitions':
              result = await getPersonalizedTransitions(
                supabaseClient,
                user.id,
                functionArgs.entity_id,
                functionArgs.transition_type,
                functionArgs.limit || 5
              );
              break;

            case 'save_insight':
              result = await saveInsightFromChat(
                supabaseClient,
                user.id,
                functionArgs.insight_type,
                functionArgs.entity_from_id,
                functionArgs.entity_to_id,
                functionArgs.insight_data
              );
              break;

            default:
              result = {
                success: false,
                error: `Unknown function: ${functionName}`
              };
          }
        } catch (error) {
          console.error('[smart-assistant] Tool execution error:', error);
          result = {
            success: false,
            error: error.message
          };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // 9b. Make a second Gemini call with tool results to generate final response
      console.log('[smart-assistant] Making follow-up Gemini call with tool results');

      // Convert tool results to Gemini format
      const geminiFollowUpMessages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help users with their questions using the available tools.' }] },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: message }] },
        { 
          role: 'model', 
          parts: functionCalls.map((fc: any) => ({ functionCall: fc.functionCall }))
        },
        {
          role: 'user',
          parts: toolResults.map((tr: any) => ({
            functionResponse: {
              name: tr.name,
              response: JSON.parse(tr.content)
            }
          }))
        }
      ];

      const followUpResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiFollowUpMessages,
            tools: geminiTools,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000
            }
          }),
        },
        3,
        1000
      );

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error('[smart-assistant] Follow-up Gemini call failed:', errorText);
        // Fall back to original message if follow-up fails
        finalMessage = assistantMessage + '\n\n_Note: I retrieved the data but had trouble processing it. Please try asking again._';
      } else {
        const followUpData = await followUpResponse.json();
        const followUpCandidate = followUpData.candidates?.[0];
        finalMessage = followUpCandidate?.content?.parts?.find((p: any) => p.text)?.text || assistantMessage;
        console.log('[smart-assistant] Follow-up response received');
      }
    }

    // Extract grounding metadata for google_search responses and append citations
    let citationsText = '';
    if (toolMode === 'google_search') {
      const groundingMeta = aiData.candidates?.[0]?.groundingMetadata;
      if (groundingMeta?.groundingChunks?.length > 0) {
        console.log('[smart-assistant] Web grounding citations found:', groundingMeta.groundingChunks.length);
        
        const citations = groundingMeta.groundingChunks
          .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
          .map((chunk: any, i: number) => `[${i + 1}] ${chunk.web.title}: ${chunk.web.uri}`)
          .join('\n');
        
        if (citations) {
          citationsText = '\n\n**Sources:**\n' + citations;
        }
      }
    }

    // Append citations to final message if present
    let finalAssistantMessage = finalMessage + citationsText;

    // Post-response safety net: If non-product query got a very short/empty response,
    // retry once with NO tools to let Gemini answer from knowledge
    // BUT: Don't retry if response is a legitimate short answer (yes/no responses)
    const lowerResponse = finalAssistantMessage.toLowerCase().trim();
    if (
      queryIntent !== 'product_user' &&
      finalAssistantMessage.trim().length < 20 &&
      !lowerResponse.startsWith('yes') &&
      !lowerResponse.startsWith('no') &&
      !retryAttempted
    ) {
      console.log('[smart-assistant] Response too short and not yes/no, retrying with no tools');
      retryAttempted = true;
      
      // Retry request with no tools
      const retryRequestBody = {
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
        // No tools - force Gemini to answer from knowledge
      };
      
      const retryResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(retryRequestBody),
        },
        3,
        1000
      );
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryMessage = retryData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
        if (retryMessage && retryMessage.trim().length > finalAssistantMessage.trim().length) {
          console.log('[smart-assistant] Retry produced better response');
          finalAssistantMessage = retryMessage;
        }
      }
    }

    // 10. Save assistant response to database
    const { error: assistantMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: finalAssistantMessage,
        metadata: {
          tool_calls: toolCalls || [],
          tools_executed: toolCalls?.length || 0,
          model: 'gemini-2.5-flash',
          tokens_used: aiData.usageMetadata
        }
      });

    if (assistantMsgError) {
      console.error('[smart-assistant] Error saving assistant message:', assistantMsgError);
    }

    // 11. Update conversation timestamp
    await supabaseClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // 12. Check if memory should be updated (Phase 6.0 enhanced triggers)
    const memoryTrigger = detectMemoryUpdateTrigger(message, finalAssistantMessage);

    if (memoryTrigger.trigger) {
      console.log('[smart-assistant] Triggering background memory update:', memoryTrigger.reason);
      
      // Use EdgeRuntime.waitUntil for reliable fire-and-forget background task
      // This ensures the memory update completes even after response is sent
      EdgeRuntime.waitUntil(
        (async () => {
          // Small delay to avoid back-to-back Gemini API calls (rate limiting)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const memoryResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-user-memory`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({
                conversationId: conversation.id,
                trigger: memoryTrigger.reason
              })
            });
            console.log('[smart-assistant] Memory update completed:', memoryResponse.status);
          } catch (err) {
            console.error('[smart-assistant] Memory update failed:', err);
          }
        })()
      );
    }

    const responseTime = Date.now() - startTime;
    console.log('[smart-assistant] Request completed in', responseTime, 'ms');

    // Return response to frontend with detected preference for inline confirmation
    // Only include if confidence >= 0.7 (high enough for inline chips)
    const detectedPreference = memoryTrigger.trigger && 
      memoryTrigger.preferenceType && 
      memoryTrigger.extractedValue && 
      memoryTrigger.confidence && 
      memoryTrigger.confidence >= 0.7
        ? {
            type: memoryTrigger.preferenceType,
            value: memoryTrigger.extractedValue,
            scope: memoryTrigger.scope || 'general',
            confidence: memoryTrigger.confidence,
            targetType: memoryTrigger.targetType,
          }
        : null;

    if (detectedPreference) {
      console.log('[smart-assistant] Detected preference for inline confirmation:', detectedPreference);
    }

    return new Response(JSON.stringify({
      conversationId: conversation.id,
      message: finalAssistantMessage,
      toolCalls: toolCalls || [],
      detectedPreference,
      metadata: {
        responseTime,
        tokensUsed: aiData.usageMetadata
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[smart-assistant] Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'An error occurred processing your request',
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
