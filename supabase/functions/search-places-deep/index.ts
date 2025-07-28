
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📍 Deep places search for: "${query}"`);

    const results = [];

    // Search Google Places API for comprehensive place data
    try {
      const googlePlacesApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
      if (googlePlacesApiKey) {
        console.log("📍 Searching Google Places API...");
        
        // Text search for places
        const searchResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googlePlacesApiKey}`
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.results) {
            for (const place of searchData.results.slice(0, 8)) {
              // Get detailed place information
              try {
                const detailResponse = await fetch(
                  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,rating,user_ratings_total,photos,types,opening_hours,website,formatted_phone_number,price_level&key=${googlePlacesApiKey}`
                );
                
                if (detailResponse.ok) {
                  const detail = await detailResponse.json();
                  const placeDetail = detail.result;
                  
                  let imageUrl = null;
                  let photoReferences = [];
                  if (placeDetail.photos && placeDetail.photos.length > 0) {
                    // Use first photo as primary image_url
                    imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${placeDetail.photos[0].photo_reference}&key=${googlePlacesApiKey}`;
                    
                    // Store all photo references for multiple images
                    photoReferences = placeDetail.photos.map(photo => ({
                      photo_reference: photo.photo_reference,
                      width: photo.width,
                      height: photo.height,
                      html_attributions: photo.html_attributions
                    }));
                  }
                  
                  results.push({
                    name: placeDetail.name,
                    venue: placeDetail.formatted_address,
                    description: `${placeDetail.types?.[0]?.replace(/_/g, ' ') || 'Place'} • Rating: ${placeDetail.rating || 'N/A'}/5`,
                    image_url: imageUrl,
                    api_source: 'google_places',
                    api_ref: place.place_id,
                    type: 'place',
                    metadata: {
                      rating: placeDetail.rating,
                      user_ratings_total: placeDetail.user_ratings_total,
                      types: placeDetail.types,
                      opening_hours: placeDetail.opening_hours,
                      website: placeDetail.website,
                      phone: placeDetail.formatted_phone_number,
                      price_level: placeDetail.price_level,
                      photo_references: photoReferences,
                      // Keep single photo_reference for backward compatibility
                      photo_reference: placeDetail.photos?.[0]?.photo_reference || null
                    }
                  });
                }
              } catch (detailError) {
                console.error('Error fetching place details:', detailError);
                // Fallback to basic info
                results.push({
                  name: place.name,
                  venue: place.formatted_address,
                  description: `${place.types?.[0]?.replace(/_/g, ' ') || 'Place'} • Rating: ${place.rating || 'N/A'}/5`,
                  image_url: null,
                  api_source: 'google_places',
                  api_ref: place.place_id,
                  type: 'place',
                  metadata: {
                    rating: place.rating,
                    user_ratings_total: place.user_ratings_total,
                    types: place.types
                  }
                });
              }
            }
            console.log(`✅ Found ${results.length} places from Google Places`);
          }
        }
      }
    } catch (error) {
      console.error('Google Places API error:', error);
    }

    // Search Foursquare as backup if we have fewer results
    try {
      const foursquareApiKey = Deno.env.get("FOURSQUARE_API_KEY");
      if (foursquareApiKey && results.length < 6) {
        console.log("📍 Searching Foursquare API...");
        const foursquareResponse = await fetch(
          `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&limit=10`,
          {
            headers: {
              'Authorization': foursquareApiKey,
              'Accept': 'application/json'
            }
          }
        );
        
        if (foursquareResponse.ok) {
          const foursquareData = await foursquareResponse.json();
          if (foursquareData.results) {
            for (const venue of foursquareData.results.slice(0, 6 - results.length)) {
              // Avoid duplicates
              const alreadyExists = results.some(r => 
                r.name.toLowerCase() === venue.name?.toLowerCase() &&
                r.venue.includes(venue.location?.locality || '')
              );
              
              if (!alreadyExists && venue.name) {
                results.push({
                  name: venue.name,
                  venue: `${venue.location?.locality || ''}, ${venue.location?.region || ''} ${venue.location?.country || ''}`.trim(),
                  description: `${venue.categories?.[0]?.name || 'Place'} • Foursquare`,
                  image_url: null,
                  api_source: 'foursquare',
                  api_ref: venue.fsq_id,
                  type: 'place',
                  metadata: {
                    categories: venue.categories?.map(c => c.name),
                    address: venue.location?.formatted_address,
                    distance: venue.distance
                  }
                });
              }
            }
            console.log(`✅ Found ${results.length} total places including Foursquare`);
          }
        }
      }
    } catch (error) {
      console.error('Foursquare API error:', error);
    }

    return new Response(
      JSON.stringify({ results: results.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-places-deep:", error);
    return new Response(
      JSON.stringify({ error: error.message, results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
