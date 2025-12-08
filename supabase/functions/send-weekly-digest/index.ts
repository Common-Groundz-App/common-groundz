import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_INSIGHTS_PER_DIGEST = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);
  console.log(`[Phase6][${runId}] Starting send-weekly-digest`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get users who opted into weekly digest
    const { data: optedInUsers, error: prefError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('weekly_digest_enabled', true);

    if (prefError) {
      console.error(`[Phase6][${runId}] Error fetching preferences:`, prefError);
      throw prefError;
    }

    console.log(`[Phase6][${runId}] Found ${optedInUsers?.length || 0} users with digest enabled`);

    let digestsSent = 0;

    for (const { user_id } of optedInUsers || []) {
      // Get user's stuff for context
      const { data: userStuff } = await supabase
        .from('user_stuff')
        .select('entity_id')
        .eq('user_id', user_id)
        .limit(100);

      const entityIds = userStuff?.map(s => s.entity_id) || [];

      if (entityIds.length === 0) {
        console.log(`[Phase6][${runId}] User ${user_id} has no stuff, skipping`);
        continue;
      }

      // Get recent journeys relevant to user's stuff
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: relevantJourneys } = await supabase
        .from('user_entity_journeys')
        .select(`
          id,
          from_entity_id,
          to_entity_id,
          transition_type,
          confidence,
          evidence_text
        `)
        .in('from_entity_id', entityIds)
        .neq('user_id', user_id)
        .gte('created_at', oneWeekAgo)
        .order('confidence', { ascending: false })
        .limit(MAX_INSIGHTS_PER_DIGEST);

      if (!relevantJourneys?.length) {
        console.log(`[Phase6][${runId}] No relevant journeys for user ${user_id}`);
        continue;
      }

      // Build digest summary
      const insights: string[] = [];
      
      for (const journey of relevantJourneys) {
        const { data: fromEntity } = await supabase
          .from('entities')
          .select('name')
          .eq('id', journey.from_entity_id)
          .single();
        
        const { data: toEntity } = await supabase
          .from('entities')
          .select('name')
          .eq('id', journey.to_entity_id)
          .single();

        if (fromEntity && toEntity) {
          const verb = journey.transition_type === 'upgrade' 
            ? 'upgraded from' 
            : journey.transition_type === 'alternative' 
              ? 'switched from' 
              : 'paired';
          
          insights.push(`• ${verb} ${fromEntity.name} to ${toEntity.name}`);
        }
      }

      if (insights.length === 0) continue;

      // Create digest notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id,
          type: 'journey_digest',
          title: '📊 Your Weekly Journey Digest',
          message: `This week, people similar to you:\n${insights.join('\n')}`,
          entity_type: 'journey',
          action_url: '/my-stuff',
          metadata: {
            journey_count: relevantJourneys.length,
            week_start: oneWeekAgo,
          },
        });

      if (!notifError) {
        digestsSent++;
        console.log(`[Phase6][${runId}] Sent digest to user ${user_id}`);
      }
    }

    console.log(`[Phase6][${runId}] Sent ${digestsSent} digests`);

    return new Response(
      JSON.stringify({
        success: true,
        digests_sent: digestsSent,
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
