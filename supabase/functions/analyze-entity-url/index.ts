import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [v2.5-URL-TEXT-FIX] Analyzing URL:', url);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use Gemini's URL Context API to analyze directly
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured in Supabase secrets');
    }

    const systemPrompt = `You are an expert entity analyzer for a recommendation platform. Analyze the provided URL and extract structured entity information.

**Instructions:**
1. Determine the entity type (book, movie, app, product, place, food, tv_show, person, or others)
2. Extract a clean, proper name (not the site name)
3. Write a concise 2-3 sentence description suitable for users
4. Suggest the best matching category path (e.g., "Books > Fantasy", "Movies > Action & Adventure")
5. Generate 3-5 relevant tags (lowercase, hyphenated, e.g., "classic", "science-fiction")
6. Provide a confidence score (0.0-1.0)
7. Extract any structured data like prices, ratings, authors, cast, etc.
8. Explain your reasoning

**Entity Types Available:**
- book, movie, app, product, place, food, tv_show, person, others

**Return ONLY valid JSON** in this exact format:
{
  "type": "book",
  "name": "The Hobbit",
  "description": "A fantasy adventure novel by J.R.R. Tolkien about Bilbo Baggins' journey with dwarves to reclaim their treasure from the dragon Smaug.",
  "suggested_category": "Books > Fantasy",
  "tags": ["classic", "adventure", "fantasy", "tolkien"],
  "confidence": 0.95,
  "reasoning": "URL pattern matches Goodreads book page, title and author clearly identified",
  "additional_data": {
    "author": "J.R.R. Tolkien",
    "publication_year": 1937,
    "rating": 4.3,
    "pages": 310
  }
}`;

    // Call Gemini with URL context
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: url }
            ]
          }],
          tools: [
            { urlContext: {} }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
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
      throw new Error('Gemini returned empty response');
    }

    // Extract JSON from response
    let aiPredictions;
    try {
      const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/) || 
                       aiText.match(/```\n([\s\S]*?)\n```/) ||
                       aiText.match(/\{[\s\S]*\}/);
      
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      aiPredictions = JSON.parse(jsonText);
      
      console.log('✅ Parsed AI Predictions:', aiPredictions);
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw AI text:', aiText);
      throw new Error('AI returned invalid JSON format');
    }

    // Match category to existing categories in database
    let categoryId = null;
    let matchedCategory = null;
    
    if (aiPredictions.suggested_category && aiPredictions.type) {
      const leafCategory = aiPredictions.suggested_category.split(' > ').pop()?.trim();
      
      if (leafCategory) {
        const { data: categories, error: catError } = await supabaseClient
          .from('categories')
          .select('id, name, parent_id')
          .eq('entity_type', aiPredictions.type)
          .ilike('name', `%${leafCategory}%`)
          .limit(1);
        
        if (!catError && categories && categories.length > 0) {
          categoryId = categories[0].id;
          matchedCategory = categories[0].name;
          console.log('✅ Matched category:', matchedCategory);
        } else {
          console.log('⚠️ No matching category found for:', leafCategory);
        }
      }
    }

    // Extract images if provided by Gemini
    const extractedImages = aiPredictions.images || [];

    // Return structured result
    const result = {
      success: true,
      predictions: {
        type: aiPredictions.type,
        name: aiPredictions.name,
        description: aiPredictions.description,
        category_id: categoryId,
        suggested_category_path: aiPredictions.suggested_category,
        matched_category_name: matchedCategory,
        tags: aiPredictions.tags || [],
        confidence: aiPredictions.confidence || 0.5,
        reasoning: aiPredictions.reasoning || 'No reasoning provided',
        additional_data: aiPredictions.additional_data || {},
        images: extractedImages
      },
      metadata: {
        analyzed_url: url,
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString(),
        method: 'url_context_api'
      }
    };

    console.log('✅ Final Result:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ analyze-entity-url error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
