import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('[smart-assistant] Calling AI with', conversationHistory.length, 'history messages');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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

    // 9. For Phase 2: Tool calls are defined but not executed yet
    // Phase 3 will implement actual tool execution
    let finalMessage = assistantMessage;
    
    if (toolCalls && toolCalls.length > 0) {
      finalMessage += "\n\n_Note: Tool execution will be available in Phase 3. The AI recognized it should use: " + 
        toolCalls.map((t: any) => t.function.name).join(', ') + "_";
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
          model: 'gpt-4o-mini',
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
