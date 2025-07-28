import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GooglePlacesPhoto {
  height: number;
  width: number;
  photo_reference: string;
  html_attributions: string[];
}

interface GooglePlacesDetailsResponse {
  result: {
    photos?: GooglePlacesPhoto[];
  };
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get('place_id');

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'Missing place_id parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch place details with photos field
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`;
    
    console.log(`Fetching Google Places photos for place_id: ${placeId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(detailsUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data: GooglePlacesDetailsResponse = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Places API error:', data.status);
        return new Response(
          JSON.stringify({ 
            error: `Google Places API error: ${data.status}`,
            photos: [] 
          }),
          { 
            status: 200, // Return 200 with empty photos array for graceful degradation
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const photos = data.result.photos || [];
      
      console.log(`Found ${photos.length} photos for place_id: ${placeId}`);

      // Return photo references with metadata
      const photoData = photos.map(photo => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        html_attributions: photo.html_attributions
      }));

      return new Response(
        JSON.stringify({ 
          photos: photoData,
          total_count: photos.length 
        }),
        { 
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          } 
        }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Google Places API request timed out');
        return new Response(
          JSON.stringify({ 
            error: 'Request timed out',
            photos: [] 
          }),
          { 
            status: 200, // Graceful degradation
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Error in fetch-google-places-photos:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch photos',
        photos: [] 
      }),
      { 
        status: 200, // Graceful degradation
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});