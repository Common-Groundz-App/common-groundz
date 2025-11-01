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
    const { url, productName: providedProductName } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }
    
    console.log(`🔍 Processing URL: ${url}`);
    console.log(`📦 Provided product name: ${providedProductName || 'none - will extract'}`);
    
    // Step 1: Get product name (use provided or extract)
    let productName: string;
    let pageHtml = '';
    let extractionMethod: string;

    if (providedProductName && providedProductName.trim().length > 3) {
      productName = providedProductName.trim();
      extractionMethod = 'provided-by-gemini';
      console.log(`✅ Using provided product name: "${productName}"`);
    } else {
      console.log(`⚠️ No valid product name provided, extracting from page...`);
      const extracted = await extractProductName(url);
      productName = extracted.name;
      pageHtml = extracted.html;
      extractionMethod = 'scraped-from-html';
      console.log(`📝 Extracted product name: "${productName}"`);
    }
    
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
    
    // Step 4: Extract description and favicon (only if we have HTML from extraction)
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    let description: string | null = null;
    let favicon: string | null = null;
    
    if (pageHtml) {
      console.log('📝 Extracting description and favicon from page HTML...');
      description = extractDescriptionFromHTML(pageHtml);
      favicon = extractFaviconFromHTML(pageHtml, baseUrl);
    } else {
      console.log('⚠️ No HTML available - skipping description/favicon extraction');
      favicon = `${baseUrl}/favicon.ico`; // Default favicon fallback
    }
    
    console.log(`✅ Description: ${description ? description.slice(0, 50) + '...' : 'none'}`);
    console.log(`✅ Favicon: ${favicon ? 'found' : 'default fallback'}`);
    
    // Step 5: Prepare response
    const hasImages = images.length > 0;
    const primaryImage = hasImages ? images[0].url : null;
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
          extractionMethod: extractionMethod,
          imageCount: images.length,
          sources: images.map(img => img.source),
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
 * Extract product name from URL or page and return HTML for reuse
 */
async function extractProductName(url: string): Promise<{ name: string; html: string }> {
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
        return { name: title, html };
      }
    }
    
    // Try og:title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      return { name: ogTitleMatch[1].slice(0, 100), html };
    }
    
    // Try twitter:title
    const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
    if (twitterTitleMatch) {
      return { name: twitterTitleMatch[1].slice(0, 100), html };
    }
    
    // Try h1 tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1]
        .replace(/<[^>]*>/g, '') // Remove nested HTML tags
        .trim()
        .slice(0, 100);
      
      if (h1Text.length > 5) {
        return { name: h1Text, html };
      }
    }
    
    // Fallback: Extract from URL
    throw new Error('Could not extract title from page');
    
  } catch (error) {
    console.warn('⚠️ Failed to extract product name from page:', error.message);
    
    // Last resort: Parse from URL with better logic
    const urlObj = new URL(url);
    
    // Get the last meaningful path segment
    const pathSegments = urlObj.pathname
      .split('/')
      .filter(segment => segment.length > 2) // Skip short segments
      .filter(segment => !segment.match(/^\d+$/)) // Skip numeric IDs
      .filter(segment => !['buy', 'product', 'p', 'dp', 'item'].includes(segment)); // Skip common e-commerce paths
    
    if (pathSegments.length > 0) {
      // Use last segment, clean it up
      const lastSegment = pathSegments[pathSegments.length - 1]
        .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
        .replace(/\.[^.]+$/, '') // Remove file extension if present
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (lastSegment.length > 3) {
        console.log(`📝 Extracted name from URL path: "${lastSegment}"`);
        return { name: lastSegment.slice(0, 100), html: '' };
      }
    }
    
    // Absolute fallback: Use domain name
    const domainName = urlObj.hostname.replace('www.', '').split('.')[0];
    console.log(`⚠️ Ultimate fallback: using domain name "${domainName}"`);
    return { name: domainName, html: '' };
  }
}

/**
 * Extract description from HTML (no network request)
 */
function extractDescriptionFromHTML(html: string): string | null {
  if (!html) return null;
  
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
}

/**
 * Extract favicon from HTML (no network request)
 */
function extractFaviconFromHTML(html: string, baseUrl: string): string | null {
  if (!html) return `${baseUrl}/favicon.ico`;
  
  // Try standard favicon link tags
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
  if (faviconMatch) {
    const faviconPath = faviconMatch[1];
    // Make absolute URL if relative
    return faviconPath.startsWith('http') 
      ? faviconPath 
      : `${baseUrl}${faviconPath.startsWith('/') ? '' : '/'}${faviconPath}`;
  }
  
  // Fallback to default /favicon.ico
  return `${baseUrl}/favicon.ico`;
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

