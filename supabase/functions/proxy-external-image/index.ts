import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Security check: only allow whitelisted domains
    if (!isAllowedDomain(imageUrl)) {
      console.warn('Blocked non-whitelisted domain:', imageUrl)
      return new Response(
        JSON.stringify({ error: 'Domain not allowed' }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Proxying external image:', imageUrl)

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

    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      console.error('Invalid content type:', contentType)
      return new Response(
        JSON.stringify({ error: 'Invalid image content type' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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
    console.error('Error proxying external image:', error)
    
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
