import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

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
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("Google Places API key is required for backfill");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("🔄 Starting entity description backfill process");

    // Get entities that need description backfill
    const { data: entities, error: fetchError } = await supabase
      .from('entities')
      .select('id, name, description, about_source, api_ref, metadata')
      .eq('api_source', 'google_places')
      .or('description.is.null,about_source.is.null')
      .eq('is_deleted', false)
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('Error fetching entities:', fetchError);
      throw new Error(`Failed to fetch entities: ${fetchError.message}`);
    }

    if (!entities || entities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No entities found requiring description backfill',
          processed: 0,
          stats: {}
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📝 Found ${entities.length} entities to process`);

    // Helper functions
    const sanitize = (text: string): string => {
      return text.replace(/<[^>]+>/g, ' ')  // strip HTML
                 .replace(/\s+/g, ' ')      // collapse whitespace
                 .trim()
                 .slice(0, 300);           // cap at 300 chars
    };

    const buildAutoAbout = (details: any): string => {
      const chips: string[] = [];
      
      // Add price level
      if (details.priceLevel != null) {
        chips.push('₹'.repeat(Math.min(Math.max(details.priceLevel, 1), 4)));
      }
      
      // Add rating if available
      if (details.rating && details.userRatingCount) {
        chips.push(`⭐ ${details.rating.toFixed(1)} (${details.userRatingCount})`);
      }
      
      // Add business status
      if (details.businessStatus === 'OPERATIONAL') {
        chips.push('Open');
      } else if (details.businessStatus === 'CLOSED_PERMANENTLY') {
        chips.push('Permanently closed');
      }

      const typeLabel = details.primaryType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
      const areaLabel = details.shortFormattedAddress?.split(',')[0] || 'this area';
      const chipText = chips.length ? ` • ${chips.join(' • ')}` : '';
      
      return `${typeLabel} in ${areaLabel}${chipText}`;
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process entities with rate limiting
    const processed = [];
    const stats = {
      user_brand: 0,
      google_editorial: 0, 
      auto_generated: 0,
      address_fallback: 0,
      errors: 0
    };

    for (const entity of entities) {
      try {
        // Skip if entity has user/brand description 
        const hasAuthorCopy = entity.description && ['user', 'brand'].includes(entity.about_source || '');
        
        if (hasAuthorCopy) {
          console.log(`⏭️ Skipping ${entity.name} - has user/brand content`);
          stats.user_brand++;
          processed.push({
            id: entity.id,
            name: entity.name,
            status: 'skipped_user_brand'
          });
          continue;
        }

        // Fetch fresh Google Places data
        console.log(`🔍 Processing ${entity.name}...`);
        
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.append("place_id", entity.api_ref);
        detailsUrl.searchParams.append("fields", "displayName,formattedAddress,shortFormattedAddress,location,businessStatus,websiteUri,nationalPhoneNumber,currentOpeningHours,primaryType,types,priceLevel,googleMapsUri,editorialSummary,photos,rating,userRatingCount");
        detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

        const response = await fetch(detailsUrl.toString());
        
        if (!response.ok) {
          console.error(`❌ Google Places API error for ${entity.name}: ${response.status}`);
          stats.errors++;
          continue;
        }

        const data = await response.json();
        
        if (data.error_message) {
          console.error(`❌ Google Places API error for ${entity.name}: ${data.error_message}`);
          stats.errors++;
          continue;
        }

        if (!data.result) {
          console.error(`❌ No place details found for ${entity.name}`);
          stats.errors++;
          continue;
        }

        const placeDetails = data.result;

        // Process description based on priority logic
        let descriptionUpdate: { description?: string; about_source?: string } | null = null;

        const editorial = placeDetails.editorialSummary?.overview?.trim();
        if (editorial) {
          const sanitizedText = sanitize(editorial);
          descriptionUpdate = { 
            description: sanitizedText, 
            about_source: 'google_editorial' 
          };
          stats.google_editorial++;
          console.log(`📝 Using editorial summary for ${entity.name}`);
        } else {
          // Auto-generate description from structured data
          const autoDescription = buildAutoAbout(placeDetails);
          descriptionUpdate = { 
            description: sanitize(autoDescription), 
            about_source: 'auto_generated' 
          };
          stats.auto_generated++;
          console.log(`🤖 Generated description for ${entity.name}: ${descriptionUpdate.description}`);
        }

        // Update entity
        if (descriptionUpdate) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({
              ...descriptionUpdate,
              about_updated_at: new Date().toISOString(),
              external_rating: placeDetails.rating,
              external_rating_count: placeDetails.userRatingCount
            })
            .eq('id', entity.id);

          if (updateError) {
            console.error(`❌ Error updating ${entity.name}:`, updateError);
            stats.errors++;
          } else {
            processed.push({
              id: entity.id,
              name: entity.name,
              status: 'updated',
              source: descriptionUpdate.about_source
            });
            console.log(`✅ Updated ${entity.name} with ${descriptionUpdate.about_source} description`);
          }
        }

        // Rate limiting: wait 100ms between requests
        await delay(100);

      } catch (error) {
        console.error(`❌ Error processing ${entity.name}:`, error);
        stats.errors++;
      }
    }

    console.log("📊 Backfill Statistics:");
    console.log(`  User/Brand content preserved: ${stats.user_brand}`);
    console.log(`  Google Editorial used: ${stats.google_editorial}`);
    console.log(`  Auto-generated: ${stats.auto_generated}`);
    console.log(`  Address fallback: ${stats.address_fallback}`);
    console.log(`  Errors: ${stats.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processed.length,
        stats,
        entities: processed
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in backfill-entity-descriptions function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});