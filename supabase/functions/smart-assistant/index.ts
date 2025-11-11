import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      body: JSON.stringify({ text: query, type: 'review' })
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding for search query');
    }

    const { embedding } = await embeddingResponse.json();

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

    // Placeholder implementation for Phase 3
    return {
      success: true,
      message: `I searched the web for "${query}" but external search integration is not yet configured. I'll help you with information from Common Groundz instead.`,
      results: [],
      note: 'Web search requires API key configuration (Serper, Brave, etc.)'
    };

  } catch (error) {
    console.error('[webSearch] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
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
      .select('username, first_name, last_name, bio')
      .eq('id', user.id)
      .single();

    // 5. Load relevant user memories (top 3-5 using vector similarity)
    let relevantMemories = [];
    try {
      const { data: memoriesData } = await supabaseClient
        .rpc('match_user_memories', {
          query_user_id: user.id,
          query_text: message,
          match_threshold: 0.7,
          match_count: 5
        });
      
      if (memoriesData) {
        relevantMemories = memoriesData;
      }
    } catch (memoryError) {
      console.log('[smart-assistant] No memories found or error:', memoryError);
    }

    // 6. Build dynamic system prompt with user context
    const userName = profile?.first_name || profile?.username || 'User';
    const userBio = profile?.bio || 'No bio yet';
    
    let memoryContext = '';
    if (relevantMemories.length > 0) {
      memoryContext = '\nKnown preferences and context:\n' + 
        relevantMemories.map((m: any) => `- ${m.memory_summary}`).join('\n');
    }

    const systemPrompt = `You are the Common Groundz AI Assistant. You help users discover products, analyze reviews, and get personalized recommendations based on real user experiences.

User Context:
- Name: ${userName}
- Bio: ${userBio}${memoryContext}

Your capabilities:
1. **search_reviews_semantic**: Search reviews using natural language to find specific experiences, opinions, or product comparisons
2. **find_similar_users**: Find users with similar tastes and preferences
3. **get_product_relationships**: Discover product upgrades, alternatives, downgrades, or complements
4. **get_user_context**: Retrieve user's preferences, history, or goals
5. **web_search**: Search the web when local data is insufficient (always inform user you're searching externally)

Guidelines:
- Be helpful, concise, and conversational
- Cite sources when referencing reviews or user opinions
- If you don't find relevant information in Common Groundz, offer to search the web
- When viewing a specific product page, provide relevant insights about that product
- Remember user preferences across conversations using the context provided
- Use function calls to access data - you have powerful tools available

Current Context:
${context?.entityId ? `- User is viewing entity: ${context.entityId}` : '- General conversation'}

Always prioritize user experience and provide actionable insights.`;

    // 7. Define function calling tools (Phase 3 will implement execution)
    const tools = [
      {
        type: "function",
        function: {
          name: "search_reviews_semantic",
          description: "Search reviews using semantic similarity for natural language queries. Use this when user asks about product experiences, opinions, or comparisons.",
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
          description: "Search the web when local Common Groundz data is insufficient. Always inform the user you're searching externally before using this.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for external web search"
              }
            },
            required: ["query"]
          }
        }
      }
    ];

    // 8. Call Lovable AI Gateway (Google Gemini 2.5 Flash)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[smart-assistant] Calling AI with', conversationHistory.length, 'history messages');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message }
        ],
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[smart-assistant] AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;
    const toolCalls = aiData.choices[0].message.tool_calls;

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

      // 9b. Make a second AI call with tool results to generate final response
      console.log('[smart-assistant] Making follow-up AI call with tool results');

      const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
            { 
              role: 'assistant', 
              content: assistantMessage || null,
              tool_calls: toolCalls 
            },
            ...toolResults
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
      });

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error('[smart-assistant] Follow-up AI call failed:', errorText);
        // Fall back to original message if follow-up fails
        finalMessage = assistantMessage + '\n\n_Note: I retrieved the data but had trouble processing it. Please try asking again._';
      } else {
        const followUpData = await followUpResponse.json();
        finalMessage = followUpData.choices[0].message.content;
        console.log('[smart-assistant] Follow-up response received');
      }
    }

    // 10. Save assistant response to database
    const { error: assistantMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: finalMessage,
        metadata: {
          tool_calls: toolCalls || [],
          tools_executed: toolCalls?.length || 0,
          model: 'google/gemini-2.5-flash',
          tokens_used: aiData.usage
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

    const responseTime = Date.now() - startTime;
    console.log('[smart-assistant] Request completed in', responseTime, 'ms');

    // Return response to frontend
    return new Response(JSON.stringify({
      conversationId: conversation.id,
      message: finalMessage,
      toolCalls: toolCalls || [],
      metadata: {
        responseTime,
        tokensUsed: aiData.usage
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
