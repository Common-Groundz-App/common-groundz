
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires',
}

// Enhanced cache with performance tracking
const photoCache = new Map<string, { 
  data: Uint8Array; 
  contentType: string; 
  timestamp: number;
  hitCount: number;
}>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours (same as other proxies)

interface RequestMetric {
  startTime: number;
  cacheHit: boolean;
  success: boolean;
  responseSize: number;
  duration: number;
}

function logPerformanceMetric(photoRef: string, metric: RequestMetric) {
  const status = metric.success ? '✓' : '✗'
  const cache = metric.cacheHit ? '[CACHED]' : '[FRESH]'
  const sizeMB = (metric.responseSize / (1024 * 1024)).toFixed(2)
  
  console.log(`📍 ${status} ${cache} ${metric.duration}ms ${sizeMB}MB - Google Places: ${photoRef}`)
  
  if (!metric.success) {
    console.error(`❌ Google Places photo failed for: ${photoRef}`)
  }
}

serve(async (req) => {
  const startTime = Date.now()
  let metric: RequestMetric = {
    startTime,
    cacheHit: false,
    success: false,
    responseSize: 0,
    duration: 0
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse query parameters from URL
    const url = new URL(req.url)
    const photoReference = url.searchParams.get('photoReference')
    const maxWidth = url.searchParams.get('maxWidth') || '400'
    
    console.log(`🔍 Received request for photo: ${photoReference}, maxWidth: ${maxWidth}`)
    
    if (!photoReference) {
      console.error('No photoReference provided in query parameters')
      metric.duration = Date.now() - startTime
      logPerformanceMetric('', metric)
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
      metric.duration = Date.now() - startTime
      logPerformanceMetric(photoReference, metric)
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

    // Check cache first
    const cacheKey = `${photoReference}_${maxWidth}`
    const cached = photoCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      cached.hitCount++
      metric.cacheHit = true
      metric.success = true
      metric.responseSize = cached.data.length
      metric.duration = Date.now() - startTime
      
      logPerformanceMetric(photoReference, metric)
      
      return new Response(cached.data, {
        headers: {
          ...corsHeaders,
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          'ETag': `"${cached.timestamp}"`,
          'Last-Modified': new Date(cached.timestamp).toUTCString(),
          'X-Cache': 'HIT',
          'X-Cache-Hits': cached.hitCount.toString()
        },
      })
    }

    console.log(`🔍 Fetching Google Places photo: ${photoReference}`)

    // Construct the Google Places Photo API URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`
    
    // Fetch the image from Google Places API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(photoUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error(`Google Places API error: ${response.status} ${response.statusText}`)
      metric.duration = Date.now() - startTime
      logPerformanceMetric(photoReference, metric)
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

    // Get the image as array buffer
    const imageData = await response.arrayBuffer()
    const uint8Array = new Uint8Array(imageData)
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    
    console.log(`✅ Successfully fetched image: ${uint8Array.length} bytes, type: ${contentType}`)
    
    // Cache the image
    photoCache.set(cacheKey, {
      data: uint8Array,
      contentType,
      timestamp: Date.now(),
      hitCount: 0
    })

    // Clean up old cache entries
    if (photoCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of photoCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          photoCache.delete(key)
        }
      }
    }

    metric.success = true
    metric.responseSize = uint8Array.length
    metric.duration = Date.now() - startTime
    logPerformanceMetric(photoReference, metric)
    
    // Return the image with enhanced cache headers
    return new Response(uint8Array, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Content-Length': uint8Array.byteLength.toString(),
        'ETag': `"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString(),
        'X-Cache': 'MISS',
        'X-Proxy-Performance': `${metric.duration}ms`
      },
    })

  } catch (error) {
    console.error('Error in get-google-places-photo function:', error)
    metric.duration = Date.now() - startTime
    logPerformanceMetric(photoReference || 'unknown', metric)
    
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Request timeout' }),
        { 
          status: 408,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
        }
      )
    }
    
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
