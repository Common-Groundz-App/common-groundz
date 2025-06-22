
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const imageUrl = url.searchParams.get('url')
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate that this is an OpenLibrary URL
    if (!imageUrl.includes('covers.openlibrary.org')) {
      return new Response(
        JSON.stringify({ error: 'Invalid OpenLibrary URL' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Proxying OpenLibrary image:', imageUrl)

    // Fetch the image with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Supabase-Proxy/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('OpenLibrary fetch failed:', response.status, response.statusText)
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${response.status}` }), 
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const imageData = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Return the image with proper headers including caching
    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Content-Length': imageData.byteLength.toString(),
      }
    })

  } catch (error) {
    console.error('Error proxying OpenLibrary image:', error)
    
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Request timeout' }), 
        { 
          status: 408, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Failed to proxy image' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
