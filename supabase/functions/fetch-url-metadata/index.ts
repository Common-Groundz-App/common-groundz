
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parse } from 'https://esm.sh/node-html-parser@6.1.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10-second timeout
    });
    const html = await response.text();
    const doc = parse(html);

    // Extract favicon
    const favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') || '';

    // ===== COMPREHENSIVE IMAGE EXTRACTION =====
    const imageUrls: string[] = [];
    const seenUrls = new Set<string>();

    // 1. Extract ALL Open Graph images (multiple tags supported)
    const ogImages = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"]');
    ogImages.forEach(tag => {
      const content = tag.getAttribute('content');
      if (content && !seenUrls.has(content)) {
        imageUrls.push(content);
        seenUrls.add(content);
      }
    });

    // 2. Extract images from JSON-LD / Schema.org structured data
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.text);
        
        // Handle single object or array
        const items = Array.isArray(data) ? data : [data];
        
        items.forEach(item => {
          // Product schema
          if (item['@type'] === 'Product' && item.image) {
            const productImages = Array.isArray(item.image) ? item.image : [item.image];
            productImages.forEach(img => {
              const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl;
              if (imgUrl && !seenUrls.has(imgUrl)) {
                imageUrls.push(imgUrl);
                seenUrls.add(imgUrl);
              }
            });
          }
          
          // Article/NewsArticle schema
          if ((item['@type'] === 'Article' || item['@type'] === 'NewsArticle') && item.image) {
            const articleImages = Array.isArray(item.image) ? item.image : [item.image];
            articleImages.forEach(img => {
              const imgUrl = typeof img === 'string' ? img : img.url;
              if (imgUrl && !seenUrls.has(imgUrl)) {
                imageUrls.push(imgUrl);
                seenUrls.add(imgUrl);
              }
            });
          }
          
          // ImageGallery or ImageObject
          if (item['@type'] === 'ImageGallery' || item['@type'] === 'ImageObject') {
            const imgUrl = item.contentUrl || item.url;
            if (imgUrl && !seenUrls.has(imgUrl)) {
              imageUrls.push(imgUrl);
              seenUrls.add(imgUrl);
            }
          }
        });
      } catch (e) {
        console.warn('Failed to parse JSON-LD:', e);
      }
    });

    // 3. Extract Twitter card images
    const twitterImages = doc.querySelectorAll('meta[name="twitter:image"], meta[property="twitter:image"]');
    twitterImages.forEach(tag => {
      const content = tag.getAttribute('content');
      if (content && !seenUrls.has(content)) {
        imageUrls.push(content);
        seenUrls.add(content);
      }
    });

    // 4. Extract meaningful <img> tags from body (fallback)
    // Only if we have fewer than 5 images so far
    if (imageUrls.length < 5) {
      const bodyImages = doc.querySelectorAll('img');
      
      for (const img of bodyImages) {
        const src = img.getAttribute('src');
        if (!src || seenUrls.has(src)) continue;
        
        // Skip tiny images, icons, SVGs, tracking pixels
        const width = parseInt(img.getAttribute('width') || '0');
        const height = parseInt(img.getAttribute('height') || '0');
        const alt = img.getAttribute('alt') || '';
        
        // Quality filters
        const isTiny = (width > 0 && width < 200) || (height > 0 && height < 200);
        const isIcon = src.includes('icon') || src.includes('logo') || alt.toLowerCase().includes('icon');
        const isSvg = src.endsWith('.svg');
        const isTracking = src.includes('pixel') || src.includes('track') || src.includes('analytics');
        
        // Accept if larger than threshold or has no size specified (unknown = possibly good)
        if (!isTiny && !isIcon && !isSvg && !isTracking) {
          if (width > 200 || height > 200 || (!width && !height)) {
            imageUrls.push(src);
            seenUrls.add(src);
            
            // Cap body images to avoid too many low-quality images
            if (imageUrls.length >= 10) break;
          }
        }
      }
    }

    // 5. Normalize all URLs to absolute
    const normalizedImages: string[] = [];
    for (const imgUrl of imageUrls) {
      if (!imgUrl) continue;
      
      try {
        const absoluteUrl = imgUrl.startsWith('http') 
          ? imgUrl 
          : new URL(imgUrl, url).href;
        
        // Additional quality filter: skip data URLs and blob URLs
        if (!absoluteUrl.startsWith('data:') && !absoluteUrl.startsWith('blob:')) {
          normalizedImages.push(absoluteUrl);
        }
      } catch (e) {
        console.warn('Failed to normalize image URL:', imgUrl, e);
      }
      
      // Cap at 10 images to keep payload reasonable
      if (normalizedImages.length >= 10) break;
    }

    console.log(`📸 Extracted ${normalizedImages.length} images from ${url}`);

    // Keep first image for backward compatibility
    const primaryImage = normalizedImages[0] || '';

    // Normalize favicon URL to absolute
    let normalizedFavicon = favicon;
    if (normalizedFavicon && !normalizedFavicon.startsWith('http')) {
      try {
        normalizedFavicon = new URL(normalizedFavicon, url).href;
      } catch (e) {
        console.error('Failed to normalize favicon URL:', e);
        normalizedFavicon = '';
      }
    }

    // Extract Open Graph metadata
    const metadata = {
      title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
             doc.querySelector('title')?.text || '',
      description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                  doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      image: primaryImage, // First image for backward compatibility
      images: normalizedImages, // NEW: Full gallery array
      favicon: normalizedFavicon,
      siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || 
                new URL(url).hostname,
      url: url,
    };

    console.log('✅ Metadata extracted:', {
      title: metadata.title,
      imageCount: normalizedImages.length
    });

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch metadata' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
