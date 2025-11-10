import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TextInput {
  id: string;
  content: string;
  type: 'review' | 'profile' | 'memory' | 'relationship';
}

interface EmbeddingResult {
  id: string;
  embedding: number[];
  type: string;
}

interface ErrorResult {
  id: string;
  error: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('generate-embeddings: Request started');

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { texts } = await req.json() as { texts: TextInput[] };

    // Validate input
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'texts array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (texts.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 texts per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${texts.length} texts with types:`, texts.map(t => t.type));

    // Preprocess texts based on content type
    const preprocessedTexts = texts.map(item => {
      if (!item.content || item.content.trim().length === 0) {
        return { id: item.id, text: null, type: item.type };
      }

      let processedText = item.content;

      // Add context based on content type
      switch (item.type) {
        case 'review':
          processedText = `Product Review: ${item.content}`;
          break;
        case 'profile':
          processedText = `User Profile: ${item.content}`;
          break;
        case 'memory':
          processedText = `Conversation Memory: ${item.content}`;
          break;
        case 'relationship':
          processedText = `Product Relationship: ${item.content}`;
          break;
      }

      return { id: item.id, text: processedText, type: item.type };
    });

    // Filter out empty texts and track errors
    const validTexts = preprocessedTexts.filter(item => item.text !== null);
    const errors: ErrorResult[] = preprocessedTexts
      .filter(item => item.text === null)
      .map(item => ({ id: item.id, error: 'Empty content provided' }));

    if (validTexts.length === 0) {
      return new Response(
        JSON.stringify({ 
          embeddings: [], 
          errors: errors.length > 0 ? errors : [{ id: 'all', error: 'No valid texts to process' }] 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calling OpenAI API with ${validTexts.length} valid texts`);

    // Call OpenAI Embeddings API
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: validTexts.map(item => item.text),
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);

      // Handle rate limit errors
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle authentication errors
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Extract embeddings and match them back to original IDs
    const embeddings: EmbeddingResult[] = data.data.map((item: any, index: number) => ({
      id: validTexts[index].id,
      embedding: item.embedding,
      type: validTexts[index].type,
    }));

    const duration = Date.now() - startTime;
    console.log(`Successfully generated ${embeddings.length} embeddings in ${duration}ms`);

    const responseData: any = { embeddings };
    if (errors.length > 0) {
      responseData.errors = errors;
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
