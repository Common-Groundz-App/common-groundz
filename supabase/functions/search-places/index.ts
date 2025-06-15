
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
    const { query, maxResults = 20 } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📍 Searching places for: "${query}"`)

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      throw new Error('Google Places API key not configured')
    }

    // Google Places Text Search API
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&type=establishment`
    
    const response = await fetch(placesUrl)
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      console.log(`No places found for query: "${query}"`)
      return new Response(
        JSON.stringify({ results: [], total: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Transform Google Places data to our format
    const transformedResults = data.results.slice(0, maxResults).map((place: any) => {
      console.log(`Processing place: ${place.name}, Address: ${place.formatted_address}`)
      
      // Use proxy for photo URLs to avoid CORS issues
      let imageUrl = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=300&h=200&fit=crop'
      
      if (place.photos && place.photos[0]) {
        const photoRef = place.photos[0].photo_reference
        imageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${photoRef}&maxWidth=300`
        console.log(`Determined image URL for ${place.name}: ${imageUrl.substring(0, 80)}...`)
      } else {
        console.log(`Using fallback image for ${place.name}`)
      }

      return {
        id: place.place_id,
        name: place.name,
        venue: place.formatted_address || '',
        description: place.types?.join(', ') || '',
        image_url: imageUrl,
        api_source: 'google_places',
        api_ref: place.place_id,
        type: 'place',
        metadata: {
          rating: place.rating || null,
          price_level: place.price_level || null,
          user_ratings_total: place.user_ratings_total || 0,
          types: place.types || [],
          business_status: place.business_status || null,
          geometry: place.geometry || null
        }
      }
    })

    console.log(`✅ Found ${transformedResults.length} places from Google Places`)

    return new Response(
      JSON.stringify({ 
        results: transformedResults,
        total: data.results.length,
        source: 'google_places'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in place search:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search places',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
