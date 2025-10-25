
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

  let url: string = ''; // ✅ Declare outside try block for proper scoping

  try {
    const body = await req.json();
    url = body.url; // ✅ Assign after declaration
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track fetch method used
    let fetchMethod: 'direct' | 'scraper-api' = 'direct';
    let blockedReason: string | null = null;
    let httpStatus: number | undefined = undefined;
    let html: string = '';
    let shouldUseScraper = false;

    // Array of real browser User-Agents for anti-bot evasion
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    // Pick random User-Agent for better anti-bot evasion
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // ===== PHASE 2: SMART DOMAIN ROUTING =====
    const hostname = new URL(url).hostname;
    
    // Known problematic domains that ALWAYS need ScraperAPI
    const alwaysUseScraper = [
      'nykaa.com',
      'amazon.in', 'amazon.com', 'amazon.co.uk',
      'flipkart.com',
      'myntra.com'
    ];
    
    // Check if this domain always needs ScraperAPI
    const shouldSkipDirectFetch = alwaysUseScraper.some(domain => hostname.includes(domain));
    
    // ===== TIER 1: DIRECT FETCH (TRY FIRST) =====

    if (shouldSkipDirectFetch) {
      blockedReason = 'Known problematic domain';
      fetchMethod = 'scraper-api';
      console.log(`ℹ️ Skipping direct fetch for ${hostname}, proceeding to ScraperAPI fallback.`);
      shouldUseScraper = true;
    }

    // Only attempt direct fetch if flag is not set
    if (!shouldUseScraper) {
      try {
        console.log('🔄 Attempting direct fetch...');
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': randomUserAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          },
          signal: AbortSignal.timeout(15000) // 15s timeout for direct fetch
        });
        
        httpStatus = response.status;
        
        // ===== BLOCK DETECTION: Check HTTP status codes =====
        if ([403, 503, 429].includes(response.status)) {
          blockedReason = `HTTP ${response.status} ${response.statusText}`;
          throw new Error(blockedReason);
        }
        
        if (!response.ok) {
          console.warn(`⚠️ HTTP ${response.status} ${response.statusText} from ${url}`);
        }
        
        html = await response.text();
        
        // ===== BLOCK DETECTION: Check for anti-bot patterns =====
        const antiBotPatterns = [
          '503 Service Unavailable',
          'Access Denied',
          'blocked',
          'captcha',
          'security check',
          'unusual traffic'
        ];
        
        const hasAntiBotPattern = antiBotPatterns.some(pattern => 
          html.toLowerCase().includes(pattern.toLowerCase())
        );
        
        // ===== BLOCK DETECTION: Check for suspiciously small response =====
        const isSuspiciouslySmall = html.length < 300; // SPAs often have minimal HTML
        
        if (hasAntiBotPattern || isSuspiciouslySmall) {
          blockedReason = hasAntiBotPattern 
            ? 'Anti-bot page detected' 
            : 'Suspiciously small HTML response';
          
          console.warn(`⚠️ ${blockedReason} (${html.length} bytes)`);
          throw new Error(blockedReason);
        }
        
        console.log(`✅ Direct fetch succeeded (${html.length} bytes)`);
        
      } catch (directFetchError) {
        shouldUseScraper = true;
        console.error(`❌ Direct fetch failed: ${directFetchError.message}`);
      }
    }

    // ===== TIER 2: SCRAPERAPI FALLBACK =====
    if (shouldUseScraper) {
      const scraperApiKey = Deno.env.get('SCRAPER_API_KEY');
      
      if (!scraperApiKey) {
        console.error('⚠️ ScraperAPI key not configured - cannot fallback');
        throw new Error(`Direct fetch failed (${blockedReason || 'unknown reason'}) and no ScraperAPI key configured`);
      }
      
      // ===== PHASE 3: RESILIENT TWO-STAGE SCRAPERAPI RETRY =====
      console.log('🔄 Attempting ScraperAPI fallback...');
      fetchMethod = 'scraper-api';
      let scraperSuccess = false;
      
      // STAGE 1: Try static scraping first (faster, cheaper)
      try {
        console.log('📥 Stage 1: ScraperAPI static mode (premium)...');
        
        const hostname = new URL(url).hostname;
        const needsJsRendering = [
          'nykaa.com',
          'amazon.in', 'amazon.com', 'amazon.co.uk',
          'flipkart.com',
          'myntra.com'
        ].some(domain => hostname.includes(domain));
        
        // Stage 1: Static scraping (no JS rendering)
        const scraperUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&premium=true`;
        
        const scraperResponse = await fetch(scraperUrl, {
          signal: AbortSignal.timeout(20000) // Static mode is faster
        });
        
        if (scraperResponse.ok) {
          html = await scraperResponse.text();
          
          if (html.length >= 300) {
            console.log(`✅ ScraperAPI static succeeded (${html.length} bytes)`);
            console.log(`💰 ScraperAPI credit used (static, 1 credit) for: ${url}`);
            scraperSuccess = true;
          }
        }
      } catch (stage1Error) {
        console.warn(`⚠️ Stage 1 (static) failed: ${stage1Error.message}`);
      }
      
      // STAGE 2: If static failed, try JS rendering
      if (!scraperSuccess) {
        try {
          console.log('📥 Stage 2: ScraperAPI JS rendering mode...');
          
          const hostname = new URL(url).hostname;
          const needsJsRendering = [
            'nykaa.com',
            'amazon.in', 'amazon.com', 'amazon.co.uk',
            'flipkart.com',
            'myntra.com'
          ].some(domain => hostname.includes(domain));
          
          const scraperUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}${needsJsRendering ? '&render=true' : ''}&premium=true`;
          
          const scraperResponse = await fetch(scraperUrl, {
            signal: AbortSignal.timeout(60000) // JS rendering takes longer
          });
          
          if (!scraperResponse.ok) {
            throw new Error(`ScraperAPI returned ${scraperResponse.status}: ${scraperResponse.statusText}`);
          }
          
          html = await scraperResponse.text();
          
          if (html.length < 300) {
            throw new Error('ScraperAPI returned suspiciously small response');
          }
          
          console.log(`✅ ScraperAPI JS rendering succeeded (${html.length} bytes)`);
          console.log(`💰 ScraperAPI credit used (JS render, ${needsJsRendering ? '5-10' : '1'} credits) for: ${url}`);
          
        } catch (stage2Error) {
          console.error(`❌ Both ScraperAPI stages failed: ${stage2Error.message}`);
          throw new Error(`All extraction methods failed. Stage 1 (static): Failed. Stage 2 (JS render): ${stage2Error.message}`);
        }
      }
    }

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

    // ===== PHASE 1: E-COMMERCE DETECTION =====
    let isEcommercePage = false;
    let hasProductSchema = false;

    // Check JSON-LD for Product schema (most reliable)
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const text = script.text;
        if (text.includes('"@type":"Product"') || text.includes('"@type": "Product"')) {
          isEcommercePage = true;
          hasProductSchema = true;
        }
      } catch (e) {
        // Ignore parse errors for detection
      }
    });

    // Check URL patterns
    const productUrlPatterns = ['/product/', '/products/', '/shop/', '/p/', '/item/', '/buy/'];
    if (productUrlPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
      isEcommercePage = true;
    }

    // Check Open Graph type
    const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
    if (ogType && (ogType.includes('product') || ogType === 'product.item')) {
      isEcommercePage = true;
    }

    console.log(`🔍 Page type: ${isEcommercePage ? 'E-commerce Product' : 'General Content'}`);
    console.log(`📦 Has Product Schema: ${hasProductSchema}`);

    // ===== HELPER: EXTRACT PRODUCT KEYWORDS FROM URL =====
    const extractProductKeywords = (url: string): string[] => {
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        
        // Get the last segment (usually the product slug)
        // e.g., /products/cosmix-smarter-multivitamin-women -> "cosmix-smarter-multivitamin-women"
        const productSlug = pathSegments[pathSegments.length - 1] || '';
        
        // Split by common separators and clean up
        const keywords = productSlug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ') // Replace separators with spaces
          .split(' ')
          .filter(word => word.length > 2); // Filter out short words
        
        // Common stop words to exclude
        const stopWords = ['the', 'and', 'for', 'with', 'from', 'product', 'item'];
        return keywords.filter(k => !stopWords.includes(k));
      } catch {
        return [];
      }
    };

    // ===== HELPER: CHECK IMAGE RELEVANCE TO PRODUCT =====
    const isImageRelevantToProduct = (
      imgUrl: string,
      imgElement: Element | null,
      productKeywords: string[]
    ): boolean => {
      if (productKeywords.length === 0) return true; // No context, accept all
      
      // Get all text signals from the image
      const src = imgUrl.toLowerCase();
      const alt = imgElement?.getAttribute('alt')?.toLowerCase() || '';
      const title = imgElement?.getAttribute('title')?.toLowerCase() || '';
      const dataTitle = imgElement?.getAttribute('data-title')?.toLowerCase() || '';
      
      // Combine all signals
      const allText = `${src} ${alt} ${title} ${dataTitle}`;
      
      // Check if at least ONE product keyword appears in the image context
      const hasProductKeyword = productKeywords.some(keyword => 
        allText.includes(keyword)
      );
      
      // CRITICAL: Cross-product exclusion
      // If image contains keywords from OTHER products, reject it
      const crossProductTerms = [
        'protein', 'collagen', 'greens', 'superfood', 'pancake',
        'glow', 'probiotic', 'fiber', 'immunity', 'calm',
        'energy', 'detox', 'cleanse', 'gut', 'hair', 'skin'
      ];
      
      // Only apply cross-product filter if we have product context
      if (productKeywords.length > 0) {
        for (const term of crossProductTerms) {
          if (allText.includes(term)) {
            // If this term is actually IN our product keywords, it's OK
            // e.g., if we're ON the protein page, "protein" is expected
            if (productKeywords.includes(term)) {
              continue; // Not a cross-product match
            }
            // This is a different product
            console.log(`⚠️ Rejecting cross-product image (contains "${term}"): ${imgUrl.substring(imgUrl.lastIndexOf('/') + 1)}`);
            return false;
          }
        }
      }
      
      return hasProductKeyword;
    };

    // Extract product context if e-commerce page
    const productKeywords = isEcommercePage ? extractProductKeywords(url) : [];
    if (productKeywords.length > 0) {
      console.log(`🏷️ Product keywords: [${productKeywords.join(', ')}]`);
    }

    // Smart thresholds
    const MIN_PRODUCT_GALLERY_IMAGES = 3; // If we have 3+ from gallery, it's likely complete
    const MAX_ECOMMERCE_IMAGES = 8; // Cap product pages at 8 images
    const MAX_GENERAL_IMAGES = 10; // Allow more for non-product pages

    // Track which layers contributed images
    let layer1Count = 0; // JSON-LD
    let layer2Count = 0; // Gallery selectors

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
        
        // Domain-specific CDN mappings (for sites with different CDN domains)
        const domainCdnMap: Record<string, string[]> = {
          'goodreads.com': ['gr-assets.com', 'images.gr-assets.com', 'i.gr-assets.com'],
          'amazon.in': ['m.media-amazon.com', 'images-na.ssl-images-amazon.com'],
          'amazon.com': ['m.media-amazon.com', 'images-na.ssl-images-amazon.com'],
          'flipkart.com': ['rukminim1.flixcart.com', 'rukminim2.flixcart.com'],
          'nykaa.com': ['images-static.nykaa.com', 'adn-static1.nykaa.com', 'adn-static2.nykaa.com'],
        };
        
        for (const [domain, cdns] of Object.entries(domainCdnMap)) {
          if (pageDomain.includes(domain)) {
            if (cdns.some(cdn => imgDomain.includes(cdn))) {
              console.log(`✅ Whitelisted CDN for ${domain}: ${imgDomain}`);
              return true;
            }
          }
        }
        
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

  layer1Count = imageUrls.length;
  console.log(`📦 Layer 1 found: ${layer1Count} images`);

  // ===== LAYER 2: E-COMMERCE GALLERY SELECTORS (HIGH PRIORITY) =====
    console.log('🖼️ Layer 2: Checking product gallery selectors...');
    const gallerySelectors = [
      // Goodreads book covers (HIGH PRIORITY for books)
      '[class*="BookCover"] img',
      '[class*="book-cover"] img',
      '.ResponsiveImage img',
      '[aria-label*="Book cover"] img',
      
      // E-commerce product galleries
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

layer2Count = imageUrls.length - layer1Count;
console.log(`🖼️ Layer 2 found: ${layer2Count} images`);

// ===== PRODUCT-SPECIFIC FILTERING FOR E-COMMERCE =====
if (isEcommercePage && imageUrls.length > 0 && productKeywords.length > 0) {
  console.log('🎯 Applying product-specific image filtering...');
  
  // We need to re-extract images with metadata to check relevance
  // Store images with their elements for filtering
  const imageData: Array<{url: string, element: Element | null}> = [];
  
  // Re-scan gallery with element metadata
  for (const selector of gallerySelectors) {
    const galleryImages = doc.querySelectorAll(selector);
    galleryImages.forEach(img => {
      const src = img.getAttribute('src') || 
                   img.getAttribute('data-src') || 
                   img.getAttribute('data-lazy-src');
      if (src) {
        // Normalize to absolute URL
        try {
          const absoluteSrc = src.startsWith('http') 
            ? src 
            : new URL(src, url).href;
          
          // Check if this URL was collected in our imageUrls
          if (imageUrls.includes(absoluteSrc)) {
            imageData.push({ url: absoluteSrc, element: img });
          }
        } catch (e) {
          // Skip malformed URLs
        }
      }
    });
  }
  
  // Filter images by product relevance
  const beforeCount = imageUrls.length;
  const filteredUrls: string[] = [];
  
  imageUrls.forEach(imgUrl => {
    // Find the element metadata for this URL
    const imgData = imageData.find(d => d.url === imgUrl);
    
    if (isImageRelevantToProduct(imgUrl, imgData?.element || null, productKeywords)) {
      filteredUrls.push(imgUrl);
    } else {
      console.log(`🚫 Filtered out: ${imgUrl.substring(imgUrl.lastIndexOf('/') + 1)}`);
    }
  });
  
  imageUrls.length = 0;
  imageUrls.push(...filteredUrls);
  
  const afterCount = imageUrls.length;
  const removedCount = beforeCount - afterCount;
  
  if (removedCount > 0) {
    console.log(`✂️ Removed ${removedCount} non-matching images`);
  }
  
  console.log(`✅ Product filtering complete: ${imageUrls.length} relevant images retained`);
  
  // Update layer counts to reflect filtering
  layer2Count = imageUrls.length - layer1Count;
}

const highConfidenceImages = layer1Count + layer2Count;

// ===== PHASE 2: DECISION POINT - Should we continue to fallback layers? =====
let shouldContinueToFallbacks = true;

if (isEcommercePage && highConfidenceImages >= MIN_PRODUCT_GALLERY_IMAGES) {
  console.log(`✅ E-commerce page with ${highConfidenceImages} gallery images found - skipping fallback layers`);
  shouldContinueToFallbacks = false;
}

// ===== LAYER 3: OPEN GRAPH IMAGES (FALLBACK) =====
// Only if we have fewer than 3 images so far AND we should continue
if (shouldContinueToFallbacks && imageUrls.length < 3) {
      console.log('🌐 Layer 3: Checking Open Graph images...');
      const ogImages = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"]');
      ogImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Open Graph');
      });
    }

// ===== LAYER 4: TWITTER CARD IMAGES (FALLBACK) =====
if (shouldContinueToFallbacks && imageUrls.length < 3) {
      console.log('🐦 Layer 4: Checking Twitter card images...');
      const twitterImages = doc.querySelectorAll('meta[name="twitter:image"], meta[property="twitter:image"]');
      twitterImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Twitter Card');
      });
    }

// ===== LAYER 5: BODY IMG TAGS (LAST RESORT) =====
// Only if we still have fewer than 2 images AND we should continue
if (shouldContinueToFallbacks && imageUrls.length < 2) {
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
      
      // Apply context-aware cap
      const maxImages = isEcommercePage ? MAX_ECOMMERCE_IMAGES : MAX_GENERAL_IMAGES;
      if (normalizedImages.length >= maxImages) break;
    }

    // ===== PHASE 3: APPLY FINAL CAP BASED ON PAGE TYPE =====
    const maxImages = isEcommercePage ? MAX_ECOMMERCE_IMAGES : MAX_GENERAL_IMAGES;
    if (normalizedImages.length > maxImages) {
      console.log(`📏 Capping from ${normalizedImages.length} to ${maxImages} images (${isEcommercePage ? 'e-commerce' : 'general'} page)`);
      normalizedImages.length = maxImages;
    }

    console.log(`✅ Final result: Extracted ${normalizedImages.length} images from ${url}`);
    console.log(`📊 Sources breakdown - JSON-LD: ${layer1Count}, Gallery: ${layer2Count}, Fallback: ${normalizedImages.length - (layer1Count + layer2Count)}`);

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
      images: normalizedImages, // Full gallery array
      favicon: normalizedFavicon,
      siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || 
                new URL(url).hostname,
      url: url,
      // PHASE 4: Context information for frontend intelligence
      pageType: isEcommercePage ? 'product' : 'general',
      hasProductSchema: hasProductSchema,
      // Fetch method tracking
      fetchMethod: fetchMethod, // 'direct' or 'scraper-api'
      blocked: fetchMethod === 'scraper-api', // true if original fetch was blocked
      blockedReason: blockedReason || undefined,
      imageSourceBreakdown: {
        jsonLd: layer1Count,
        gallery: layer2Count,
        fallback: normalizedImages.length - (layer1Count + layer2Count)
      },
      productKeywords: productKeywords.length > 0 ? productKeywords : undefined,
      // Debug information for troubleshooting
      debug: {
        httpStatus: httpStatus,
        detectedAsBot: fetchMethod === 'scraper-api',
        totalImagesScanned: seenUrls.size,
        rejectedImageCount: seenUrls.size - normalizedImages.length,
        domainFiltering: {
          pageDomain: pageDomain,
          appliedCdnWhitelist: pageDomain.includes('goodreads') || pageDomain.includes('amazon') || pageDomain.includes('nykaa')
        }
      }
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
    console.error('❌ Complete failure - Error fetching metadata:', error);
    
    // ===== PHASE 4: GRACEFUL FAILURE HANDLING =====
    // Return partial results instead of complete failure
    // This allows Gemini-extracted metadata to still be used
    return new Response(
      JSON.stringify({
        error: 'Failed to extract images',
        errorDetails: error.message,
        title: '',
        description: '',
        images: [],
        image: null,
        favicon: '',
        siteName: new URL(url).hostname,
        url: url,
        pageType: 'unknown',
        fetchMethod: 'failed',
        blocked: true,
        blockedReason: error.message,
        partialExtraction: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // 200, not 500
    );
  }
});
