
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
  user_id: string;
  username?: string;
}

interface TimelineUpdate {
  id: string;
  rating?: number;
  comment: string;
  created_at: string;
  review_id: string;
  user_id: string;
  username?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entityId } = await req.json();

    if (!entityId) {
      return new Response(
        JSON.stringify({ error: 'Entity ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch entity data
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id, name, type')
      .eq('id', entityId)
      .single();

    if (entityError || !entity) {
      console.error('Error fetching entity:', entityError);
      return new Response(
        JSON.stringify({ error: 'Entity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if summary was recently generated (within last 6 hours for entities)
    const { data: existingEntity } = await supabase
      .from('entities')
      .select('ai_dynamic_review_summary_last_generated_at')
      .eq('id', entityId)
      .single();

    if (existingEntity?.ai_dynamic_review_summary_last_generated_at) {
      const lastGenerated = new Date(existingEntity.ai_dynamic_review_summary_last_generated_at);
      const hoursAgo = (Date.now() - lastGenerated.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 6) {
        console.log(`Summary for entity ${entityId} was generated ${hoursAgo.toFixed(1)} hours ago, skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Summary recently generated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch all dynamic reviews for this entity
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id, title, description, rating, created_at, user_id')
      .eq('entity_id', entityId)
      .eq('has_timeline', true)
      .eq('status', 'published')
      .order('created_at', { ascending: true });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reviews' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reviews?.length) {
      console.log(`No dynamic reviews found for entity ${entityId}`);
      return new Response(
        JSON.stringify({ error: 'No dynamic reviews found for this entity' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs from reviews
    const userIds = [...new Set(reviews.map(r => r.user_id))];

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map of user IDs to usernames
    const userMap = new Map();
    profiles?.forEach(profile => {
      userMap.set(profile.id, profile.username || 'Unknown User');
    });

    // Add usernames to reviews
    const reviewsWithUsernames: ReviewData[] = reviews.map(review => ({
      ...review,
      username: userMap.get(review.user_id) || 'Unknown User'
    }));

    // Fetch all timeline updates for these reviews
    const reviewIds = reviews.map(r => r.id);
    const { data: updates, error: updatesError } = await supabase
      .from('review_updates')
      .select('id, rating, comment, created_at, review_id, user_id')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true });

    if (updatesError) {
      console.error('Error fetching timeline updates:', updatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch timeline updates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs from updates (might include new users not in reviews)
    const updateUserIds = [...new Set((updates || []).map(u => u.user_id))];
    const newUserIds = updateUserIds.filter(id => !userMap.has(id));

    // Fetch profiles for any new users if needed
    if (newUserIds.length > 0) {
      const { data: newProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', newUserIds);

      newProfiles?.forEach(profile => {
        userMap.set(profile.id, profile.username || 'Unknown User');
      });
    }

    // Add usernames to timeline updates
    const updatesWithUsernames: TimelineUpdate[] = (updates || []).map(update => ({
      ...update,
      username: userMap.get(update.user_id) || 'Unknown User'
    }));

    // Generate AI summary
    const summary = await generateEntityAISummary(entity, reviewsWithUsernames, updatesWithUsernames);
    
    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update entity with AI summary
    const { error: updateError } = await supabase
      .from('entities')
      .update({
        ai_dynamic_review_summary: summary.text,
        ai_dynamic_review_summary_last_generated_at: new Date().toISOString(),
        ai_dynamic_review_summary_model_used: summary.model
      })
      .eq('id', entityId);

    if (updateError) {
      console.error('Error updating entity with AI summary:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save AI summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully generated entity AI summary for ${entityId} using ${summary.model}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summary.text,
        model: summary.model
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-entity-ai-summary function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateEntityAISummary(entity: any, reviews: ReviewData[], updates: TimelineUpdate[]): Promise<{ text: string; model: string } | null> {
  if (reviews.length === 0) {
    console.log('No reviews found, skipping AI summary generation');
    return null;
  }

  // Build prompt with entity, reviews, and timeline data
  const prompt = buildEntityAnalysisPrompt(entity, reviews, updates);
  
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

function buildEntityAnalysisPrompt(entity: any, reviews: ReviewData[], updates: TimelineUpdate[]): string {
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();
  
  let prompt = `Analyze all dynamic reviews and timeline updates for "${entity.name}" (${entity.type}) to create an entity-level experience summary:

DYNAMIC REVIEWS (${reviews.length} total):`;

  reviews.forEach((review, index) => {
    const reviewUpdates = updates.filter(u => u.review_id === review.id);
    
    prompt += `\n\n--- Review ${index + 1} by ${review.username || 'User'} (${formatDate(review.created_at)}) ---
Initial: ${review.title} - ${review.description || 'No description'} (Rating: ${review.rating}/5)`;

    if (reviewUpdates.length > 0) {
      prompt += `\nTimeline Updates (${reviewUpdates.length}):`;
      reviewUpdates.forEach((update, updateIndex) => {
        const ratingText = update.rating ? ` - Rating: ${update.rating}/5` : '';
        prompt += `\n  ${updateIndex + 1}. ${formatDate(update.created_at)}: ${update.comment}${ratingText}`;
      });
    }
  });

  prompt += `\n\nGenerate a 2-3 sentence summary that captures:
1. Overall patterns across different users' long-term experiences
2. Consistency vs variability in user satisfaction over time
3. Common themes in how experiences evolve (improvements, declines, or stability)

Focus on entity-level insights rather than individual review details. Be objective and evidence-based.

Output format: Just the summary text, no labels or formatting.`;

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
          maxOutputTokens: 300,
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
          content: 'You are an expert at analyzing multiple user experiences over time to identify patterns and generate entity-level insights. Generate concise, objective summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}
