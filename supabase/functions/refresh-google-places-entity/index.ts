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
    detailsUrl.searchParams.append("fields", "displayName,formattedAddress,shortFormattedAddress,location,businessStatus,websiteUri,nationalPhoneNumber,currentOpeningHours,primaryType,types,priceLevel,googleMapsUri,editorialSummary,photos,rating,userRatingCount");
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
    console.log(`✅ Retrieved place details for: ${placeDetails.displayName || placeDetails.name || 'Unknown Place'}`);

    // Get existing entity data to check description source
    const { data: entityData, error: entityError } = await supabase
      .from('entities')
      .select('description, about_source, external_rating, external_rating_count')
      .eq('id', entityId)
      .single();

    if (entityError) {
      console.error('Error fetching entity data:', entityError);
      throw new Error(`Failed to fetch entity data: ${entityError.message}`);
    }

    // Helper functions for description processing
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
        // Auto-generate description from structured data
        const autoDescription = buildAutoAbout(placeDetails);
        descriptionUpdate = { 
          description: sanitize(autoDescription), 
          about_source: 'auto_generated' 
        };
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

    // Generate new proxy image URL using the primary photo reference
    let newImageUrl = null;
    if (primaryPhotoReference) {
      newImageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${primaryPhotoReference}&maxWidth=800`;
      console.log(`🖼️ Generated new image URL: ${newImageUrl}`);
    }

    // Prepare updated metadata
    const updatedMetadata = {
      photo_references: photoReferences,
      photo_reference: primaryPhotoReference,
      last_refreshed_at: new Date().toISOString(),
      place_name: placeDetails.displayName || placeDetails.name,
      formatted_address: placeDetails.formattedAddress || placeDetails.formatted_address,
      short_formatted_address: placeDetails.shortFormattedAddress,
      business_status: placeDetails.businessStatus,
      website_uri: placeDetails.websiteUri,
      national_phone_number: placeDetails.nationalPhoneNumber,
      primary_type: placeDetails.primaryType,
      types: placeDetails.types,
      price_level: placeDetails.priceLevel,
      google_maps_uri: placeDetails.googleMapsUri,
      editorial_summary: placeDetails.editorialSummary,
      location: placeDetails.location,
      rating: placeDetails.rating,
      user_ratings_total: placeDetails.userRatingCount || placeDetails.user_ratings_total,
      ...(descriptionUpdate || {})
    };

    console.log(`✅ Successfully refreshed Google Places entity data`);

    // Update entity with new data
    const { error: updateError } = await supabase
      .from('entities')
      .update({
        ...(descriptionUpdate || {}),
        about_updated_at: new Date().toISOString(),
        external_rating: placeDetails.rating || entityData.external_rating,
        external_rating_count: placeDetails.userRatingCount || placeDetails.user_ratings_total || entityData.external_rating_count,
        metadata: updatedMetadata
      })
      .eq('id', entityId);

    if (updateError) {
      console.error('Error updating entity:', updateError);
      throw new Error(`Failed to update entity: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        photoReferences,
        primaryPhotoReference,
        newImageUrl,
        updatedMetadata,
        descriptionUpdate,
        placeDetails: {
          name: placeDetails.displayName || placeDetails.name,
          formatted_address: placeDetails.formattedAddress || placeDetails.formatted_address,
          rating: placeDetails.rating,
          user_ratings_total: placeDetails.userRatingCount || placeDetails.user_ratings_total
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