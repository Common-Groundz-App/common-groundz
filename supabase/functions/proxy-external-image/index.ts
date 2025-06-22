
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced cache with performance tracking
const imageCache = new Map<string, { 
  data: Uint8Array; 
  contentType: string; 
  timestamp: number;
  etag?: string;
  lastModified?: string;
  hitCount: number;
}>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Performance metrics
interface RequestMetric {
  startTime: number;
  cacheHit: boolean;
  success: boolean;
  responseSize: number;
  duration: number;
}

// Whitelist of allowed domains for security
const ALLOWED_DOMAINS = [
  // Social media
  'instagram.com', 'cdninstagram.com', 'fbcdn.net',
  'pinterest.com', 'pinimg.com',
  'twitter.com', 'twimg.com',
  'facebook.com', 'fbcdn.net',
  
  // E-commerce
  'amazon.com', 'images-amazon.com', 'm.media-amazon.com',
  'ebay.com', 'ebayimg.com',
  'walmart.com', 'walmartimages.com',
  'target.com', 'target.scene7.com',
  'shopify.com', 'shopifycdn.com',
  
  // News sites
  'cnn.com', 'cdn.cnn.com',
  'bbc.com', 'bbci.co.uk',
  'reuters.com', 'reuters.tv',
  'nytimes.com', 'nyt.com',
  
  // Image hosts
  'imgur.com', 'i.imgur.com',
  'flickr.com', 'staticflickr.com', 'live.staticflickr.com',
  'unsplash.com', 'images.unsplash.com',
  
  // Other common image sources
  'wikimedia.org', 'wikipedia.org',
  'cloudinary.com',
  'amazonaws.com',
  'googleusercontent.com'
]

function isAllowedDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    return ALLOWED_DOMAINS.some(allowed => 
      domain === allowed || domain.endsWith('.' + allowed)
    )
  } catch {
    return false
  }
}

function logPerformanceMetric(url: string, metric: RequestMetric) {
  const status = metric.success ? '✓' : '✗'
  const cache = metric.cacheHit ? '[CACHED]' : '[FRESH]'
  const sizeMB = (metric.responseSize / (1024 * 1024)).toFixed(2)
  
  console.log(`🖼️  ${status} ${cache} ${metric.duration}ms ${sizeMB}MB - ${url}`)
  
  if (!metric.success) {
    console.error(`❌ Proxy failed for: ${url}`)
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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const imageUrl = url.searchParams.get('url')
    
    if (!imageUrl) {
      metric.duration = Date.now() - startTime
      logPerformanceMetric('', metric)
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Security check: only allow whitelisted domains
    if (!isAllowedDomain(imageUrl)) {
      console.warn('Blocked non-whitelisted domain:', imageUrl)
      metric.duration = Date.now() - startTime
      logPerformanceMetric(imageUrl, metric)
      return new Response(
        JSON.stringify({ error: 'Domain not allowed' }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔍 Proxying external image:', imageUrl)

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
          'ETag': cached.etag || `"${cached.timestamp}"`,
          'Last-Modified': cached.lastModified || new Date(cached.timestamp).toUTCString(),
          'X-Cache': 'HIT',
          'X-Cache-Hits': cached.hitCount.toString()
        }
      })
    }

    // Fetch the image with timeout and proper headers
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Supabase-Proxy/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': new URL(imageUrl).origin, // Some sites require this
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('External image fetch failed:', response.status, response.statusText)
      metric.duration = Date.now() - startTime
      logPerformanceMetric(imageUrl, metric)
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${response.status}` }), 
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const imageData = await response.arrayBuffer()
    const uint8Array = new Uint8Array(imageData)
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      console.error('Invalid content type:', contentType)
      metric.duration = Date.now() - startTime
      logPerformanceMetric(imageUrl, metric)
      return new Response(
        JSON.stringify({ error: 'Invalid image content type' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Cache the image with enhanced metadata
    const etag = response.headers.get('etag')
    const lastModified = response.headers.get('last-modified')
    
    imageCache.set(cacheKey, {
      data: uint8Array,
      contentType,
      timestamp: Date.now(),
      etag: etag || undefined,
      lastModified: lastModified || undefined,
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

    // Return the image with enhanced cache headers
    return new Response(uint8Array, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Content-Length': uint8Array.byteLength.toString(),
        'ETag': etag || `"${Date.now()}"`,
        'Last-Modified': lastModified || new Date().toUTCString(),
        'X-Cache': 'MISS',
        'X-Proxy-Performance': `${metric.duration}ms`
      }
    })

  } catch (error) {
    console.error('Error proxying external image:', error)
    metric.duration = Date.now() - startTime
    logPerformanceMetric(imageUrl || 'unknown', metric)
    
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
