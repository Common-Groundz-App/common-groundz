
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced cache with performance tracking - standardized to 24 hours
const imageCache = new Map<string, { 
  data: Uint8Array; 
  contentType: string; 
  timestamp: number;
  hitCount: number;
}>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours (standardized)

interface RequestMetric {
  startTime: number;
  cacheHit: boolean;
  success: boolean;
  responseSize: number;
  duration: number;
}

function logPerformanceMetric(url: string, metric: RequestMetric) {
  const status = metric.success ? '✓' : '✗'
  const cache = metric.cacheHit ? '[CACHED]' : '[FRESH]'
  const sizeMB = (metric.responseSize / (1024 * 1024)).toFixed(2)
  
  console.log(`📚 ${status} ${cache} ${metric.duration}ms ${sizeMB}MB - Google Books: ${url}`)
  
  if (!metric.success) {
    console.error(`❌ Google Books proxy failed for: ${url}`)
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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const imageUrl = url.searchParams.get('url')
    
    if (!imageUrl) {
      metric.duration = Date.now() - startTime
      logPerformanceMetric('', metric)
      return new Response('Missing url parameter', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    console.log('🔍 Fetching Google Books image:', imageUrl)

    // Check cache first with enhanced tracking
    const cacheKey = imageUrl
    const cached = imageCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      cached.hitCount++
      metric.cacheHit = true
      metric.success = true
      metric.responseSize = cached.data.length
      metric.duration = Date.now() - startTime
      
      logPerformanceMetric(imageUrl, metric)
      
      return new Response(cached.data, {
        headers: {
          ...corsHeaders,
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          'ETag': `"${cached.timestamp}"`,
          'Last-Modified': new Date(cached.timestamp).toUTCString(),
          'X-Cache': 'HIT',
          'X-Cache-Hits': cached.hitCount.toString()
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
      console.error('Failed to fetch Google Books image:', response.status, response.statusText)
      metric.duration = Date.now() - startTime
      logPerformanceMetric(imageUrl, metric)
      return new Response('Failed to fetch image', { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const imageData = await response.arrayBuffer()
    const uint8Array = new Uint8Array(imageData)
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Cache the image with enhanced tracking
    imageCache.set(cacheKey, {
      data: uint8Array,
      contentType,
      timestamp: Date.now(),
      hitCount: 0
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

    metric.success = true
    metric.responseSize = uint8Array.length
    metric.duration = Date.now() - startTime
    logPerformanceMetric(imageUrl, metric)

    console.log(`✅ Successfully served Google Books image: ${uint8Array.length} bytes (${contentType})`)

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
      }
    })

  } catch (error) {
    console.error('Error fetching Google Books image:', error)
    metric.duration = Date.now() - startTime
    logPerformanceMetric(imageUrl || 'unknown', metric)
    
    if (error.name === 'AbortError') {
      return new Response('Request timeout', { 
        status: 408,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }
    
    return new Response('Internal server error', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})
