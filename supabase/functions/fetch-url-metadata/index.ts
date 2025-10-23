
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

    // ===== ENHANCED PRODUCT IMAGE EXTRACTION =====
    const imageUrls: string[] = [];
    const seenUrls = new Set<string>();
    const seenFilenames = new Set<string>(); // Track by filename to prevent duplicates
    const pageUrl = new URL(url);
    const pageDomain = pageUrl.hostname;

    console.log(`🔍 Extracting images from: ${pageDomain}`);

    // Helper: Extract filename without query params
    const getImageFilename = (imgUrl: string): string => {
      try {
        const urlObj = new URL(imgUrl, url);
        const pathname = urlObj.pathname;
        return pathname.split('/').pop()?.split('?')[0] || '';
      } catch {
        return '';
      }
    };

    // Helper: Check if image is from same domain or trusted CDN
    const isSameDomainOrCDN = (imgUrl: string): boolean => {
      try {
        const imgUrlObj = new URL(imgUrl, url);
        const imgDomain = imgUrlObj.hostname;
        
        // Same domain
        if (imgDomain === pageDomain) return true;
        
        // Parent domain match (e.g., cdn.cosmix.in matches cosmix.in)
        if (imgDomain.endsWith(`.${pageDomain}`)) return true;
        
        // Known product CDNs
        const trustedCDNs = [
          'cloudinary.com',
          'shopifycdn.com',
          'imgix.net',
          'cloudfront.net',
          'amazonaws.com',
          'cdn.shopify.com'
        ];
        
        return trustedCDNs.some(cdn => imgDomain.includes(cdn));
      } catch {
        return false;
      }
    };

    // Helper: Add image with duplicate checking
    const addImage = (imgUrl: string, source: string): boolean => {
      if (!imgUrl || seenUrls.has(imgUrl)) return false;
      
      // Check filename duplication
      const filename = getImageFilename(imgUrl);
      if (filename && seenFilenames.has(filename)) {
        console.log(`⚠️ Skipping duplicate filename: ${filename} from ${source}`);
        return false;
      }
      
      // Domain filter
      if (!isSameDomainOrCDN(imgUrl)) {
        console.log(`⚠️ Skipping external domain: ${imgUrl} from ${source}`);
        return false;
      }
      
      imageUrls.push(imgUrl);
      seenUrls.add(imgUrl);
      if (filename) seenFilenames.add(filename);
      console.log(`✅ Added from ${source}: ${imgUrl}`);
      return true;
    };

    // ===== LAYER 1: JSON-LD PRODUCT SCHEMA (HIGHEST PRIORITY) =====
    console.log('📦 Layer 1: Checking JSON-LD Product schema...');
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.text);
        const items = Array.isArray(data) ? data : [data];
        
        items.forEach(item => {
          if (item['@type'] === 'Product' && item.image) {
            const productImages = Array.isArray(item.image) ? item.image : [item.image];
            productImages.forEach(img => {
              const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl;
              if (imgUrl) addImage(imgUrl, 'JSON-LD Product');
            });
          }
          
          // Article/NewsArticle schema
          if ((item['@type'] === 'Article' || item['@type'] === 'NewsArticle') && item.image) {
            const articleImages = Array.isArray(item.image) ? item.image : [item.image];
            articleImages.forEach(img => {
              const imgUrl = typeof img === 'string' ? img : img.url;
              if (imgUrl) addImage(imgUrl, 'JSON-LD Article');
            });
          }
          
          // ImageGallery or ImageObject
          if (item['@type'] === 'ImageGallery' || item['@type'] === 'ImageObject') {
            const imgUrl = item.contentUrl || item.url;
            if (imgUrl) addImage(imgUrl, 'JSON-LD ImageObject');
          }
        });
      } catch (e) {
        console.warn('Failed to parse JSON-LD:', e);
      }
    });

    // ===== LAYER 2: E-COMMERCE GALLERY SELECTORS (HIGH PRIORITY) =====
    console.log('🖼️ Layer 2: Checking product gallery selectors...');
    const gallerySelectors = [
      '[class*="product-gallery"] img',
      '[class*="ProductGallery"] img',
      '[class*="product-images"] img',
      '[class*="product__media"] img',
      '[class*="product-media"] img',
      '[class*="swiper-slide"] img',
      '[class*="carousel"] img',
      '[class*="thumbnail"] img',
      '[data-gallery-image]',
      '[data-product-image]',
      '[class*="ImageGallery"] img',
      '[class*="image-gallery"] img',
      '.product-image img',
      '.gallery img',
      '#product-photos img',
      '[id*="product-gallery"] img',
      '[id*="ProductGallery"] img'
    ];

    for (const selector of gallerySelectors) {
      const galleryImages = doc.querySelectorAll(selector);
      if (galleryImages.length > 0) {
        console.log(`Found ${galleryImages.length} images with selector: ${selector}`);
        galleryImages.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (src) addImage(src, `Gallery (${selector})`);
        });
      }
    }

    // ===== LAYER 3: OPEN GRAPH IMAGES (FALLBACK) =====
    // Only if we have fewer than 3 images so far
    if (imageUrls.length < 3) {
      console.log('🌐 Layer 3: Checking Open Graph images...');
      const ogImages = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"]');
      ogImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Open Graph');
      });
    }

    // ===== LAYER 4: TWITTER CARD IMAGES (FALLBACK) =====
    if (imageUrls.length < 3) {
      console.log('🐦 Layer 4: Checking Twitter card images...');
      const twitterImages = doc.querySelectorAll('meta[name="twitter:image"], meta[property="twitter:image"]');
      twitterImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Twitter Card');
      });
    }

    // ===== LAYER 5: BODY IMG TAGS (LAST RESORT) =====
    // Only if we still have fewer than 2 images
    if (imageUrls.length < 2) {
      console.log('🔍 Layer 5: Checking body <img> tags (last resort)...');
      const bodyImages = doc.querySelectorAll('img');
      
      for (const img of bodyImages) {
        const src = img.getAttribute('src');
        if (!src) continue;
        
        // Skip tiny images, icons, SVGs, tracking pixels
        const width = parseInt(img.getAttribute('width') || '0');
        const height = parseInt(img.getAttribute('height') || '0');
        const alt = img.getAttribute('alt') || '';
        const className = img.getAttribute('class') || '';
        
        // Quality filters
        const isTiny = (width > 0 && width < 200) || (height > 0 && height < 200);
        const isIcon = src.includes('icon') || src.includes('logo') || alt.toLowerCase().includes('icon') || className.includes('icon');
        const isSvg = src.endsWith('.svg');
        const isTracking = src.includes('pixel') || src.includes('track') || src.includes('analytics');
        
        if (!isTiny && !isIcon && !isSvg && !isTracking) {
          if (width > 200 || height > 200 || (!width && !height)) {
            addImage(src, 'Body Image');
            if (imageUrls.length >= 10) break;
          }
        }
      }
    }

    // ===== NORMALIZE ALL URLS TO ABSOLUTE =====
    const normalizedImages: string[] = [];
    for (const imgUrl of imageUrls) {
      try {
        const absoluteUrl = imgUrl.startsWith('http') 
          ? imgUrl 
          : new URL(imgUrl, url).href;
        
        // Skip data URLs and blob URLs
        if (!absoluteUrl.startsWith('data:') && !absoluteUrl.startsWith('blob:')) {
          normalizedImages.push(absoluteUrl);
        }
      } catch (e) {
        console.warn('Failed to normalize image URL:', imgUrl, e);
      }
      
      // Cap at 10 images
      if (normalizedImages.length >= 10) break;
    }

    console.log(`✅ Final result: Extracted ${normalizedImages.length} images from ${url}`);

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
