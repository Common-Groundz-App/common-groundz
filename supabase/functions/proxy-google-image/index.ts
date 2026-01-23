
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires',
}

// Allowed image widths for optimization and consistency
const ALLOWED_WIDTHS = [400, 800, 1200, 1600];
const DEFAULT_WIDTH = 400;

// Simple in-memory cache for frequently requested images
const imageCache = new Map<string, { data: Blob, contentType: string, timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (increased from 1 hour)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const photoReference = url.searchParams.get('ref')
    const requestedWidth = url.searchParams.get('maxWidth') || DEFAULT_WIDTH.toString()
    
    if (!photoReference) {
      return new Response(
        JSON.stringify({ error: 'Photo reference is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate and normalize width to allowed values
    const requestedWidthNum = parseInt(requestedWidth, 10);
    const maxWidth = ALLOWED_WIDTHS.includes(requestedWidthNum) 
      ? requestedWidthNum 
      : ALLOWED_WIDTHS.reduce((prev, curr) => 
          Math.abs(curr - requestedWidthNum) < Math.abs(prev - requestedWidthNum) ? curr : prev
        );

    if (requestedWidthNum !== maxWidth) {
      console.log(`📐 Width ${requestedWidthNum} not allowed, using closest: ${maxWidth}`);
    }

    // Check cache first
    const cacheKey = `${photoReference}_${maxWidth}`;
    const cached = imageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📸 Serving cached image for ${photoReference}`);
      return new Response(cached.data, {
        headers: {
          ...corsHeaders,
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      console.error('Google Places API key not configured');
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`
    
    console.log(`📸 Fetching Google Places photo: ${photoReference} (${maxWidth}px)`);
    
    // Add timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(photoUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Supabase Edge Function/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Google Places API error: ${response.status} ${response.statusText}`);
        
        // For 401 errors, return a specific error message
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Google Places API authentication failed',
              details: 'Invalid or expired API key'
            }),
            { 
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        return new Response(
          JSON.stringify({ error: `Failed to fetch photo: ${response.status}` }),
          { 
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const imageBlob = await response.blob()
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      
      // Cache the successful response
      imageCache.set(cacheKey, {
        data: imageBlob,
        contentType,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries
      if (imageCache.size > 100) { // Keep cache size reasonable
        const cutoff = Date.now() - CACHE_DURATION;
        for (const [key, value] of imageCache.entries()) {
          if (value.timestamp < cutoff) {
            imageCache.delete(key);
          }
        }
      }
      
      console.log(`✅ Successfully served image: ${imageBlob.size} bytes (${contentType})`);
      
      return new Response(imageBlob, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        },
      })
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout for photo reference:', photoReference);
        return new Response(
          JSON.stringify({ error: 'Request timeout' }),
          { 
            status: 408,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Error in proxy-google-image function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch photo',
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
