
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ classification: 'general', confidence: 0.5 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log(`🤖 LLM Classification for "${query}":`, result);

    return new Response(
      JSON.stringify({
        classification: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Classification error:', error);
    return new Response(
      JSON.stringify({ 
        classification: 'general', 
        confidence: 0.5,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
