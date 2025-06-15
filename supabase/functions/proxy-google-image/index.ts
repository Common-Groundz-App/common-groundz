
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const photoReference = url.searchParams.get('ref')
    const maxWidth = url.searchParams.get('maxWidth') || '400'
    
    if (!photoReference) {
      return new Response(
        JSON.stringify({ error: 'Photo reference is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`
    
    const response = await fetch(photoUrl)
    
    if (!response.ok) {
      console.error(`Google Places API error: ${response.status}`)
      return new Response(
        JSON.stringify({ error: `Failed to fetch photo: ${response.status}` }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const imageBlob = await response.blob()
    
    return new Response(imageBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })

  } catch (error) {
    console.error('Error in proxy-google-image function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch photo'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
