import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === Auth gate (before body parse) ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;

    // === Admin check via service_role ===
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'NOT_ADMIN' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === Now parse body ===
    const { entityId } = await req.json();

    if (!entityId) {
      return new Response(
        JSON.stringify({ error: 'Entity ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refreshing metadata for entity: ${entityId}`);

    // Fetch the current entity
    const { data: entity, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (fetchError || !entity) {
      console.error('Error fetching entity:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Entity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedMetadata = entity.metadata || {};
    let refreshed = false;

    // Handle Google Places entities
    if (entity.api_source === 'google_places' && entity.api_ref && googlePlacesApiKey) {
      console.log(`Refreshing Google Places metadata for place_id: ${entity.api_ref}`);
      
      try {
        const placesResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${entity.api_ref}&fields=name,formatted_address,photos,rating,user_ratings_total,geometry,types,business_status,opening_hours,website,formatted_phone_number&key=${googlePlacesApiKey}`
        );

        if (placesResponse.ok) {
          const placesData = await placesResponse.json();
          
          if (placesData.result) {
            const result = placesData.result;
            
            // Extract photo references
            const photoReferences = result.photos ? result.photos.map((photo: any) => photo.photo_reference) : [];
            const primaryPhotoReference = photoReferences[0] || null;

            // Update metadata with fresh Google Places data
            updatedMetadata = {
              ...updatedMetadata,
              place_id: entity.api_ref,
              google_places: {
                place_id: entity.api_ref,
                name: result.name,
                formatted_address: result.formatted_address,
                rating: result.rating,
                user_ratings_total: result.user_ratings_total,
                geometry: result.geometry,
                types: result.types,
                business_status: result.business_status,
                opening_hours: result.opening_hours,
                website: result.website,
                formatted_phone_number: result.formatted_phone_number,
                photo_references: photoReferences,
                primary_photo_reference: primaryPhotoReference,
                last_refreshed: new Date().toISOString()
              }
            };

            // Update photo_reference if we have one
            const updateData: any = {
              metadata: updatedMetadata,
              updated_at: new Date().toISOString()
            };

            if (primaryPhotoReference) {
              updateData.photo_reference = primaryPhotoReference;
            }

            refreshed = true;
            console.log('Successfully refreshed Google Places metadata');
          }
        }
      } catch (error) {
        console.error('Error fetching Google Places data:', error);
      }
    }

    // Handle other entity types - can be extended later
    if (entity.api_source === 'google_books' && entity.api_ref) {
      console.log(`Google Books metadata refresh for ${entity.api_ref} - functionality can be added here`);
    }

    if (entity.api_source === 'tmdb' && entity.api_ref) {
      console.log(`TMDB metadata refresh for ${entity.api_ref} - functionality can be added here`);
    }

    // Update the entity with refreshed metadata
    const { error: updateError } = await supabase
      .from('entities')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId);

    if (updateError) {
      console.error('Error updating entity metadata:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update entity metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log admin action (userId already validated above)
    await supabase.from('admin_actions').insert({
      admin_user_id: userId,
      action_type: 'refresh_entity_metadata',
      target_type: 'entity',
      target_id: entityId,
      details: {
        entity_name: entity.name,
        api_source: entity.api_source,
        refreshed: refreshed
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        metadata: updatedMetadata,
        refreshed: refreshed,
        message: refreshed ? 'Metadata successfully refreshed' : 'No new data available'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in refresh-entity-metadata function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
