
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory cache for images (1 hour TTL)
const imageCache = new Map<string, { data: Uint8Array; contentType: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const imageUrl = url.searchParams.get('url')
    
    if (!imageUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    console.log('📚 Fetching Google Books image:', imageUrl)

    // Check cache first
    const cacheKey = imageUrl
    const cached = imageCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('📚 Serving cached Google Books image')
      return new Response(cached.data, {
        headers: {
          ...corsHeaders,
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    // Fetch the image with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('📚 Failed to fetch Google Books image:', response.status, response.statusText)
      return new Response('Failed to fetch image', { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const imageData = await response.arrayBuffer()
    const uint8Array = new Uint8Array(imageData)
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Cache the image
    imageCache.set(cacheKey, {
      data: uint8Array,
      contentType,
      timestamp: Date.now()
    })

    // Clean up old cache entries (basic cleanup)
    if (imageCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of imageCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          imageCache.delete(key)
        }
      }
    }

    console.log(`📚 Successfully served Google Books image: ${uint8Array.length} bytes (${contentType})`)

    return new Response(uint8Array, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })

  } catch (error) {
    console.error('📚 Error fetching Google Books image:', error)
    return new Response('Internal server error', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})
