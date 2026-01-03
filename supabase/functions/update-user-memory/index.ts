import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper for consistent value normalization across all comparisons
const normalize = (v?: string) => v?.toLowerCase().trim() || '';

// Helper function to add timeout to promises
function withTimeout(promise: Promise<any>, ms: number) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Helper function with retry logic for rate limits and service errors
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 2000 // 2 seconds for memory updates
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await withTimeout(fetch(url, options), 8000);
      
      if (response.status === 503 || response.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(`[update-user-memory] Received ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        const errorType = error instanceof Error && error.message.includes('timeout') ? 'Timeout' : 'Network error';
        console.log(`[update-user-memory] ${errorType}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError || new Error("Memory update failed after retries. Will retry on next conversation.");
}

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

    // Validate trigger (Phase 6.0: added personal-info-shared and assistant-identified-preference)
    const validTriggers = [
      "conversation-end",
      "context-needed", 
      "personal-info-shared",
      "assistant-identified-preference"
    ];
    
    if (!validTriggers.includes(trigger)) {
      return new Response(
        JSON.stringify({ error: `Invalid trigger. Must be one of: ${validTriggers.join(', ')}` }),
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

    const systemPrompt = `You are a memory extraction assistant. Analyze the conversation and extract relevant information into scopes AND detect constraints/preferences.

=== SCOPE EXTRACTION ===
Extract into these scopes:
- skincare: products, routines, skin type, concerns, goals
- food: preferences, allergies, cuisines, restrictions, goals
- movies: genres, actors, viewing habits, favorites, goals
- routines: daily schedules, habits, fitness routines, goals

=== CONSTRAINT DETECTION (Phase 6.0) ===
Detect CONSTRAINTS from user statements. Use confidence scoring:

Intent Classification:
- strictly_avoid (confidence 0.9-1.0): "I never use X", "I'm allergic to X", "I can't have X"
- avoid (confidence 0.7-0.9): "I really avoid X", "I hate X", "I stay away from X"
- limit (confidence 0.4-0.7): "I don't usually like X", "I prefer to avoid X when possible"
- prefer (confidence varies): "I like X", "I prefer X", "I love X"

Examples:
- "I'm allergic to shellfish" → strictly_avoid, confidence 1.0, category: food
- "I really hate horror movies" → avoid, confidence 0.85, category: movies
- "I don't usually use retinol" → limit, confidence 0.6, category: skincare
- "I prefer organic products" → prefer, confidence 0.8, category: skincare

=== PREFERENCE DETECTION ===
Detect custom preferences with confidence:
- Explicit statements → confidence 0.9-1.0
- Strong preferences → confidence 0.7-0.9
- Casual mentions → confidence 0.4-0.7
- Context-inferred → confidence 0.3-0.5

Always include evidence quotes from the conversation!

Use the extract_scoped_memories function to structure your response.`;

    const geminiTools = [
      {
        function_declarations: [
          {
            name: "extract_scoped_memories",
            description: "Extract categorized memories, constraints, and preferences from conversation",
            parameters: {
              type: "object",
              properties: {
                skincare: {
                  type: "object",
                  description: "Skincare routines, products, skin type, concerns, and goals",
                  properties: {
                    skin_type: { type: "string" },
                    concerns: { type: "array", items: { type: "string" } },
                    products_mentioned: { type: "array", items: { type: "string" } },
                    goals: { type: "array", items: { type: "string" } }
                  }
                },
                food: {
                  type: "object",
                  description: "Dietary preferences, allergies, cuisines, restrictions, and goals",
                  properties: {
                    preferences: { type: "array", items: { type: "string" } },
                    allergies: { type: "array", items: { type: "string" } },
                    cuisines: { type: "array", items: { type: "string" } },
                    restrictions: { type: "array", items: { type: "string" } },
                    goals: { type: "array", items: { type: "string" } }
                  }
                },
                movies: {
                  type: "object",
                  description: "Genre preferences, favorite actors, viewing habits, and goals",
                  properties: {
                    genres: { type: "array", items: { type: "string" } },
                    actors: { type: "array", items: { type: "string" } },
                    viewing_habits: { type: "string" },
                    favorites: { type: "array", items: { type: "string" } },
                    goals: { type: "array", items: { type: "string" } }
                  }
                },
                routines: {
                  type: "object",
                  description: "Daily routines, schedules, habits, and goals",
                  properties: {
                    daily_schedule: { type: "string" },
                    habits: { type: "array", items: { type: "string" } },
                    fitness: { type: "string" },
                    goals: { type: "array", items: { type: "string" } }
                  }
                },
                detected_constraints: {
                  type: "array",
                  description: "Constraints detected from conversation with intent and confidence",
                  items: {
                    type: "object",
                    properties: {
                      category: { 
                        type: "string", 
                        description: "Domain: skincare, food, movies, books, fitness, places, lifestyle" 
                      },
                      rule: { 
                        type: "string", 
                        description: "Type of constraint: Avoid ingredient, Avoid genre, Avoid brand, Prefer texture, etc." 
                      },
                      value: { 
                        type: "string", 
                        description: "The specific thing to avoid/prefer" 
                      },
                      intent: { 
                        type: "string", 
                        enum: ["strictly_avoid", "avoid", "limit", "prefer"],
                        description: "How strictly to enforce: strictly_avoid (never), avoid (strongly), limit (when possible), prefer (prioritize)"
                      },
                      confidence: { 
                        type: "number", 
                        description: "0.0-1.0 confidence score based on statement strength" 
                      },
                      evidence: { 
                        type: "string", 
                        description: "Direct quote from conversation supporting this constraint" 
                      }
                    },
                    required: ["category", "rule", "value", "intent", "confidence"]
                  }
                },
                detected_preferences: {
                  type: "array",
                  description: "Custom preferences detected from conversation",
                  items: {
                    type: "object",
                    properties: {
                      category: { 
                        type: "string", 
                        description: "Domain: skincare, food, movies, books, fitness, lifestyle" 
                      },
                      key: { 
                        type: "string", 
                        description: "Preference label like texture_preference, reading_time, workout_style" 
                      },
                      value: { 
                        type: "string", 
                        description: "The preference value" 
                      },
                      confidence: { 
                        type: "number", 
                        description: "0.0-1.0 confidence score" 
                      },
                      evidence: { 
                        type: "string", 
                        description: "Quote from conversation supporting this preference" 
                      }
                    },
                    required: ["category", "key", "value", "confidence"]
                  }
                }
              }
            }
          }
        ]
      }
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

    console.log("[update-user-memory] Calling Gemini API for memory extraction (Phase 6.0)");

    const geminiResponse = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      },
      3,
      2000
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[update-user-memory] Gemini API error:", errorText);
      
      if (geminiResponse.status === 429 || geminiResponse.status === 503) {
        console.warn("[update-user-memory] AI service temporarily unavailable, skipping memory update");
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Memory update skipped due to rate limits. Will retry on next conversation." 
          }), 
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResult = await geminiResponse.json();
    console.log("[update-user-memory] Gemini response:", JSON.stringify(geminiResult));

    // Extract function call result
    let newScopes: any = {};
    let detectedConstraints: any[] = [];
    let detectedPreferences: any[] = [];
    
    const functionCall = geminiResult.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.functionCall
    );

    if (functionCall) {
      const args = functionCall.functionCall.args || {};
      
      // Extract scopes (existing behavior)
      newScopes = { ...args };
      delete newScopes.detected_constraints;
      delete newScopes.detected_preferences;
      
      // Extract Phase 6.0 data
      detectedConstraints = args.detected_constraints || [];
      detectedPreferences = args.detected_preferences || [];
      
      console.log("[update-user-memory] Detected constraints:", detectedConstraints.length);
      console.log("[update-user-memory] Detected preferences:", detectedPreferences.length);
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
    const existingConstraints = existingMemory?.metadata?.detected_constraints || [];
    const existingPreferences = existingMemory?.metadata?.detected_preferences || [];
    
    const mergedScopes = { ...existingScopes };

    scopesUpdated.forEach((scope) => {
      mergedScopes[scope] = {
        ...existingScopes[scope],
        ...newScopes[scope],
      };
    });

    // Get existing TTA constraints from user's saved preferences (check BOTH legacy and unified keys)
    const legacyConstraints = (profile?.preferences as any)?.constraints?.items || [];
    const unifiedConstraints = (profile?.preferences as any)?.unifiedConstraints?.items || [];
    const existingTTAConstraints = [...legacyConstraints, ...unifiedConstraints];
    
    // Get dismissed inline items (from chip confirmations)
    const dismissedInline = existingMemory?.metadata?.dismissed_inline || [];
    
    // Get existing preference values from user's saved preferences (canonical categories)
    const existingSkinType = (profile?.preferences as any)?.skin_type?.values || [];
    const existingHairType = (profile?.preferences as any)?.hair_type?.values || [];
    const existingFoodPrefs = (profile?.preferences as any)?.food_preferences?.values || [];
    const existingLifestyle = (profile?.preferences as any)?.lifestyle?.values || [];
    const existingGenres = (profile?.preferences as any)?.genre_preferences?.values || [];
    const existingGoals = (profile?.preferences as any)?.goals?.values || [];
    
    // EXPLICIT PRECEDENCE RULE:
    // 1. User-confirmed constraints (unifiedConstraints) always win
    // 2. Inline-confirmed items (dismissed_inline) suppress learned memory
    // 3. Learned-from-conversation is fallback only
    
    // Merge detected constraints (avoid duplicates by value+category AND check against existing TTA)
    const mergedConstraints = [...existingConstraints];
    for (const newConstraint of detectedConstraints) {
      const normalizedNewValue = normalize(newConstraint.value);
      
      const existsInMemory = mergedConstraints.some(
        c => c.category === newConstraint.category && 
             normalize(c.value) === normalizedNewValue
      );
      
      // Check against existing TTA (both legacy and unified constraints)
      const existsInTTA = existingTTAConstraints.some(
        (uc: any) => normalize(uc.normalizedValue) === normalizedNewValue ||
                     normalize(uc.value) === normalizedNewValue
      );
      
      // Check against dismissed inline items (user already confirmed via chips)
      const wasDismissedInline = dismissedInline.some(
        (d: any) => normalize(d.value) === normalizedNewValue
      );
      
      if (existsInMemory) {
        console.log(`[update-user-memory] Skipping constraint "${newConstraint.value}" - already in memory`);
      } else if (existsInTTA) {
        console.log(`[update-user-memory] Skipping constraint "${newConstraint.value}" - already in TTA`);
      } else if (wasDismissedInline) {
        console.log(`[update-user-memory] Skipping constraint "${newConstraint.value}" - dismissed via inline chip`);
      } else {
        mergedConstraints.push({
          ...newConstraint,
          extractedAt: new Date().toISOString(),
          source: 'chatbot'
        });
      }
    }

    // Merge detected preferences (avoid duplicates by key+category AND check against existing preferences + dismissed_inline)
    const mergedPreferences = [...existingPreferences];
    for (const newPref of detectedPreferences) {
      const normalizedNewValue = normalize(newPref.value);
      
      // Check which existing preference list to compare against based on category
      let existingPreferenceValues: any[] = [];
      if (newPref.category === 'skincare') {
        existingPreferenceValues = [...existingSkinType, ...existingGoals];
      } else if (newPref.category === 'food') {
        existingPreferenceValues = [...existingFoodPrefs, ...existingLifestyle];
      } else if (newPref.category === 'movies') {
        existingPreferenceValues = existingGenres;
      } else if (newPref.category === 'haircare') {
        existingPreferenceValues = existingHairType;
      }
      
      // Check if this preference value already exists in user's saved preferences
      const existsInSavedPrefs = existingPreferenceValues.some(
        (pv: any) => normalize(pv.normalizedValue) === normalizedNewValue ||
                     normalize(pv.value) === normalizedNewValue
      );
      
      // Check against dismissed inline items (user already confirmed via chips)
      const wasDismissedInline = dismissedInline.some(
        (d: any) => normalize(d.value) === normalizedNewValue
      );
      
      if (existsInSavedPrefs) {
        console.log(`[update-user-memory] Skipping preference "${newPref.value}" - already in saved preferences`);
        continue;
      }
      
      if (wasDismissedInline) {
        console.log(`[update-user-memory] Skipping preference "${newPref.value}" - dismissed via inline chip`);
        continue;
      }
      
      const existingIdx = mergedPreferences.findIndex(
        p => p.category === newPref.category && p.key === newPref.key
      );
      if (existingIdx >= 0) {
        // Update if new confidence is higher
        if (newPref.confidence > mergedPreferences[existingIdx].confidence) {
          mergedPreferences[existingIdx] = {
            ...newPref,
            extractedAt: new Date().toISOString(),
            source: 'chatbot'
          };
        }
      } else {
        mergedPreferences.push({
          ...newPref,
          extractedAt: new Date().toISOString(),
          source: 'chatbot'
        });
      }
    }

    // Generate memory summary text
    const memorySummary = Object.entries(mergedScopes)
      .map(([scope, data]) => {
        const scopeName = scope.charAt(0).toUpperCase() + scope.slice(1);
        const scopeText = JSON.stringify(data, null, 2);
        return `${scopeName}:\n${scopeText}`;
      })
      .join("\n\n");

    // UPSERT memory record with Phase 6.0 data
    // INVARIANT: User-confirmed preferences are authoritative and must never be
    // removed or downgraded by automated processes. Preserve dismissed_inline.
    const { data: memoryRecord, error: memoryError } = await supabaseClient
      .from("user_conversation_memory")
      .upsert(
        {
          user_id: user.id,
          memory_type: 'preference',
          memory_summary: memorySummary,
          metadata: { 
            ...existingMemory?.metadata,  // Preserve existing keys (dismissed_inline, etc.)
            scopes: mergedScopes,
            detected_constraints: mergedConstraints,
            detected_preferences: mergedPreferences
          },
          last_update_trigger: trigger,
          last_conversation_id: conversationId,
        },
        { onConflict: "user_id" }
      )
      .select("id, last_accessed_at")
      .single();

    if (memoryError) {
      console.error("[update-user-memory] Error upserting memory:", memoryError);
      return new Response(JSON.stringify({ error: "Failed to save memory" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[update-user-memory] Memory saved:", memoryRecord.id);
    console.log("[update-user-memory] Total constraints:", mergedConstraints.length);
    console.log("[update-user-memory] Total preferences:", mergedPreferences.length);

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
        constraintsDetected: detectedConstraints.length,
        preferencesDetected: detectedPreferences.length,
        updatedAt: memoryRecord.last_accessed_at,
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
