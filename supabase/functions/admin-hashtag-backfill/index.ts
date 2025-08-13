
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillState {
  lastProcessedId?: string;
  totalProcessed: number;
  totalErrors: number;
  startTime: string;
}

async function processPostHashtags(supabase: any, postId: string, content: string) {
  const parseHashtags = (text: string) => {
    const regex = /(\B#)([A-Za-z0-9_][A-Za-z0-9_\-\s]{1,49})/g;
    const hashtags = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const original = match[2].trim();
      const normalized = original
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/[^a-z0-9_\-]/g, '');
      
      if (normalized.length >= 2 && normalized.length <= 50 && !/^\d+$/.test(normalized)) {
        hashtags.push({ original, normalized });
      }
    }
    
    return hashtags;
  };

  const hashtags = parseHashtags(content);
  const uniqueHashtags = new Map();
  
  hashtags.forEach(tag => {
    if (!uniqueHashtags.has(tag.normalized)) {
      uniqueHashtags.set(tag.normalized, tag.original);
    }
  });

  for (const [normalized, original] of uniqueHashtags) {
    try {
      // Upsert hashtag
      const { data: hashtag, error: hashtagError } = await supabase
        .from('hashtags')
        .upsert({
          name_original: original,
          name_norm: normalized
        }, {
          onConflict: 'name_norm'
        })
        .select('id')
        .single();
      
      if (hashtagError) continue;
      
      // Create post-hashtag relationship (ignore if exists)
      await supabase
        .from('post_hashtags')
        .upsert({
          post_id: postId,
          hashtag_id: hashtag.id
        });
    } catch (error) {
      console.error(`Error processing hashtag ${normalized}:`, error);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin permission
    const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { batchSize = 200, lastProcessedId } = await req.json();
    
    // Get backfill state for idempotency
    const stateKey = 'hashtag_backfill_state';
    let state: BackfillState = {
      totalProcessed: 0,
      totalErrors: 0,
      startTime: new Date().toISOString()
    };

    // Build query with cursor-based pagination
    let query = supabase
      .from('posts')
      .select('id, content')
      .not('content', 'is', null)
      .eq('is_deleted', false)
      .order('id')
      .limit(batchSize);

    if (lastProcessedId) {
      query = query.gt('id', lastProcessedId);
      state.lastProcessedId = lastProcessedId;
    }

    const { data: posts, error } = await query;
    
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      batchProcessed: 0,
      batchErrors: 0,
      hasMore: posts?.length === batchSize,
      lastProcessedId: null as string | null
    };

    // Process posts in batch
    for (const post of posts || []) {
      try {
        if (post.content && post.content.includes('#')) {
          await processPostHashtags(supabase, post.id, post.content);
        }
        results.batchProcessed++;
        results.lastProcessedId = post.id;
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        results.batchErrors++;
      }
    }

    // Update total state
    state.totalProcessed += results.batchProcessed;
    state.totalErrors += results.batchErrors;
    state.lastProcessedId = results.lastProcessedId;

    // Log progress
    console.log(`Backfill progress: ${state.totalProcessed} processed, ${state.totalErrors} errors, hasMore: ${results.hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        state,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
