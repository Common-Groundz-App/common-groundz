
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const googleAIApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClassificationResult {
  category: 'book' | 'movie' | 'place' | 'food' | 'product' | 'person' | 'general';
  confidence: number;
  reasoning: string;
  api_used: 'gemini' | 'openai' | 'fallback';
}

async function classifyWithGemini(query: string): Promise<ClassificationResult> {
  console.log('🤖 Attempting classification with Gemini 2.5 Flash Preview...');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleAIApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Classify this search query into ONE of these categories: book, movie, place, food, product, person, general.

Query: "${query}"

Respond with valid JSON format:
{
  "category": "book",
  "confidence": 0.9,
  "reasoning": "brief explanation"
}

Categories:
- book: Books, novels, literature, authors
- movie: Films, TV shows, series, actors, directors
- place: Restaurants, cafes, locations, venues, addresses
- food: Recipes, dishes, ingredients, cuisines
- product: Items to buy, brands, shopping, electronics
- person: People's names, celebrities, professionals
- general: Everything else, ambiguous queries`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    throw new Error('No content received from Gemini API');
  }

  // Clean up the response to extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in Gemini response');
  }

  const result = JSON.parse(jsonMatch[0]);
  console.log(`✅ Gemini classification successful:`, result);

  return {
    category: result.category,
    confidence: result.confidence,
    reasoning: result.reasoning,
    api_used: 'gemini'
  };
}

async function classifyWithOpenAI(query: string): Promise<ClassificationResult> {
  console.log('🔄 Falling back to OpenAI GPT-4o-mini...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a search query classifier. Classify the user query into ONE of these categories: book, movie, place, food, product, person, general. Respond with JSON format: {"category": "book", "confidence": 0.9, "reasoning": "brief explanation"}'
        },
        {
          role: 'user',
          content: `Classify this search query: "${query}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  console.log(`✅ OpenAI classification successful:`, result);

  return {
    category: result.category,
    confidence: result.confidence,
    reasoning: result.reasoning,
    api_used: 'openai'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ 
          category: 'general', 
          confidence: 0.5, 
          reasoning: 'Query too short for classification',
          api_used: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let classificationResult: ClassificationResult;

    // Try Gemini first (primary, free)
    if (googleAIApiKey) {
      try {
        classificationResult = await classifyWithGemini(query);
      } catch (error) {
        console.error('❌ Gemini classification failed:', (error as Error).message);
        
        // Fallback to OpenAI if available
        if (openAIApiKey) {
          try {
            classificationResult = await classifyWithOpenAI(query);
          } catch (openAIError) {
            console.error('❌ OpenAI fallback also failed:', (openAIError as Error).message);
            throw new Error('Both Gemini and OpenAI classification failed');
          }
        } else {
          throw new Error('Gemini failed and no OpenAI key available');
        }
      }
    } else if (openAIApiKey) {
      // If no Gemini key, use OpenAI directly
      console.log('⚠️ No Gemini API key found, using OpenAI directly');
      classificationResult = await classifyWithOpenAI(query);
    } else {
      // No API keys available, return fallback
      console.log('⚠️ No API keys available, using fallback classification');
      classificationResult = {
        category: 'general',
        confidence: 0.5,
        reasoning: 'No LLM APIs available for classification',
        api_used: 'fallback'
      };
    }

    console.log(`🤖 Final classification for "${query}":`, classificationResult);

    return new Response(
      JSON.stringify({
        classification: classificationResult.category,
        confidence: classificationResult.confidence,
        reasoning: classificationResult.reasoning,
        api_used: classificationResult.api_used
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Classification error:', error);
    return new Response(
      JSON.stringify({ 
        classification: 'general', 
        confidence: 0.5,
        reasoning: 'Classification service error',
        api_used: 'fallback',
        error: (error as Error).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
