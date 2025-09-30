import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 Starting cached photos cleanup...');

    // Call the cleanup function
    const { data: deletedCount, error } = await supabase.rpc('cleanup_expired_cached_photos');

    if (error) {
      console.error('❌ Error during cleanup:', error);
      return new Response(
        JSON.stringify({ error: error.message, deletedCount: 0 }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Cleanup completed: ${deletedCount || 0} expired photos deleted`);

    // Get cache statistics for monitoring
    const { data: statsData, error: statsError } = await supabase
      .from('cached_photos')
      .select('quality_level, expires_at')
      .order('created_at', { ascending: false });

    let stats = {
      totalCached: 0,
      expired: 0,
      byQuality: {} as Record<string, number>
    };

    if (!statsError && statsData) {
      const now = new Date();
      stats.totalCached = statsData.length;
      
      statsData.forEach(photo => {
        // Count by quality
        stats.byQuality[photo.quality_level] = (stats.byQuality[photo.quality_level] || 0) + 1;
        
        // Count expired
        if (new Date(photo.expires_at) < now) {
          stats.expired++;
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: deletedCount || 0,
        message: `Cleanup completed: ${deletedCount || 0} expired photos deleted`,
        stats
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during cleanup',
        deletedCount: 0 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});