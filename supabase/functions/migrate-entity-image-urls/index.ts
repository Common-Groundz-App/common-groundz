/**
 * Entity Image URL Migration
 * 
 * One-time migration to fix existing entities that have proxy URLs in image_url
 * but have stored photos available in metadata.stored_photo_urls.
 * 
 * EXECUTION PLAN:
 * 1. Deploy this function
 * 2. Call once via Supabase dashboard or curl
 * 3. Verify results
 * 4. Disable/remove after migration
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting entity image URL migration...');

    // Find entities with proxy URLs in image_url
    const { data: entitiesToFix, error: fetchError } = await supabase
      .from('entities')
      .select('id, name, image_url, metadata')
      .or('image_url.ilike.%proxy-google-image%,image_url.ilike.%proxy-google-books%,image_url.ilike.%proxy-movie-image%')
      .eq('is_deleted', false);

    if (fetchError) {
      console.error('Error fetching entities:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${entitiesToFix?.length || 0} entities with proxy URLs`);

    let fixed = 0;
    let skipped = 0;
    const fixedEntities: string[] = [];
    const skippedEntities: string[] = [];

    for (const entity of entitiesToFix || []) {
      const storedPhotos = entity.metadata?.stored_photo_urls;
      
      if (storedPhotos && Array.isArray(storedPhotos) && storedPhotos.length > 0 && storedPhotos[0]?.storedUrl) {
        const newImageUrl = storedPhotos[0].storedUrl;
        
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: newImageUrl })
          .eq('id', entity.id);

        if (!updateError) {
          fixed++;
          fixedEntities.push(`${entity.name} (${entity.id})`);
          console.log(`✅ Fixed: ${entity.name} -> ${newImageUrl.substring(0, 50)}...`);
        } else {
          console.error(`❌ Failed to update ${entity.name}:`, updateError);
          skipped++;
          skippedEntities.push(`${entity.name} (update error)`);
        }
      } else {
        skipped++;
        skippedEntities.push(`${entity.name} (no stored photos)`);
        console.log(`⏭️ Skipped (no stored photos): ${entity.name}`);
      }
    }

    const result = {
      message: `Migration complete. Fixed ${fixed}, skipped ${skipped}.`,
      fixed,
      skipped,
      total: entitiesToFix?.length || 0,
      fixedEntities,
      skippedEntities
    };

    console.log('🎉 Migration complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
