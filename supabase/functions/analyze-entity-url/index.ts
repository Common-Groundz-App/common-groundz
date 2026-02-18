import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSystemPrompt } from './prompt-generator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // === Auth gate (before body parse) ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;

    // === Admin check via service_role ===
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'NOT_ADMIN' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === Now parse body ===
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [Phase2-URL-Context] Analyzing URL:', url);

    // Use Gemini's URL Context API to analyze directly
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured in Supabase secrets');
    }

    // Generate dynamic prompt from shared config
    const systemPrompt = generateSystemPrompt();

    // Call Gemini with URL grounding + search fallback
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `Analyze this URL and extract all relevant entity data: ${url}` }
              ]
            }
          ],
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemPrompt }]
          },
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.2, topP: 0.8, topK: 40, maxOutputTokens: 2048
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API Error:', errorText);
      throw new Error(`Gemini API failed: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('📊 Gemini Response:', JSON.stringify(geminiData, null, 2));

    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!aiText) {
      console.warn('⚠️ Gemini returned empty text response');
      return new Response(
        JSON.stringify({
          success: false, predictions: null, raw_text: '',
          message: 'Gemini returned empty text. Please apply metadata manually or try again.',
          metadata: { analyzed_url: url, model: 'gemini-2.5-flash', timestamp: new Date().toISOString(), method: 'url_context_grounding', gemini_empty: true }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JSON from response
    let aiPredictions;
    try {
      let jsonText = aiText.trim();
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = jsonText.match(jsonRegex);
      if (match && match[1]) {
        jsonText = match[1].trim();
      } else {
        const plainCodeBlock = /```\s*([\s\S]*?)\s*```/;
        const plainMatch = jsonText.match(plainCodeBlock);
        if (plainMatch && plainMatch[1]) { jsonText = plainMatch[1].trim(); }
      }
      aiPredictions = JSON.parse(jsonText);
      console.log('✅ Parsed AI Predictions:', aiPredictions);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : aiText;
        aiPredictions = JSON.parse(jsonText);
      } catch (finalError) {
        console.error('❌ Final JSON parse failed:', finalError);
        return new Response(
          JSON.stringify({
            success: false, predictions: null, raw_text: aiText,
            message: 'Failed to parse AI response. Please apply metadata manually.',
            metadata: { analyzed_url: url, model: 'gemini-2.5-flash', timestamp: new Date().toISOString(), method: 'url_context_grounding', parse_error: true }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Match category to existing categories in database
    let categoryId: string | null = null;
    let matchedCategoryName: string | null = null;
    const suggestedCategoryPath = aiPredictions.suggested_category || null;
    
    if (suggestedCategoryPath && aiPredictions.type) {
      console.log('🔍 Matching category:', suggestedCategoryPath, 'for type:', aiPredictions.type);
      
      const { data: categories, error: catError } = await supabaseClient
        .from('categories')
        .select('id, name, parent_id')
        .eq('entity_type', aiPredictions.type);
      
      if (!catError && categories && categories.length > 0) {
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const categoryPaths = categories.map(cat => {
          const path: string[] = [];
          let current = cat;
          while (current) { path.unshift(current.name); current = current.parent_id ? categoryMap.get(current.parent_id) : null; }
          return { id: cat.id, name: cat.name, fullPath: path };
        });
        
        const suggestedSegments = suggestedCategoryPath.split('>').map(s => s.trim().toLowerCase());
        let bestMatch = null;
        let bestScore = 0;
        
        for (const catPath of categoryPaths) {
          const pathSegments = catPath.fullPath.map(p => p.toLowerCase());
          let score = 0;
          const minLength = Math.min(suggestedSegments.length, pathSegments.length);
          for (let i = 0; i < minLength; i++) {
            const suggestedPart = suggestedSegments[suggestedSegments.length - 1 - i];
            const pathPart = pathSegments[pathSegments.length - 1 - i];
            if (suggestedPart === pathPart) { score += (i + 2) * 10; }
            else if (suggestedPart.includes(pathPart) || pathPart.includes(suggestedPart)) { score += (i + 1) * 5; }
            else { break; }
          }
          if (score > bestScore) { bestScore = score; bestMatch = catPath; }
        }
        
        if (bestMatch && bestScore >= 10) {
          categoryId = bestMatch.id;
          matchedCategoryName = bestMatch.fullPath.join(' > ');
          console.log('✅ Matched category:', matchedCategoryName, 'with score:', bestScore);
        } else {
          console.log('⚠️ No strong match found. Suggested:', suggestedCategoryPath);
        }
      } else if (catError) {
        console.error('Error fetching categories:', catError);
      }
    }

    const extractedImages = aiPredictions.image_url ? [{ url: aiPredictions.image_url }] : [];

    const result = {
      success: true,
      predictions: {
        type: aiPredictions.type, name: aiPredictions.name, description: aiPredictions.description,
        category_id: categoryId, suggested_category_path: suggestedCategoryPath,
        matched_category_name: matchedCategoryName, tags: aiPredictions.tags || [],
        confidence: aiPredictions.confidence || 0.5, reasoning: aiPredictions.reasoning || 'No reasoning provided',
        additional_data: aiPredictions.additional_data || {},
        image_url: aiPredictions.image_url || null, images: extractedImages
      },
      metadata: { analyzed_url: url, model: 'gemini-2.5-flash', timestamp: new Date().toISOString(), method: 'url_context_grounding' }
    };

    console.log('✅ Final Result:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('❌ analyze-entity-url error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
