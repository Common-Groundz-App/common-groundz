import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: max notifications per user per week
const MAX_NOTIFICATIONS_PER_WEEK = 2;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);
  console.log(`[Phase6][${runId}] Starting generate-smart-notifications`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users with watched items
    const { data: watchedItems, error: watchError } = await supabase
      .from('user_stuff')
      .select(`
        user_id,
        entity_id,
        entities:entity_id(id, name, type, image_url)
      `)
      .eq('watch_for_upgrades', true);

    if (watchError) {
      console.error(`[Phase6][${runId}] Error fetching watched items:`, watchError);
      throw watchError;
    }

    console.log(`[Phase6][${runId}] Found ${watchedItems?.length || 0} watched items`);

    let notificationsCreated = 0;

    // Process each watched item
    for (const item of watchedItems || []) {
      const userId = item.user_id;
      const entityId = item.entity_id;
      const entity = item.entities as any;

      // Check rate limit - count notifications sent this week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'journey_watched')
        .gte('created_at', oneWeekAgo);

      if ((recentCount || 0) >= MAX_NOTIFICATIONS_PER_WEEK) {
        console.log(`[Phase6][${runId}] User ${userId} hit rate limit, skipping`);
        continue;
      }

      // Check for recent journeys from similar users for this entity
      const { data: recentJourneys, error: journeyError } = await supabase
        .from('user_entity_journeys')
        .select(`
          id,
          to_entity_id,
          transition_type,
          confidence,
          user_id
        `)
        .eq('from_entity_id', entityId)
        .gte('created_at', oneWeekAgo)
        .neq('user_id', userId)
        .order('confidence', { ascending: false })
        .limit(5);

      if (journeyError || !recentJourneys?.length) {
        continue;
      }

      // Check if this journey was already notified
      for (const journey of recentJourneys) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'journey_watched')
          .eq('metadata->from_entity_id', entityId)
          .eq('metadata->to_entity_id', journey.to_entity_id)
          .maybeSingle();

        if (existingNotif) {
          continue; // Already notified about this journey
        }

        // Get target entity details
        const { data: toEntity } = await supabase
          .from('entities')
          .select('id, name, type, image_url, slug')
          .eq('id', journey.to_entity_id)
          .single();

        if (!toEntity) continue;

        // Create notification
        const transitionLabel = journey.transition_type === 'upgrade' 
          ? 'upgraded to' 
          : journey.transition_type === 'alternative' 
            ? 'switched to' 
            : 'also uses';

        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'journey_watched',
            title: `Journey update for ${entity?.name || 'your item'}`,
            message: `A similar user ${transitionLabel} ${toEntity.name}`,
            entity_type: 'journey',
            entity_id: journey.id,
            image_url: toEntity.image_url,
            action_url: `/entity/${toEntity.slug || toEntity.id}`,
            metadata: {
              from_entity_id: entityId,
              to_entity_id: journey.to_entity_id,
              transition_type: journey.transition_type,
              confidence: journey.confidence,
            },
          });

        if (!notifError) {
          notificationsCreated++;
          console.log(`[Phase6][${runId}] Created notification for user ${userId}`);
          break; // Only one notification per watched item per run
        }
      }
    }

    console.log(`[Phase6][${runId}] Created ${notificationsCreated} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notificationsCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[Phase6][${runId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
