import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { batchSize = 10 } = await req.json();

    console.log('🔄 Starting place photos migration job...');

    // Fetch place entities without stored_photo_urls
    const { data: placeEntities, error: fetchError } = await supabase
      .from('entities')
      .select('id, name, metadata')
      .eq('type', 'place')
      .eq('api_source', 'google_places')
      .or('stored_photo_urls.is.null,stored_photo_urls.eq.[]')
      .not('metadata->photo_references', 'is', null)
      .limit(batchSize);
    
    if (fetchError) {
      throw new Error(`Failed to fetch entities: ${fetchError.message}`);
    }

    if (!placeEntities || placeEntities.length === 0) {
      console.log('✅ No more entities to migrate');
      return new Response(
        JSON.stringify({ 
          success: true, 
          migrated: 0,
          message: 'All entities migrated'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📦 Found ${placeEntities.length} entities to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const entity of placeEntities) {
      try {
        const metadata = entity.metadata as any;
        const placeId = metadata?.place_id;
        const photoReferences = metadata?.photo_references;

        if (!placeId || !photoReferences || !Array.isArray(photoReferences)) {
          console.log(`⏭️ Skipping entity ${entity.id} (${entity.name}): missing data`);
          continue;
        }

        console.log(`📸 Migrating ${photoReferences.length} photos for: ${entity.name}`);

        const { data, error } = await supabase.functions.invoke('batch-store-place-photos', {
          body: {
            entityId: entity.id,
            placeId,
            photoReferences: photoReferences.map((p: any) => ({
              photo_reference: p.photo_reference,
              width: p.width,
              height: p.height
            }))
          }
        });

        if (error) {
          console.error(`Failed to migrate ${entity.name}:`, error);
          failed++;
        } else {
          migrated++;
          console.log(`✅ Migrated ${entity.name}: ${data?.storedPhotos?.length || 0} photos`);
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error migrating entity ${entity.id}:`, err);
        failed++;
      }
    }

    console.log(`✅ Migration batch complete: ${migrated} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        migrated,
        failed,
        total: placeEntities.length,
        hasMore: placeEntities.length === batchSize
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error in migrate-place-photos:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
