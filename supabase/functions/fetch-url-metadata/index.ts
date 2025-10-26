
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parse } from 'https://esm.sh/node-html-parser@6.1.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEBUG = false; // ✅ Global debug toggle - set to true for verbose logs

// Main metadata extraction function - supports recursive retry
const extractMetadata = async (url: string, stage: number = 0, forceJsRender: boolean = false): Promise<Response> => {
  // Prevent infinite retry loops
  if (stage > 1) {
    console.warn(`⚠️ Stage ${stage} exceeded retry limit, using current results`);
    // Will continue with normal processing
  }

  try {
    
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
    let shouldUseScraper = forceJsRender; // Force scraper if this is a retry

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
    const shouldSkipDirectFetch = alwaysUseScraper.some(domain => hostname.includes(domain)) || forceJsRender;
    
    if (shouldSkipDirectFetch) {
      blockedReason = forceJsRender ? 'Retry with JS render' : 'Known problematic domain';
      fetchMethod = 'scraper-api';
      console.log(`ℹ️ ${forceJsRender ? 'Forcing JS render for retry' : `Skipping direct fetch for ${hostname}`}, proceeding to ScraperAPI.`);
      shouldUseScraper = true;
    } else {
      console.log(`🔄 Stage ${stage}: Attempting direct fetch for ${hostname}...`);
    }
    
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
      
      // STAGE 1: Try static scraping first (faster, cheaper) - unless forcing JS render
      try {
        const shouldForceJsNow = forceJsRender || stage > 0;
        
        if (shouldForceJsNow) {
          console.log(`📥 Forcing JS render (stage ${stage})...`);
          throw new Error('Skip static, go straight to JS render');
        }
        
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

    /**
     * Normalize Shopify CDN image URLs to request high-resolution versions
     * Strips size/crop parameters and replaces with targetWidth
     */
    const normalizeShopifyImageUrl = (imgUrl: string, targetWidth: number = 1920): string => {
      try {
        // Only process Shopify CDN URLs
        if (!imgUrl.includes('cdn.shopify.com') && !imgUrl.includes('/cdn/shop/')) {
          return imgUrl;
        }
        
        // Fix protocol-relative URLs (//domain.com/path → https://domain.com/path)
        let normalizedUrl = imgUrl;
        if (normalizedUrl.startsWith('//')) {
          normalizedUrl = 'https:' + normalizedUrl;
          if (DEBUG) {
            console.log(`🔧 Fixed protocol-relative URL: //${normalizedUrl.slice(8, 40)}...`);
          }
        }
        
        const urlObj = new URL(normalizedUrl);
        const searchParams = urlObj.searchParams;
        
        // Remove size-limiting parameters
        searchParams.delete('width');
        searchParams.delete('height');
        searchParams.delete('crop');
        
        // Add high-resolution width
        searchParams.set('width', targetWidth.toString());
        
        // Reconstruct URL (keeps 'v=' version parameter for cache busting)
        urlObj.search = searchParams.toString();
        
        const finalUrl = urlObj.toString();
        
        if (DEBUG && imgUrl !== finalUrl) {
          console.log(`🔧 Normalized Shopify URL: ${imgUrl.split('?')[0].slice(-40)}... → width=${targetWidth}`);
        }
        
        return finalUrl;
      } catch (e) {
        console.warn(`⚠️ Failed to normalize Shopify URL: ${imgUrl}`, e);
        return imgUrl; // Return original if normalization fails
      }
    };

    /**
     * Normalize e-commerce image URLs for better quality
     * Currently supports: Shopify
     */
    const normalizeImageUrl = (imgUrl: string): string => {
      // Shopify CDN normalization
      if (imgUrl.includes('cdn.shopify.com') || imgUrl.includes('/cdn/shop/')) {
        return normalizeShopifyImageUrl(imgUrl, 1920);
      }
      
      // Future: Add support for other platforms
      // if (imgUrl.includes('images-na.ssl-images-amazon.com')) { ... }
      // if (imgUrl.includes('images-static.nykaa.com')) { ... }
      
      return imgUrl;
    };

    // Helper: Add image with duplicate checking
    const addImage = (imgUrl: string, source: string): boolean => {
      // Check exact URL duplication first
      if (!imgUrl || seenUrls.has(imgUrl)) {
        if (DEBUG) console.log(`⏭️ Skipping exact URL duplicate: ${imgUrl}`);
        return false;
      }
      
      // Check duplicates by origin + filename (strip query params for CDN variants)
      const filename = getImageFilename(imgUrl);
      try {
        // Strip query parameters (e.g., ?v=123, ?width=800) for smarter deduplication
        const baseFilename = filename.split('?')[0];
        const normalizedKey = `${new URL(imgUrl, url).origin}/${baseFilename}`;
        
        if (seenFilenames.has(normalizedKey)) {
          if (DEBUG) console.log(`⏭️ Skipping duplicate: ${baseFilename} (${normalizedKey}) from ${source}`);
          return false;
        }
        seenFilenames.add(normalizedKey);
      } catch (e) {
        // If URL parsing fails, fall back to filename-only check
        const baseFilename = filename.split('?')[0];
        if (baseFilename && seenFilenames.has(baseFilename)) {
          if (DEBUG) console.log(`⏭️ Skipping duplicate filename: ${baseFilename} from ${source}`);
          return false;
        }
        if (baseFilename) seenFilenames.add(baseFilename);
      }
      
      // Domain filter - accept same-host or known CDNs
      try {
        // Handle relative URLs
        const absoluteUrl = imgUrl.startsWith('http') ? imgUrl : new URL(imgUrl, url).href;
        const imgHost = new URL(absoluteUrl).hostname;
        const pageHost = new URL(url).hostname;
        
        // Accept if:
        // 1. Same hostname (e.g., cosmix.in/cdn/... and cosmix.in/products/...)
        // 2. Known CDN (checked by isSameDomainOrCDN)
        if (imgHost !== pageHost && !isSameDomainOrCDN(absoluteUrl)) {
          if (DEBUG) console.log(`⚠️ Skipping external domain: ${imgHost} (page: ${pageHost}) from ${source}`);
          return false;
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse image URL: ${imgUrl}`, e);
        return false;
      }
      
      imageUrls.push(imgUrl);
      seenUrls.add(imgUrl);
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
              if (imgUrl) addImage(normalizeImageUrl(imgUrl), 'JSON-LD Product');
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
    
    // ===== FIND PRODUCT CONTAINER FIRST =====
    const productContainer = doc.querySelector('[itemtype*="schema.org/Product"]') ||
                             doc.querySelector('[data-product-id]') ||
                             doc.querySelector('.product-single') ||
                             doc.querySelector('.product-detail') ||
                             doc.querySelector('[class*="product-main"]') ||
                             doc.querySelector('[data-section-type="product"]') ||
                             doc.querySelector('[class*="product-view"]') ||
                             doc.querySelector('main');

    if (productContainer) {
      console.log('✅ Found product container, scanning images within it only');
    } else if (DEBUG) {
      console.warn('⚠️ No product container found, using page-wide scan');
    }

    // ===== EXCLUSION SELECTORS =====
    const excludeSelectors = [
      '[class*="recommended"]',
      '[class*="related-products"]',
      '[class*="cross-sell"]',
      '[class*="upsell"]',
      '[data-section-type="collection"]',
      '[class*="product-recommendations"]',
      '[class*="complementary"]',
      '[class*="product-card"]',
      '[class*="collection-grid"]',
      '[class*="product-reviews"]',
      '[class*="footer"]',
      '[class*="header"]',
      '[class*="banner"]',
      '[class*="product-thumbs-nav"]',
      '[class*="swiper-pagination"]',
      '[class*="slider-nav"]',
      '[class*="carousel-indicators"]'
    ];

    // ===== REFINED GALLERY SELECTORS (PRIORITY ORDER) =====
    const gallerySelectors = [
      // PRIORITY 0: Broad attribute-based selectors (for JS-rendered galleries)
      'img[data-src^="https://cosmix.in/cdn/shop"]',     // Cosmix CDN images with data-src
      'img[data-src^="http"]',                            // Any external image with data-src
      'img[data-srcset]',                                 // Responsive images
      'img[data-lazy-src]',                               // Lazy-loaded images
      '[class*="product"] img[data-src]',                 // Product container with data-src
      '[class*="gallery"] img[data-src]',                 // Gallery container with data-src
      
      // PRIORITY 1: Goodreads book covers (HIGH PRIORITY for books)
      '[class*="BookCover"] img',
      '[class*="book-cover"] img',
      '.ResponsiveImage img',
      '[aria-label*="Book cover"] img',
      
      // PRIORITY 2: Shopify/WooCommerce specific
      '.product__media-list img',
      '.product-single__photo img',
      '#ProductPhotos img',
      '.woocommerce-product-gallery img',
      
      // PRIORITY 3: Product-specific containers only
      '[class*="product-gallery"]:not([class*="recommend"]) img',
      '[class*="ProductGallery"]:not([class*="Related"]) img',
      '[data-product-images] img',
      '[class*="product-images"] img',
      '[class*="product__media"] img',
      '[class*="product-media"] img',
      '[class*="product-main-media"] img',
      '[class*="main-product-image-wrapper"] img',
      '[class*="image-container"] img',
      
      // PRIORITY 4: Swiper/carousel-based galleries (Cosmix, modern Shopify)
      '.product-thumbs-wrapper .swiper-slide img',
      '.swiper-container .swiper-slide img',
      '[class*="product-slider"] .swiper-slide img',
      '.product-gallery .swiper-slide img',
      '.product [class*="swiper-slide"] img',
      '[data-product-gallery] [class*="swiper"] img',
      '[class*="product"] [class*="carousel"] img',
      
      // PRIORITY 5: Generic fallback
      '[data-gallery-image]',
      '[data-product-image]',
      '[class*="ImageGallery"] img',
      '[class*="image-gallery"] img',
      '.product-image img',
      '.gallery img',
      '#product-photos img',
      '[id*="product-gallery"] img',
      '[id*="ProductGallery"] img',
      '[class*="thumbnail"] img'
    ];

    // ===== BATCH COLLECTION WITH EARLY EXIT =====
    const collectedGalleryImages = new Map<string, { url: string; source: string; priority: number }>();
    let foundMainGallery = false;

    // DEBUG: Log HTML structure for troubleshooting
    if (DEBUG && productContainer) {
      console.log(`🔍 Pre-extraction debug:`);
      console.log(`  - Product container found: ${productContainer.tagName}.${productContainer.className}`);
      console.log(`  - Total <img> tags in container: ${productContainer.querySelectorAll('img').length}`);
      console.log(`  - Images with [data-src]: ${productContainer.querySelectorAll('img[data-src]').length}`);
      console.log(`  - Images with [src]: ${productContainer.querySelectorAll('img[src]').length}`);
      console.log(`  - Swiper slides: ${productContainer.querySelectorAll('.swiper-slide').length}`);
      console.log(`  - Images in swiper slides: ${productContainer.querySelectorAll('.swiper-slide img').length}`);
      
      // Sample first 3 images for inspection
      const sampleImages = Array.from(productContainer.querySelectorAll('img')).slice(0, 3);
      sampleImages.forEach((img, idx) => {
        console.log(`  - Sample img[${idx}]: src="${img.getAttribute('src')}" data-src="${img.getAttribute('data-src')}" class="${img.className}"`);
      });
    }

    for (let i = 0; i < gallerySelectors.length; i++) {
      const selector = gallerySelectors[i];
      const priority = i; // Lower index = higher priority
      
      // Scope selector to product container if found
      const scopedSelector = productContainer 
        ? productContainer.querySelectorAll(selector)
        : doc.querySelectorAll(selector);
      
      if (DEBUG && scopedSelector.length > 0) {
        console.log(`Checking selector [${i}]: ${selector} (${scopedSelector.length} matches)`);
      }
      
      scopedSelector.forEach(img => {
        // Check if image is in excluded section
        const isExcluded = excludeSelectors.some(excludeSelector => {
          const parent = img.closest(excludeSelector);
          return parent !== null;
        });
        
        if (isExcluded) {
          if (DEBUG) console.log(`⏭️ Skipping excluded: ${img.getAttribute('src')}`);
          return;
        }
        
        let src = img.getAttribute('src') ||
                     img.getAttribute('data-src') ||
                     img.getAttribute('data-lazy-src') ||
                     img.getAttribute('data-image') ||
                     // Extract first URL from srcset (responsive images)
                     img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                     img.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0];
        if (!src) return;
        
        // Normalize URL for better quality (Shopify/e-commerce CDNs)
        const normalizedSrc = normalizeImageUrl(src);
        
        const filename = getImageFilename(normalizedSrc);
        
        if (!seenFilenames.has(filename)) {
          seenFilenames.add(filename);
          collectedGalleryImages.set(normalizedSrc, { url: normalizedSrc, source: selector, priority });
        } else if (DEBUG) {
          console.log(`⏭️ Skipping duplicate filename: ${filename}`);
        }
      });
      
      // Early exit if we found main gallery (priority 0-5 selectors with 3+ images)
      if (i <= 5 && collectedGalleryImages.size >= 3) {
        console.log(`✅ Found main product gallery with ${collectedGalleryImages.size} images using high-priority selectors`);
        foundMainGallery = true;
        break;
      }
    }

    if (!foundMainGallery && collectedGalleryImages.size > 0 && DEBUG) {
      console.log(`⚠️ Main gallery not found with high-priority selectors, used ${collectedGalleryImages.size} images from fallback selectors`);
    }

    // FALLBACK: If scoped search found nothing, retry without container restriction
    if (collectedGalleryImages.size === 0 && productContainer) {
      console.warn(`⚠️ No images found in scoped search, retrying without container restriction...`);
      
      // Retry top priority selectors on full document
      const retrySelectors = gallerySelectors.slice(0, 15); // Top 15 selectors only
      
      retrySelectors.forEach((selector, i) => {
        const imgs = doc.querySelectorAll(selector);
        
        imgs.forEach(img => {
          // Check exclusions
          const isExcluded = excludeSelectors.some(ex => img.closest(ex) !== null);
          if (isExcluded) return;
          
          let src = img.getAttribute('src') ||
                       img.getAttribute('data-src') ||
                       img.getAttribute('data-lazy-src') ||
                       img.getAttribute('data-image') ||
                       img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                       img.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0];
          
          if (!src) return;
          
          // Normalize URL for better quality (Shopify/e-commerce CDNs)
          const normalizedSrc = normalizeImageUrl(src);
          
          const filename = getImageFilename(normalizedSrc);
          
          if (!seenFilenames.has(filename)) {
            seenFilenames.add(filename);
            collectedGalleryImages.set(normalizedSrc, { url: normalizedSrc, source: `${selector} (full doc)`, priority: i });
          }
        });
        
        // Early exit if we found enough
        if (collectedGalleryImages.size >= 5) {
          console.log(`✅ Full document search found ${collectedGalleryImages.size} images`);
          return;
        }
      });
    }

    // Log collected images (batch, not per-image)
    console.log(`📸 Collected ${collectedGalleryImages.size} unique images from gallery selectors`);
    
    // Enhanced debug logging for gallery extraction
    if (productContainer) {
      const swiperSlides = productContainer.querySelectorAll('.swiper-slide');
      const imagesInSlides = productContainer.querySelectorAll('.swiper-slide img');
      
      if (DEBUG) {
        console.log(`🔍 Gallery extraction debug:`);
        console.log(`  - Container: ${productContainer.className || 'main'}`);
        console.log(`  - Swiper slides found: ${swiperSlides.length || 0}`);
        console.log(`  - Images in slides: ${imagesInSlides.length || 0}`);
        console.log(`  - Collected URLs: ${collectedGalleryImages.size}`);
      }
      
      // Warn if Swiper exists but no images collected
      if (swiperSlides.length > 0 && collectedGalleryImages.size === 0) {
        console.warn(`⚠️ Swiper structure detected (${swiperSlides.length} slides) but no images collected — HTML may be incomplete`);
      }
    }

    // Add top 7 gallery images sorted by priority
    const topGalleryImages = Array.from(collectedGalleryImages.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 7);

    topGalleryImages.forEach(({ url }) => {
      addImage(url, 'Gallery');
    });

    console.log(`✅ Added ${topGalleryImages.length} gallery images (top 7 by priority)`);

layer2Count = imageUrls.length - layer1Count;
console.log(`🖼️ Layer 2 found: ${layer2Count} images`);

// Product keyword filtering removed - trust gallery selectors instead

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

// Layer 5 body scan removed - prevents noise from unrelated product images

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

    // --- RESULT-BASED JS RENDER FALLBACK ---
    // Check if we should retry with JS rendering based on actual results
    const hasSwiperStructure = html.includes('swiper-slide') || 
                               html.includes('product-thumbs-wrapper') ||
                               html.includes('data-section-type="product"');
    
    const extractedImageCount = normalizedImages.length;
    
    // Only retry if:
    // 1. This is the first attempt (stage === 0)
    // 2. Swiper/dynamic structure detected
    // 3. We got very few images (< 3)
    // 4. It's an e-commerce page
    if (stage === 0 && hasSwiperStructure && extractedImageCount < 3 && isEcommercePage) {
      console.warn(`⚠️ Only ${extractedImageCount} images extracted from e-commerce page with Swiper structure`);
      console.log(`🔄 Retrying with JS render to load dynamic gallery...`);
      
      try {
        // Recursive call with stage=1 and forceJsRender=true
        return await extractMetadata(url, 1, true);
      } catch (retryError) {
        console.error(`❌ JS render retry failed:`, retryError);
        // Fall through to return current results
        console.log(`⚠️ Using partial results from static fetch (${extractedImageCount} images)`);
      }
    }

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
};

// Serve function that handles the request
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const url = body.url;
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the extraction function (starts at stage 0)
    return await extractMetadata(url, 0, false);
  } catch (error) {
    console.error('❌ Request handling error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
