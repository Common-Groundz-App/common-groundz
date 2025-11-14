import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId, trigger } = await req.json();

    // Validate trigger
    if (!["conversation-end", "context-needed"].includes(trigger)) {
      return new Response(
        JSON.stringify({ error: "Invalid trigger. Must be 'conversation-end' or 'context-needed'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate conversationId
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[update-user-memory] Processing for user ${user.id}, conversation ${conversationId}, trigger: ${trigger}`);

    // Load conversation messages (last 10)
    const { data: messages, error: messagesError } = await supabaseClient
      .from("conversation_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error("[update-user-memory] Error loading messages:", messagesError);
      return new Response(JSON.stringify({ error: "Failed to load conversation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username, bio, preferences")
      .eq("id", user.id)
      .single();

    // Prepare conversation history for Gemini
    const conversationHistory = messages
      .reverse()
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const userContext = `User: ${profile?.username || "Unknown"}\nBio: ${profile?.bio || "N/A"}\nPreferences: ${JSON.stringify(profile?.preferences || {})}`;

    // Call Gemini API with tool calling
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("[update-user-memory] GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a memory extraction assistant. Analyze the conversation and extract relevant information into 4 scopes:
- skincare: products, routines, skin type, concerns, goals
- food: preferences, allergies, cuisines, restrictions, dietary habits
- movies: genres, actors, viewing habits, favorites
- routines: daily schedules, habits, goals, lifestyle patterns

Only include scopes with meaningful information. Return empty object {} for scopes with no relevant data.
Use the extract_scoped_memories function to structure your response.`;

    const geminiTools = [
      {
        function_declarations: [
          {
            name: "extract_scoped_memories",
            description: "Extract categorized memories from conversation",
            parameters: {
              type: "object",
              properties: {
                skincare: {
                  type: "object",
                  description: "Skincare routines, products, skin type, concerns",
                },
                food: {
                  type: "object",
                  description: "Dietary preferences, allergies, favorite cuisines, restrictions",
                },
                movies: {
                  type: "object",
                  description: "Genre preferences, favorite actors, viewing habits",
                },
                routines: {
                  type: "object",
                  description: "Daily routines, schedules, habits, goals",
                },
              },
            },
          },
        ],
      },
    ];

    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\n${userContext}\n\nConversation:\n${conversationHistory}`,
            },
          ],
        },
      ],
      tools: geminiTools,
      generationConfig: {
        temperature: 0.7,
      },
    };

    console.log("[update-user-memory] Calling Gemini API for memory extraction");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[update-user-memory] Gemini API error:", errorText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResult = await geminiResponse.json();
    console.log("[update-user-memory] Gemini response:", JSON.stringify(geminiResult));

    // Extract function call result
    let newScopes: any = {};
    const functionCall = geminiResult.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.functionCall
    );

    if (functionCall) {
      newScopes = functionCall.functionCall.args || {};
    } else {
      console.warn("[update-user-memory] No function call in Gemini response");
    }

    // Filter out empty scopes
    const scopesUpdated: string[] = [];
    Object.keys(newScopes).forEach((key) => {
      if (newScopes[key] && Object.keys(newScopes[key]).length === 0) {
        delete newScopes[key];
      } else if (newScopes[key]) {
        scopesUpdated.push(key);
      }
    });

    console.log("[update-user-memory] Extracted scopes:", scopesUpdated);

    // Load existing memory
    const { data: existingMemory } = await supabaseClient
      .from("user_conversation_memory")
      .select("id, memory_summary, metadata")
      .eq("user_id", user.id)
      .single();

    // Merge scopes
    const existingScopes = existingMemory?.metadata?.scopes || {};
    const mergedScopes = { ...existingScopes };

    scopesUpdated.forEach((scope) => {
      mergedScopes[scope] = {
        ...existingScopes[scope],
        ...newScopes[scope],
      };
    });

    // Generate memory summary text
    const memorySummary = Object.entries(mergedScopes)
      .map(([scope, data]) => {
        const scopeName = scope.charAt(0).toUpperCase() + scope.slice(1);
        const scopeText = JSON.stringify(data, null, 2);
        return `${scopeName}:\n${scopeText}`;
      })
      .join("\n\n");

    // UPSERT memory record
    const { data: memoryRecord, error: memoryError } = await supabaseClient
      .from("user_conversation_memory")
      .upsert(
        {
          user_id: user.id,
          memory_summary: memorySummary,
          metadata: { scopes: mergedScopes },
          last_update_trigger: trigger,
          last_conversation_id: conversationId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id, updated_at")
      .single();

    if (memoryError) {
      console.error("[update-user-memory] Error upserting memory:", memoryError);
      return new Response(JSON.stringify({ error: "Failed to save memory" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[update-user-memory] Memory saved:", memoryRecord.id);

    // Generate embeddings (non-blocking, best effort)
    try {
      console.log("[update-user-memory] Calling generate-embeddings");
      const embeddingResult = await supabaseClient.functions.invoke("generate-embeddings", {
        body: {
          texts: [
            {
              id: memoryRecord.id,
              content: memorySummary,
              type: "memory",
            },
          ],
        },
      });

      if (embeddingResult.error) {
        console.warn("[update-user-memory] Embedding generation failed (non-critical):", embeddingResult.error);
      } else {
        console.log("[update-user-memory] Embeddings generated successfully");
      }
    } catch (embeddingError) {
      console.warn("[update-user-memory] Embedding generation error (non-critical):", embeddingError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        memoryId: memoryRecord.id,
        trigger,
        scopesUpdated,
        updatedAt: memoryRecord.updated_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[update-user-memory] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
