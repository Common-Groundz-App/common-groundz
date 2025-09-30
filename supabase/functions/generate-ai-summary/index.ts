
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReviewData {
  id: string;
  title: string;
  description: string;
  rating: number;
  created_at: string;
  ai_summary?: string;
  ai_summary_last_generated_at?: string;
}

interface TimelineUpdate {
  id: string;
  rating?: number;
  comment: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId } = await req.json();

    if (!reviewId) {
      return new Response(
        JSON.stringify({ error: 'Review ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if summary was recently generated (within last 24 hours)
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('ai_summary, ai_summary_last_generated_at')
      .eq('id', reviewId)
      .single();

    if (existingReview?.ai_summary_last_generated_at) {
      const lastGenerated = new Date(existingReview.ai_summary_last_generated_at);
      const hoursAgo = (Date.now() - lastGenerated.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) {
        console.log(`Summary for review ${reviewId} was generated ${hoursAgo.toFixed(1)} hours ago, skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Summary recently generated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch review data
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, title, description, rating, created_at')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      console.error('Error fetching review:', reviewError);
      return new Response(
        JSON.stringify({ error: 'Review not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch timeline updates
    const { data: updates, error: updatesError } = await supabase
      .from('review_updates')
      .select('id, rating, comment, created_at')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });

    if (updatesError) {
      console.error('Error fetching timeline updates:', updatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch timeline updates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate AI summary
    const summary = await generateAISummary(review, updates || []);
    
    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update review with AI summary
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        ai_summary: summary.text,
        ai_summary_last_generated_at: new Date().toISOString(),
        ai_summary_model_used: summary.model
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Error updating review with AI summary:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save AI summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully generated AI summary for review ${reviewId} using ${summary.model}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summary.text,
        model: summary.model
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-ai-summary function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateAISummary(review: ReviewData, updates: TimelineUpdate[]): Promise<{ text: string; model: string } | null> {
  if (updates.length === 0) {
    console.log('No timeline updates found, skipping AI summary generation');
    return null;
  }

  // Build prompt with review and timeline data
  const prompt = buildAnalysisPrompt(review, updates);
  
  // Try Gemini first
  try {
    const geminiSummary = await generateWithGemini(prompt);
    if (geminiSummary) {
      return { text: geminiSummary, model: 'gemini-1.5-flash' };
    }
  } catch (error) {
    console.error('Gemini API failed:', error);
  }

  // Fallback to OpenAI
  try {
    const openaiSummary = await generateWithOpenAI(prompt);
    if (openaiSummary) {
      return { text: openaiSummary, model: 'gpt-4o-mini' };
    }
  } catch (error) {
    console.error('OpenAI API failed:', error);
  }

  return null;
}

function buildAnalysisPrompt(review: ReviewData, updates: TimelineUpdate[]): string {
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();
  
  let prompt = `Analyze this review timeline to create a long-term experience summary:

Initial Review (${formatDate(review.created_at)}): ${review.title}
${review.description || 'No description provided'}
Rating: ${review.rating}/5

Timeline Updates:`;

  updates.forEach((update, index) => {
    const ratingText = update.rating ? ` - Rating: ${update.rating}/5` : '';
    prompt += `\n- Update ${index + 1} (${formatDate(update.created_at)}): ${update.comment}${ratingText}`;
  });

  prompt += `\n\nGenerate:
1. Summary (2-3 sentences capturing key changes/insights about how the experience evolved)
2. Long-term verdict (one of: "Improves with use", "Declines over time", "Mixed results", "Consistently good", "Consistently poor")

Output format: "Summary text here. Long-term verdict: [verdict]"

Keep it objective and focus on the actual experience evolution shown in the timeline.`;

  return prompt;
}

async function generateWithGemini(prompt: string): Promise<string | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found');
    return null;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 200,
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function generateWithOpenAI(prompt: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found');
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing user experiences over time. Generate concise, objective summaries of how experiences evolve.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}
