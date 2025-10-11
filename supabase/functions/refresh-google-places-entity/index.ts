import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const requestData = await req.json();
    const { entityId, placeId } = requestData;

    console.log("🔄 Refreshing Google Places entity:", { entityId, placeId });
    console.log("🔑 Google Places API Key available:", !!GOOGLE_PLACES_API_KEY);

    if (!entityId || !placeId) {
      return new Response(
        JSON.stringify({ error: "Entity ID and Place ID are required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Fetch fresh place details from Google Places API
    console.log(`📍 Fetching fresh place details for: ${placeId}`);
    
    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.append("place_id", placeId);
    detailsUrl.searchParams.append("fields", "name,formatted_address,vicinity,geometry,business_status,website,formatted_phone_number,opening_hours,types,price_level,url,editorial_summary,photos,rating,user_ratings_total");
    detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

    const response = await fetch(detailsUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; EntityApp/1.0)'
      }
    });

    console.log(`📡 Google Places API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error_message) {
      throw new Error(`Google Places API error: ${data.error_message}`);
    }

    if (!data.result) {
      throw new Error("No place details found");
    }

    const placeDetails = data.result;
    console.log(`✅ Retrieved place details for: ${placeDetails.name || 'Unknown Place'}`);

    // Get existing entity data to check description source (for refresh) or use defaults (for creation)
    let entityData = null;
    
    if (entityId !== 'temp') {
      const { data, error: entityError } = await supabase
        .from('entities')
        .select('description, about_source, external_rating, external_rating_count')
        .eq('id', entityId)
        .single();

      if (entityError) {
        console.error('Error fetching entity data:', entityError);
        throw new Error(`Failed to fetch entity data: ${entityError.message}`);
      }
      entityData = data;
    } else {
      // For entity creation (temp entityId), use defaults
      entityData = {
        description: null,
        about_source: null,
        external_rating: null,
        external_rating_count: null
      };
      console.log('🆕 Processing new entity creation with temporary ID');
    }

    // Helper functions for description processing
    const sanitize = (text: string): string => {
      return text.replace(/<[^>]+>/g, ' ')  // strip HTML
                 .replace(/\s+/g, ' ')      // collapse whitespace
                 .trim()
                 .slice(0, 300);           // cap at 300 chars
    };

    const buildAutoAbout = (details: any): string | null => {
      // Don't generate auto descriptions - return null to use fallback message
      return null;
    };

    // Check if entity has user/brand description that shouldn't be overwritten
    const hasAuthorCopy = entityData.description && ['user', 'brand'].includes(entityData.about_source || '');

    // Process description based on priority logic
    let descriptionUpdate: { description?: string; about_source?: string } | null = null;

    if (!hasAuthorCopy) {
      const editorial = placeDetails.editorialSummary?.overview?.trim();
      if (editorial) {
        const sanitizedText = sanitize(editorial);
        // Update if no description exists or current source is google_editorial
        if (!entityData.description || entityData.about_source === 'google_editorial') {
          descriptionUpdate = { 
            description: sanitizedText, 
            about_source: 'google_editorial' 
          };
        }
      } else {
        // No editorial summary and no auto-generation - use null to trigger fallback
        const autoDescription = buildAutoAbout(placeDetails);
        if (autoDescription) {
          descriptionUpdate = { 
            description: sanitize(autoDescription), 
            about_source: 'auto_generated' 
          };
        } else {
          // Set to null to trigger frontend fallback message
          descriptionUpdate = { 
            description: null, 
            about_source: null 
          };
        }
      }
    }

    // Extract photo references
    let photoReferences = [];
    let primaryPhotoReference = null;

    if (placeDetails.photos && placeDetails.photos.length > 0) {
      photoReferences = placeDetails.photos.map((photo: any) => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        html_attributions: photo.html_attributions || []
      }));
      
      primaryPhotoReference = placeDetails.photos[0].photo_reference;
      console.log(`📸 Found ${photoReferences.length} photo references, primary: ${primaryPhotoReference.substring(0, 50)}...`);
    } else {
      console.log("⚠️ No photos found for this place");
    }
    
    // Batch store photos in Supabase Storage
    let storedPhotoUrls = [];
    if (photoReferences.length > 0) {
      // Use temp storage path during creation, real entity ID after
      const storageEntityId = entityId === 'temp' ? `temp-${placeId}` : entityId;
      
      // Before invocation - detailed logging
      console.log('📦 About to invoke batch-store-place-photos', {
        originalEntityId: entityId,
        storageEntityId,
        isTemp: entityId === 'temp',
        placeId,
        photoCount: photoReferences.length,
        firstPhotoRef: photoReferences[0]?.photo_reference?.substring(0, 20),
        samplePhoto: {
          ref: photoReferences[0]?.photo_reference?.substring(0, 30) + '...',
          width: photoReferences[0]?.width,
          height: photoReferences[0]?.height
        }
      });

      try {
        const { data: storeResult, error: storeError } = await supabase.functions.invoke(
          'batch-store-place-photos',
          {
            body: {
              entityId: storageEntityId, // Use temp-{placeId} or real entity ID
              placeId,
              photoReferences: photoReferences.map((p: any) => ({
                photo_reference: p.photo_reference,
                width: p.width,
                height: p.height
              }))
            }
          }
        );
        
        console.log('📦 Batch invoke response received', {
          hasData: !!storeResult,
          hasError: !!storeError,
          errorDetails: storeError,
          resultKeys: storeResult ? Object.keys(storeResult) : [],
          storedPhotosCount: storeResult?.storedPhotos?.length || 0
        });
        
        if (storeError) {
          console.error('❌ Batch store error:', {
            message: storeError.message,
            code: storeError.code,
            details: storeError.details,
            hint: storeError.hint,
            fullError: JSON.stringify(storeError)
          });
        } else if (storeResult?.storedPhotos) {
          storedPhotoUrls = storeResult.storedPhotos;
          console.log(`✅ Successfully stored ${storedPhotoUrls.length} photos`, {
            firstStoredUrl: storedPhotoUrls[0]?.storedUrl?.substring(0, 100),
            allReferences: storedPhotoUrls.map((p: any) => p.reference?.substring(0, 20))
          });
        } else {
          console.warn('⚠️ Batch store returned success but no storedPhotos array', {
            resultType: typeof storeResult,
            resultKeys: storeResult ? Object.keys(storeResult) : [],
            fullResult: JSON.stringify(storeResult)
          });
        }
      } catch (batchError: any) {
        console.error('❌ Exception during batch storage:', {
          name: batchError.name,
          message: batchError.message,
          stack: batchError.stack,
          fullError: JSON.stringify(batchError, Object.getOwnPropertyNames(batchError))
        });
      }
    }

    // Generate new proxy image URL using the primary photo reference
    let newImageUrl = null;
    if (primaryPhotoReference) {
      newImageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${primaryPhotoReference}&maxWidth=800`;
      console.log(`🖼️ Generated new image URL: ${newImageUrl}`);
    }

    // Prepare updated metadata with stored photo URLs
    const updatedMetadata = {
      photo_references: photoReferences,
      photo_reference: primaryPhotoReference,
      stored_photo_urls: storedPhotoUrls.length > 0 ? storedPhotoUrls : undefined,
      storage_entity_id: entityId === 'temp' ? `temp-${placeId}` : entityId,
      last_refreshed_at: new Date().toISOString(),
      place_name: placeDetails.name,
      formatted_address: placeDetails.formatted_address,
      vicinity: placeDetails.vicinity,
      business_status: placeDetails.business_status,
      website_uri: placeDetails.website,
      national_phone_number: placeDetails.formatted_phone_number,
      types: placeDetails.types,
      price_level: placeDetails.price_level,
      google_maps_uri: placeDetails.url,
      editorial_summary: placeDetails.editorial_summary,
      location: placeDetails.geometry?.location,
      rating: placeDetails.rating,
      user_ratings_total: placeDetails.user_ratings_total,
      ...(descriptionUpdate || {})
    };

    console.log(`✅ Successfully refreshed Google Places entity data`);

    // Update entity with new data (only if not creation mode)
    if (entityId !== 'temp') {
      const updatePayload: any = {
        ...(descriptionUpdate || {}),
        about_updated_at: new Date().toISOString(),
        external_rating: placeDetails.rating || entityData.external_rating,
        external_rating_count: placeDetails.user_ratings_total || entityData.external_rating_count,
        metadata: updatedMetadata
      };
      
      // Add stored_photo_urls if we have them
      if (storedPhotoUrls.length > 0) {
        updatePayload.stored_photo_urls = storedPhotoUrls;
      }
      
      const { error: updateError } = await supabase
        .from('entities')
        .update(updatePayload)
        .eq('id', entityId);

      if (updateError) {
        console.error('Error updating entity:', updateError);
        throw new Error(`Failed to update entity: ${updateError.message}`);
      }
    } else {
      console.log('🆕 Skipping database update for entity creation mode');
    }

    return new Response(
      JSON.stringify({
        success: true,
        photoReferences,
        primaryPhotoReference,
        newImageUrl,
        updatedMetadata,
        descriptionUpdate,
        // Return enrichedData for enhancedEntityService.ts compatibility
        enrichedData: {
          name: placeDetails.name,
          formatted_address: placeDetails.formatted_address,
          rating: placeDetails.rating,
          user_ratings_total: placeDetails.user_ratings_total,
          description: descriptionUpdate?.description,
          about_source: descriptionUpdate?.about_source,
          about_updated_at: descriptionUpdate ? new Date().toISOString() : null,
          metadata: updatedMetadata
        },
        // Keep placeDetails for backward compatibility
        placeDetails: {
          name: placeDetails.name,
          formatted_address: placeDetails.formatted_address,
          rating: placeDetails.rating,
          user_ratings_total: placeDetails.user_ratings_total
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("❌ Error in refresh-google-places-entity function:", error);
    
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