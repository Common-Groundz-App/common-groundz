
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse query parameters from URL
    const url = new URL(req.url)
    const photoReference = url.searchParams.get('photoReference')
    const maxWidth = url.searchParams.get('maxWidth') || '400'
    
    console.log(`Received request for photo: ${photoReference}, maxWidth: ${maxWidth}`)
    
    if (!photoReference) {
      console.error('No photoReference provided in query parameters')
      return new Response(
        JSON.stringify({ error: 'Photo reference is required' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
        }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      console.error('Google Places API key not configured')
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
        }
      )
    }

    console.log(`Fetching Google Places photo: ${photoReference}`)

    // Construct the Google Places Photo API URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`
    
    // Fetch the image from Google Places API
    const response = await fetch(photoUrl)
    
    if (!response.ok) {
      console.error(`Google Places API error: ${response.status} ${response.statusText}`)
      return new Response(
        JSON.stringify({ error: `Failed to fetch photo: ${response.status}` }),
        { 
          status: response.status,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
        }
      )
    }

    // Get the image as a blob
    const imageBlob = await response.blob()
    
    console.log(`Successfully fetched image: ${imageBlob.size} bytes, type: ${imageBlob.type}`)
    
    // Return the image with proper headers
    return new Response(imageBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    })

  } catch (error) {
    console.error('Error in get-google-places-photo function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch photo',
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      },
    )
  }
})
