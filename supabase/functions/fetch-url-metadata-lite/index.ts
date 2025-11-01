import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }
    
    console.log(`🔍 Processing URL: ${url}`);
    
    // Step 1: Extract product name from URL
    const productName = await extractProductName(url);
    console.log(`📝 Extracted product name: "${productName}"`);
    
    // Step 2: Google Image Search
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_CUSTOM_SEARCH_CX');
    
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      throw new Error('Google API credentials not configured');
    }
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?` +
      `key=${GOOGLE_API_KEY}&` +
      `cx=${GOOGLE_CX}&` +
      `q=${encodeURIComponent(productName)}&` +
      `searchType=image&` +
      `num=5&` +
      `imgSize=large&` +
      `safe=active`;
    
    console.log(`🔍 Searching Google Images...`);
    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(15000),
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Google API error: ${searchResponse.status} ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    
    const images: { url: string; source: string }[] = [];
    let usedOpenGraphFallback = false;
    
    // Extract image URLs from Google results
    if (searchData.items && Array.isArray(searchData.items)) {
      for (const item of searchData.items) {
        if (item.link) {
          images.push({
            url: item.link,
            source: 'google-image-search'
          });
        }
      }
    }
    
    console.log(`✅ Found ${images.length} images from Google`);
    
    // Step 3: Fallback to Open Graph if Google returns nothing
    if (images.length === 0) {
      console.log('⚠️ No Google results, trying Open Graph fallback...');
      const ogImage = await extractOpenGraphImage(url);
      if (ogImage) {
        images.push({
          url: ogImage,
          source: 'open-graph'
        });
        usedOpenGraphFallback = true;
        console.log(`✅ Found Open Graph image: ${ogImage.slice(0, 50)}...`);
      }
    }
    
    // Step 4: Extract description and favicon in parallel
    console.log('📝 Extracting description and favicon...');
    const [description, favicon] = await Promise.all([
      extractDescription(url),
      extractFavicon(url)
    ]);
    
    // Step 5: Prepare response
    const hasImages = images.length > 0;
    const primaryImage = hasImages ? images[0].url : null;
    const urlObj = new URL(url);
    const siteName = urlObj.hostname.replace('www.', '');
    
    // Step 6: Enhanced logging
    console.log(`📊 Stats: images=${images.length}, partialExtraction=${!hasImages}, sources=[${images.map(i => i.source).join(', ')}]`);
    console.log(`📦 Response structure:`, JSON.stringify({
      hasTitle: !!productName,
      hasDescription: !!description,
      hasFavicon: !!favicon,
      imageCount: images.length,
      imageSources: images.map(i => i.source)
    }, null, 2));
    
    // Step 7: Return results with full compatibility
    return new Response(
      JSON.stringify({
        url: url, // Original URL for preview card
        siteName: siteName, // Site name for preview card
        title: productName,
        description: description,
        image: primaryImage, // Single primary image field
        images: images.map(img => img.url), // Just URL strings for frontend
        favicon: favicon,
        partialExtraction: !hasImages, // Controls warning banner
        metadata: {
          method: 'google-search',
          query: productName,
          imageCount: images.length,
          sources: images.map(img => img.source), // Source tracking for debugging
          usedOpenGraphFallback: usedOpenGraphFallback,
          timestamp: new Date().toISOString(),
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Extract product name from URL or page
 */
async function extractProductName(url: string): Promise<string> {
  try {
    // Try fetching the page (basic fetch, no rendering)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Try title tag first (most reliable)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      // Clean up title: remove site name, common separators
      const title = titleMatch[1]
        .split(/[|–—-]/)[0] // Take first part before separator
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .slice(0, 100); // Limit length
      
      if (title.length > 5) {
        return title;
      }
    }
    
    // Try og:title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      return ogTitleMatch[1].slice(0, 100);
    }
    
    // Try twitter:title
    const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
    if (twitterTitleMatch) {
      return twitterTitleMatch[1].slice(0, 100);
    }
    
    // Try h1 tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1]
        .replace(/<[^>]*>/g, '') // Remove nested HTML tags
        .trim()
        .slice(0, 100);
      
      if (h1Text.length > 5) {
        return h1Text;
      }
    }
    
    // Fallback: Extract from URL
    throw new Error('Could not extract title from page');
    
  } catch (error) {
    console.warn('⚠️ Failed to extract product name from page:', error.message);
    
    // Last resort: Parse from URL
    const urlObj = new URL(url);
    
    // Get the last meaningful path segment
    const pathSegments = urlObj.pathname
      .split('/')
      .filter(segment => segment.length > 2) // Skip short segments
      .filter(segment => !segment.match(/^\d+$/)); // Skip numeric IDs
    
    if (pathSegments.length > 0) {
      // Use last segment, clean it up
      const lastSegment = pathSegments[pathSegments.length - 1]
        .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
        .replace(/\.[^.]+$/, '') // Remove file extension if present
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (lastSegment.length > 3) {
        return lastSegment.slice(0, 100);
      }
    }
    
    // Absolute fallback: Use domain name
    return urlObj.hostname.replace('www.', '').split('.')[0];
  }
}

/**
 * Extract Open Graph image as fallback
 */
async function extractOpenGraphImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Try og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) {
      return ogImageMatch[1];
    }
    
    // Try twitter:image
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (twitterImageMatch) {
      return twitterImageMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('⚠️ Failed to extract Open Graph image:', error);
    return null;
  }
}

/**
 * Extract page description from meta tags
 */
async function extractDescription(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Try og:description first (usually best)
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (ogDescMatch) {
      return ogDescMatch[1].slice(0, 500);
    }
    
    // Try twitter:description
    const twitterDescMatch = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i);
    if (twitterDescMatch) {
      return twitterDescMatch[1].slice(0, 500);
    }
    
    // Try standard meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (metaDescMatch) {
      return metaDescMatch[1].slice(0, 500);
    }
    
    return null;
  } catch (error) {
    console.error('⚠️ Failed to extract description:', error);
    return null;
  }
}

/**
 * Extract favicon URL from page
 */
async function extractFavicon(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Try standard favicon link tags
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
    if (faviconMatch) {
      const faviconPath = faviconMatch[1];
      // Make absolute URL if relative
      return faviconPath.startsWith('http') 
        ? faviconPath 
        : `${baseUrl}${faviconPath.startsWith('/') ? '' : '/'}${faviconPath}`;
    }
    
    // Fallback: Try default /favicon.ico
    const defaultFavicon = `${baseUrl}/favicon.ico`;
    const faviconResponse = await fetch(defaultFavicon, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) 
    });
    
    if (faviconResponse.ok) {
      return defaultFavicon;
    }
    
    return null;
  } catch (error) {
    console.error('⚠️ Failed to extract favicon:', error);
    return null;
  }
}
