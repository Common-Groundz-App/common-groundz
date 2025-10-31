
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parse } from 'https://esm.sh/node-html-parser@6.1.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEBUG = true; // ⬅️ TEMPORARILY ENABLED for Tira troubleshooting

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
      
      // Shared SPA domains list used by both Stage 1 and Stage 2
      const spaDomainsShared = [
        'nykaa.com',
        'tirabeauty.com',
        'amazon.in', 'amazon.com', 'amazon.co.uk',
        'flipkart.com',
        'myntra.com',
        'maccaron.in'
      ];
      
      // STAGE 1: Try static scraping first (faster, cheaper) - unless forcing JS render
      try {
        const shouldForceJsNow = forceJsRender || stage > 0;
        
        if (shouldForceJsNow) {
          console.log(`📥 Forcing JS render (stage ${stage})...`);
          throw new Error('Skip static, go straight to JS render');
        }
        
        console.log('📥 Stage 1: ScraperAPI static mode (premium)...');
        
        const hostname = new URL(url).hostname;
        const needsJsRendering = spaDomainsShared.some(domain => hostname.includes(domain));
        
        // Stage 1: Static scraping (no JS rendering)
        const scraperUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&premium=true`;
        
        const scraperResponse = await fetch(scraperUrl, {
          signal: AbortSignal.timeout(20000) // Static mode is faster
        });
        
        if (scraperResponse.ok) {
          html = await scraperResponse.text();
          
          if (html.length >= 300) {
            // NEW CHECK: If this is a known SPA, reject static scrape and force Stage 2
            if (needsJsRendering) {
              console.warn(`⚠️ Static HTML from SPA domain ${hostname}, forcing Stage 2`);
              throw new Error('SPA requires JS rendering');
            }
            
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
          
          // Use shared SPA domains list for consistency
          const needsJsRendering = spaDomainsShared.some(domain => hostname.includes(domain));
          
          // Compute shouldRender: respect forceJsRender, stage, or domain-based detection
          const shouldRender = forceJsRender || stage > 0 || needsJsRendering;
          
          console.log(`🔍 DEBUG: shouldRender=${shouldRender}, forceJsRender=${forceJsRender}, stage=${stage}, needsJsRendering=${needsJsRendering}`);
          
          const scraperUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}${shouldRender ? '&render=true' : ''}&premium=true`;
          
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

    // ===== LAYER 0: EXTRACT IMAGES FROM EMBEDDED JSON STATE =====
    console.log('📦 Layer 0: Mining embedded JSON state blobs...');
    
    // Track how many images we found from JSON state
    let jsonStateImageCount = 0;
    
    const scripts = doc.querySelectorAll('script[type="application/json"], script[id*="__NEXT"], script[id*="__NUXT"], script[id*="__APOLLO"]');
    
    // Recursively search for image URLs in the JSON blob
    const extractImagesFromJson = (obj: any, path: string = '', addImageFn: (url: string, source: string, altText: string) => boolean): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if this looks like an image property
        const imageKeys = [
          'image', 'images', 'media', 'gallery', 'photo', 'photos', 
          'thumbnail', 'src', 'url',
          // E-commerce resolution variants (Flipkart, Amazon, etc.)
          'big', 'large', 'small', 'medium', 'xlarge', 'xxlarge',
          'highResolution', 'highRes', 'lowRes',
          'variants', 'sizes', 'resolutions'
        ];
        const isImageKey = imageKeys.some(imgKey => key.toLowerCase().includes(imgKey));
        
        if (DEBUG && isImageKey) {
          console.log(`  🔍 Inspecting image key: ${currentPath} (type: ${typeof value})`);
        }
        
        if (isImageKey) {
          // Handle string URLs
          if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('//'))) {
            const normalizedUrl = normalizeImageUrl(value);
            if (addImageFn(normalizedUrl, 'Script (JSON-LD)', currentPath)) {
              jsonStateImageCount++;
            }
          }
          
          // Handle objects with URL variants (Flipkart gallery images)
          if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            const variantKeys = ['big', 'large', 'xlarge', 'xxlarge', 'small', 'medium', 'highResolution', 'highRes'];
            let foundVariants = false;
            
            variantKeys.forEach(variantKey => {
              if (value[variantKey]) {
                const variantValue = value[variantKey];
                
                // Handle string URLs
                if (typeof variantValue === 'string' && (variantValue.startsWith('http') || variantValue.startsWith('//'))) {
                  const normalizedUrl = normalizeImageUrl(variantValue);
                  if (addImageFn(normalizedUrl, 'Script (JSON-LD)', `${currentPath}.${variantKey}`)) {
                    jsonStateImageCount++;
                    foundVariants = true;
                    if (DEBUG) console.log(`  📸 Found variant: ${variantKey} → ${variantValue.slice(-60)}`);
                  }
                }
              }
            });
            
            // If we found variants, log success
            if (foundVariants && DEBUG) {
              console.log(`  ✅ Extracted ${variantKeys.filter(k => value[k]).length} resolution variants from ${currentPath}`);
            }
          }
          
          // Handle arrays of URLs
          if (Array.isArray(value)) {
            value.forEach((item, i) => {
              if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('//'))) {
                const normalizedUrl = normalizeImageUrl(item);
                if (addImageFn(normalizedUrl, 'Script (JSON-LD)', `${currentPath}[${i}]`)) {
                  jsonStateImageCount++;
                }
              } else if (typeof item === 'object') {
                extractImagesFromJson(item, `${currentPath}[${i}]`, addImageFn);
              }
            });
          }
        }
        
        // Recurse into nested objects/arrays
        if (typeof value === 'object' && value !== null) {
          extractImagesFromJson(value, currentPath, addImageFn);
        }
      }
    };
    
    // We'll need to define addImage function first, so we'll temporarily store these
    // and process them after addImage is defined
    const pendingJsonImages: Array<{ url: string; source: string; altText: string }> = [];
    
    // Shared function for both JSON-LD scripts and inline state assignments
    const tempAddImage = (url: string, source: string, altText: string): boolean => {
      pendingJsonImages.push({ url, source, altText });
      return true;
    };
    
    scripts.forEach((script, idx) => {
      try {
        const scriptId = script.getAttribute('id') || `script-${idx}`;
        const scriptContent = script.textContent;
        
        if (!scriptContent || scriptContent.length < 50) return;
        
        const jsonData = JSON.parse(scriptContent);
        
        // Use shared tempAddImage function
        extractImagesFromJson(jsonData, scriptId, tempAddImage);
        
      } catch (e) {
        // Silently skip non-JSON or malformed scripts
      }
    });
    
    // Layer 0b: Parse inline window.__INITIAL_STATE__ assignments (Flipkart, etc.)
    console.log('🔍 Layer 0b: Scanning inline state assignments...');
    const inlineScripts = doc.querySelectorAll('script:not([src])');
    
    inlineScripts.forEach((script) => {
      try {
        const scriptText = script.textContent || '';
        
        // Find the assignment pattern
        const assignmentPattern = /window\.__(?:INITIAL_STATE|INITIAL_DATA|PRELOADED_STATE)__\s*=\s*/;
        const match = scriptText.match(assignmentPattern);
        
        if (match) {
          const startIndex = match.index! + match[0].length;
          
          // Find the opening brace
          let jsonStart = startIndex;
          while (jsonStart < scriptText.length && scriptText[jsonStart] !== '{') {
            jsonStart++;
          }
          
          if (jsonStart >= scriptText.length) {
            console.warn('⚠️ No opening brace found after state assignment');
            return;
          }
          
          // Use balanced-brace counter to find the complete JSON object
          let braceCount = 0;
          let jsonEnd = jsonStart;
          let foundComplete = false;
          
          for (let i = jsonStart; i < scriptText.length; i++) {
            if (scriptText[i] === '{') braceCount++;
            if (scriptText[i] === '}') braceCount--;
            
            if (braceCount === 0) {
              jsonEnd = i + 1;
              foundComplete = true;
              break;
            }
          }
          
          if (!foundComplete) {
            console.warn('⚠️ Unbalanced braces in inline state assignment');
            return;
          }
          
          const jsonPayload = scriptText.substring(jsonStart, jsonEnd);
          console.log(`📋 Found inline state assignment (${jsonPayload.length} bytes, braces balanced)`);
          
          try {
            const jsonData = JSON.parse(jsonPayload);
            extractImagesFromJson(jsonData, 'window.__INITIAL_STATE__', tempAddImage);
            console.log(`✅ Successfully parsed inline state, found ${pendingJsonImages.length} images so far`);
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse inline state JSON: ${parseError.message}`);
            console.warn(`📄 First 200 chars: ${jsonPayload.substring(0, 200)}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ Error scanning inline script: ${e.message}`);
      }
    });
    
    console.log(`📦 Layer 0 parsing complete: Found ${pendingJsonImages.length} potential images in JSON state`);

    // Extract favicon
    const favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') || '';

    // ===== ENHANCED PRODUCT IMAGE EXTRACTION =====
    interface ImageWithPriority {
      url: string;
      priority: number;
      source: string;
      canonicalKey: string;
      sizeHint: number;
    }
    const imageCollection: ImageWithPriority[] = [];
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

    // ✅ REFINEMENT 1: Extended proxy/CDN detection (moved to top level for reuse)
    const PROXY_CDN_PATTERNS = [
      'wsrv.nl',
      'weserv.nl',
      'cdn.shopify.com',
      'cloudfront.net',
      'jsdelivr.net',
      'imgix.net',
      'cloudinary.com'
    ];

    // Helper: Extract filename without query params (with proxy/CDN support)
    const getImageFilename = (imgUrl: string): string => {
      try {
        const urlObj = new URL(imgUrl, url);
        
        const isProxyCDN = PROXY_CDN_PATTERNS.some(pattern => 
          urlObj.hostname.includes(pattern)
        );
        
        // SPECIAL CASE 1: wsrv.nl/weserv.nl proxy with url parameter
        if ((urlObj.hostname.includes('wsrv.nl') || urlObj.hostname.includes('weserv.nl'))) {
          const actualUrl = urlObj.searchParams.get('url');
          if (actualUrl) {
            try {
              const decodedUrl = decodeURIComponent(actualUrl);
              const actualUrlObj = new URL(decodedUrl);
              const actualPathname = actualUrlObj.pathname;
              const actualFilename = actualPathname.split('/').pop()?.split('?')[0].split('#')[0] || '';
              
              // REFINEMENT 2: Normalize to lowercase
              const normalized = actualFilename.toLowerCase();
              
              if (DEBUG) console.log(`📦 Extracted from proxy: ${normalized}`);
              return normalized;
            } catch {
              // If proxy URL parsing fails, continue with normal extraction
            }
          }
        }
        
        // SPECIAL CASE 2: CDN services (extract from path, not query params)
        if (isProxyCDN) {
          const pathname = urlObj.pathname;
          // Extract the actual filename from CDN path structures like:
          // /s/files/1/0123/4567/products/shoe.jpg
          // /c_fill,w_800/product-image.jpg
          const filename = pathname.split('/').pop()?.split('?')[0].split('#')[0] || '';
          
          // REFINEMENT 2: Normalize to lowercase
          const normalized = filename.toLowerCase();
          
          if (DEBUG) console.log(`📦 Extracted from CDN: ${normalized}`);
          return normalized;
        }
        
        // NORMAL CASE: Extract from pathname
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop()?.split('?')[0].split('#')[0] || '';
        
        // REFINEMENT 2: Normalize to lowercase
        const normalized = filename.toLowerCase();
        
        // FALLBACK: If filename is empty (root path), use full URL as identifier
        if (!normalized || normalized === '') {
          // Use the full URL (without protocol) as unique identifier
          const fallback = `${urlObj.hostname}${urlObj.pathname}${urlObj.search}`
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase(); // REFINEMENT 2: Also normalize fallback
          
          if (DEBUG) console.log(`⚠️ Using fallback identifier: ${fallback.slice(-40)}`);
          return fallback;
        }
        
        return normalized;
      } catch {
        // ULTIMATE FALLBACK: Use a hash of the URL
        const fallback = imgUrl.slice(-40)
          .replace(/[^a-zA-Z0-9]/g, '-')
          .toLowerCase(); // REFINEMENT 2: Normalize fallback
        
        if (DEBUG) console.log(`⚠️ Using ultimate fallback: ${fallback}`);
        return fallback;
      }
    };

    /**
     * Build a deduplication key for an image URL
     * For proxy/CDN URLs: includes size parameters to allow different variants
     * For normal URLs: uses origin + filename for robust deduplication
     */
    const buildImageDedupKey = (imgUrl: string, filename: string): string => {
      try {
        // Parse the URL to access query parameters
        let urlObj: URL;
        try {
          if (imgUrl.startsWith('//')) {
            urlObj = new URL(`https:${imgUrl}`);
          } else if (imgUrl.startsWith('http')) {
            urlObj = new URL(imgUrl);
          } else {
            urlObj = new URL(imgUrl, url);
          }
        } catch {
          // If URL parsing fails, fall back to filename only
          return filename;
        }
        
        // Check if this is a proxy/CDN URL
        const isProxy = PROXY_CDN_PATTERNS.some(pattern => urlObj.hostname.includes(pattern));
        
        if (isProxy) {
          // For proxy URLs, include size parameters to allow different variants
          const sizeParams = ['width', 'height', 'w', 'h', 'size'].map(param => {
            const value = urlObj.searchParams.get(param);
            return value ? `${param}${value}` : null;
          }).filter(Boolean).join('-');
          
          // Return filename + size params (e.g., "myumhbbtf2-width1080-height500")
          return sizeParams ? `${filename}-${sizeParams}` : filename;
        } else {
          // For normal URLs, use origin + filename for deduplication
          return `${urlObj.origin}/${filename}`;
        }
      } catch {
        // Ultimate fallback
        return filename;
      }
    };

    /**
     * Extract size hints from image URLs across all CDN patterns
     * Returns the larger dimension (width or height) for prioritization
     */
    const extractImageSizeHint = (imgUrl: string): { width?: number; height?: number; maxDimension: number } => {
      try {
        const urlObj = new URL(imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl);
        const pathname = urlObj.pathname;
        const params = urlObj.searchParams;
        
        let width: number | undefined;
        let height: number | undefined;
        
        // 1. Query parameters (wsrv.nl, imgix, generic CDNs)
        const widthParams = ['width', 'w', 'max-w', 'maxwidth', 'imwidth'];
        const heightParams = ['height', 'h', 'max-h', 'maxheight', 'imheight'];
        
        for (const param of widthParams) {
          const value = params.get(param);
          if (value) {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) width = parsed;
            break;
          }
        }
        
        for (const param of heightParams) {
          const value = params.get(param);
          if (value) {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) height = parsed;
            break;
          }
        }
        
        // 2. Shopify filename patterns: product_2048x.jpg, product_1024x1024.jpg
        const shopifyMatch = pathname.match(/_(\d+)x(\d*)\.(jpg|jpeg|png|webp)/i);
        if (shopifyMatch) {
          width = parseInt(shopifyMatch[1]);
          if (shopifyMatch[2]) height = parseInt(shopifyMatch[2]);
        }
        
        // 3. Cloudinary path patterns: /w_2048/, /h_1080/, /c_scale/
        const cloudinaryWidth = pathname.match(/\/w_(\d+)\//);
        const cloudinaryHeight = pathname.match(/\/h_(\d+)\//);
        if (cloudinaryWidth) width = parseInt(cloudinaryWidth[1]);
        if (cloudinaryHeight) height = parseInt(cloudinaryHeight[1]);
        
        // 4. ImageKit.io patterns: /tr:w-2048/
        const imagekitWidth = pathname.match(/\/tr:w-(\d+)/);
        const imagekitHeight = pathname.match(/\/tr:h-(\d+)/);
        if (imagekitWidth) width = parseInt(imagekitWidth[1]);
        if (imagekitHeight) height = parseInt(imagekitHeight[1]);
        
        // 5. Nykaa patterns: .jpg?tr=w-2048
        const nykaaWidth = params.get('tr')?.match(/w-(\d+)/);
        if (nykaaWidth) width = parseInt(nykaaWidth[1]);
        
        // 6. Decoded proxy targets (wsrv.nl, weserv.nl with embedded URLs)
        const embeddedUrl = params.get('url') || params.get('image');
        if (embeddedUrl) {
          try {
            const decoded = decodeURIComponent(embeddedUrl);
            const embeddedSize = extractImageSizeHint(decoded);
            if (!width && embeddedSize.width) width = embeddedSize.width;
            if (!height && embeddedSize.height) height = embeddedSize.height;
          } catch {
            // Ignore decoding errors
          }
        }
        
        // Return the larger dimension for prioritization
        const maxDimension = Math.max(width || 0, height || 0);
        
        return { width, height, maxDimension };
      } catch (e) {
        return { maxDimension: 0 };
      }
    };

    /**
     * Build a canonical key for image deduplication WITHOUT size parameters
     * This allows us to identify different size variants of the same image
     * Reuses the existing buildImageDedupKey logic but strips size info
     */
    const buildCanonicalImageKey = (imgUrl: string, filename: string): string => {
      try {
        let urlObj: URL;
        try {
          if (imgUrl.startsWith('//')) {
            urlObj = new URL(`https:${imgUrl}`);
          } else if (imgUrl.startsWith('http')) {
            urlObj = new URL(imgUrl);
          } else {
            urlObj = new URL(imgUrl, url);
          }
        } catch {
          return filename;
        }
        
        // Check if this is a proxy/CDN URL
        const isProxy = PROXY_CDN_PATTERNS.some(pattern => urlObj.hostname.includes(pattern));
        
        if (isProxy) {
          // For proxy URLs: Return just the filename WITHOUT size params
          // This makes "product.jpg&width=256" and "product.jpg&width=1080" collapse to "product.jpg"
          return filename;
        } else {
          // For normal URLs: Use origin + filename (same as buildImageDedupKey)
          return `${urlObj.origin}/${filename}`;
        }
      } catch {
        return filename;
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
          'tirabeauty.com': ['cdn.tirabeauty.com'],
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

    // ===== TIER 1: BLACKLIST KNOWN BAD DOMAINS =====
    const BLOCKED_IMAGE_DOMAINS = [
      'doubleclick.net',
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.com',
      'facebook.net',
      'twitter.com',
      'analytics',
      'tracking',
      'pixel',
      'ads.',
      'ad.',
      'track.',
      'beacon.',
      'tag.',
      'event.'
    ];

    const isBlockedDomain = (imgUrl: string): boolean => {
      try {
        const hostname = new URL(imgUrl, url).hostname.toLowerCase();
        return BLOCKED_IMAGE_DOMAINS.some(pattern => hostname.includes(pattern));
      } catch {
        return true; // Block invalid URLs
      }
    };

    // ===== TIER 2: TRUSTED PRODUCT IMAGE CDN WHITELIST =====
    // Exact hostname matching to prevent false positives
    const TRUSTED_PRODUCT_CDN_HOSTNAMES = [
      // Flipkart CDNs
      'rukminim1.flixcart.com',
      'rukminim2.flixcart.com',
      'static-assets-web.flixcart.com',
      'img.flixcart.com',
      
      // Maccaron
      'cdn.maccaron.in',
      'static-assets-web.maccaron.in',
      
      // Amazon
      'm.media-amazon.com',
      'images-eu.ssl-images-amazon.com',
      'images-na.ssl-images-amazon.com',
      
      // Nykaa
      'images-static.nykaa.com',
      'cdn.nykaa.com',
      
      // Shopify (generic)
      'cdn.shopify.com',
      
      // Tira Beauty
      'cdn.tirabeauty.com'
    ];

    /**
     * Check if URL is from a trusted product CDN using exact hostname matching
     * This prevents substring false positives (e.g., evil-site.com/flixcart.com/...)
     */
    const isTrustedProductCdn = (imgUrl: string): boolean => {
      try {
        const urlObj = new URL(imgUrl);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Exact match or subdomain match (e.g., rukminim3.flixcart.com)
        return TRUSTED_PRODUCT_CDN_HOSTNAMES.some(trustedHost => {
          return hostname === trustedHost || 
                 hostname.endsWith('.' + trustedHost) ||
                 // Handle numbered subdomains (rukminim1, rukminim2, etc.)
                 (trustedHost.match(/^[a-z]+\d+\./) && 
                  hostname.replace(/\d+/, '1') === trustedHost);
        });
      } catch {
        // URL parsing failed - not a valid URL
        return false;
      }
    };

    // ===== TIER 2: SMART IMAGE QUALITY VALIDATION =====
    const isLikelyProductImage = (imgUrl: string, altText: string = ''): boolean => {
      const urlLower = imgUrl.toLowerCase();
      const alt = altText.toLowerCase();
      
      // ✅ REFINEMENT 2: MIME-type / extension validation (proxy-aware)
      // Fast path: check for extension in URL path first (covers most CDNs)
      const hasPathExtension = urlLower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);

      if (!hasPathExtension) {
        // No path extension - check if it's a proxy URL, trusted CDN, or reject
        try {
          const urlObj = new URL(imgUrl);
          const isProxy = PROXY_CDN_PATTERNS.some(pattern => urlObj.hostname.includes(pattern));
          const isTrustedCdn = isTrustedProductCdn(imgUrl);
          
          if (isProxy) {
            // For proxy URLs, check output/format parameter OR embedded URL extension
            const hasValidFormat = urlLower.includes('output=webp') || 
                                  urlLower.includes('output=jpg') || 
                                  urlLower.includes('output=jpeg') || 
                                  urlLower.includes('output=png') ||
                                  urlLower.includes('format=webp') ||
                                  urlLower.includes('format=jpg') ||
                                  urlLower.includes('format=jpeg') ||
                                  urlLower.includes('format=png') ||
                                  urlLower.match(/url=.*\.(jpg|jpeg|png|webp)/i);
            
            if (!hasValidFormat) {
              if (DEBUG) console.log(`⏭️ Invalid proxy format: ${imgUrl.slice(-40)}`);
              return false;
            }
            if (DEBUG) console.log(`✅ Valid proxy image: ${imgUrl.slice(-60)}`);
          } else if (isTrustedCdn) {
            // ✅ Trusted CDN - bypass extension check
            // But STILL enforce size/pattern checks below
            if (DEBUG) console.log(`✅ Trusted CDN bypass: ${imgUrl.slice(-60)}`);
            // Don't return here - fall through to size/pattern validation
          } else {
            // Not a proxy, not a trusted CDN, no extension = reject
            if (DEBUG) console.log(`⏭️ Invalid extension: ${imgUrl.slice(-40)}`);
            return false;
          }
        } catch {
          // URL parsing failed and no path extension = reject
          if (DEBUG) console.log(`⏭️ Invalid extension (fallback): ${imgUrl.slice(-40)}`);
          return false;
        }
      }
      // If hasPathExtension is true, continue to next validation step
      
      // Size check: Reject URLs with explicit small dimensions
      const sizeMatch = urlLower.match(/(?:width|w|size)=(\d+)/);
      if (sizeMatch && parseInt(sizeMatch[1]) < 150) {
        if (DEBUG) console.log(`⏭️ Too small (${sizeMatch[1]}px): ${imgUrl.slice(-40)}`);
        return false;
      }
      
      // Exclude by filename/path patterns (domain-agnostic approach)
      const excludePatterns = [
        'logo', 'icon', 'banner', 'ad', 'promo',
        'tracking', 'pixel', 'badge', 'rating',
        'social', 'share', 'cart', 'wishlist',
        'button', 'arrow', 'close', 'search',
        'placeholder', 'sprite', 'sample', 'thumb'
      ];
      
      // Parse URL to extract pathname and filename
      let pathname = '';
      let filename = '';
      try {
        const u = new URL(imgUrl);
        pathname = u.pathname.toLowerCase();
        filename = pathname.split('/').pop() ?? '';
      } catch {
        // Fallback for relative URLs
        pathname = imgUrl.toLowerCase();
        filename = pathname.split('/').pop() ?? '';
      }
      
      // Check filename first (highest precision)
      if (excludePatterns.some(pattern => filename.includes(pattern))) {
        if (DEBUG) console.log(`⏭️ Excluded filename pattern: ${filename}`);
        return false;
      }
      
      // Check shallow paths only (≤3 segments, e.g., /images/logo.png)
      const pathSegments = pathname.split('/').filter(s => s.length > 0);
      const isShallowPath = pathSegments.length <= 3;
      
      if (isShallowPath && excludePatterns.some(pattern => pathname.includes(pattern))) {
        if (DEBUG) console.log(`⏭️ Excluded shallow path pattern: ${pathname}`);
        return false;
      }
      
      if (DEBUG) console.log(`✅ Path check passed: ${pathname}`);
      
      // Check alt text for obvious non-product images
      if (alt.includes('logo') || alt.includes('icon') || alt.includes('banner')) {
        if (DEBUG) console.log(`⏭️ Excluded by alt text: ${alt}`);
        return false;
      }
      
      return true;
    };

    // ===== TIER 3: ✅ REFINEMENT 1: PRIORITY SCORING (KEEP WHITELIST AS BOOSTER) =====
    const calculateImagePriority = (imgUrl: string, source: string, sizeHint: number = 0): number => {
      let priority = 0;
      
      // Base priority by source
      const sourcePriority: Record<string, number> = {
        'JSON-LD Product': 10,
        'JSON-LD Article': 8,
        'JSON-LD ImageObject': 8,
        'Script': 9,
        'Gallery': 8,
        'Open Graph': 5,
        'Twitter Card': 4,
        'Universal fallback': 2
      };
      priority += sourcePriority[source] || 0;
      
      // ✅ REFINEMENT 1: Bonus for whitelisted CDN (not filter, just boost)
      if (isSameDomainOrCDN(imgUrl)) {
        priority += 3;
        if (DEBUG) console.log(`📈 Priority boost (+3): Trusted CDN`);
      }
      
      // Bonus for product keywords in URL
      const productKeywords = ['product', 'item', 'media', 'gallery', 'catalog'];
      if (productKeywords.some(kw => imgUrl.toLowerCase().includes(kw))) {
        priority += 1;
      }
      
      // Size-based bonus (larger images get higher priority)
      // +0.5 for every 1000px (so 2048px gets +1, 4096px gets +2)
      if (sizeHint > 0) {
        const sizeBonus = Math.min(2, sizeHint / 1000 * 0.5);  // Cap at +2
        priority += sizeBonus;
        if (DEBUG && sizeBonus > 0) {
          console.log(`📈 Priority boost (+${sizeBonus.toFixed(1)}): Size ${sizeHint}px`);
        }
      }
      
      return priority;
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
        
        // Protocol-relative URLs already fixed by normalizeImageUrl()
        const urlObj = new URL(imgUrl);
        const searchParams = urlObj.searchParams;
        
        // Remove size-limiting parameters
        searchParams.delete('width');
        searchParams.delete('height');
        searchParams.delete('crop');
        
        // Add high-resolution width
        searchParams.set('width', targetWidth.toString());
        
        // Reconstruct URL (keeps 'v=' version parameter for cache busting)
        urlObj.search = searchParams.toString();
        
        const normalizedUrl = urlObj.toString();
        
        if (DEBUG && imgUrl !== normalizedUrl) {
          console.log(`🔧 Normalized Shopify URL: ${imgUrl.split('?')[0].slice(-40)}... → width=${targetWidth}`);
        }
        
        return normalizedUrl;
      } catch (e) {
        console.warn(`⚠️ Failed to normalize Shopify URL: ${imgUrl}`, e);
        return imgUrl; // Return original if normalization fails
      }
    };

    /**
     * Normalize e-commerce image URLs for better quality
     * Currently supports: Shopify, Tira Beauty
     */
    const normalizeImageUrl = (imgUrl: string): string => {
      // Fix protocol-relative URLs universally (//domain.com → https://domain.com)
      // This handles Shopify, Tira, Nykaa, Myntra, and any future CDN
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
        if (DEBUG) {
          console.log(`🔧 Fixed protocol-relative URL globally: //${imgUrl.slice(8, 40)}...`);
        }
      }
      
      // Shopify CDN normalization
      if (imgUrl.includes('cdn.shopify.com') || imgUrl.includes('/cdn/shop/')) {
        return normalizeShopifyImageUrl(imgUrl, 1920);
      }
      
      // Tira Beauty CDN normalization
      if (imgUrl.includes('cdn.tirabeauty.com')) {
        try {
          const urlObj = new URL(imgUrl);
          
          // Step 1: Remove dpr parameter for original quality
          urlObj.searchParams.delete('dpr');
          
          // Step 2: Replace resize-w:XX with original/ for full-size images
          let pathname = urlObj.pathname;
          if (pathname.includes('/resize-w:')) {
            // Replace /resize-w:60/ or /resize-w:540/ with /original/
            pathname = pathname.replace(/\/resize-w:\d+\//, '/original/');
            urlObj.pathname = pathname;
            if (DEBUG) {
              console.log(`🔧 Tira URL: Replaced resize-w: with original/`);
            }
          }
          
          const normalized = urlObj.toString();
          if (DEBUG && imgUrl !== normalized) {
            console.log(`🔧 Normalized Tira URL: ${imgUrl.slice(-60)} → ${normalized.slice(-60)}`);
          }
          return normalized;
        } catch (e) {
          console.warn(`⚠️ Failed to normalize Tira URL: ${imgUrl}`, e);
        }
      }
      
      // Future: Add support for other platforms
      // if (imgUrl.includes('images-na.ssl-images-amazon.com')) { ... }
      // if (imgUrl.includes('images-static.nykaa.com')) { ... }
      
      return imgUrl;
    };

    // Helper: Add image with smart filtering and priority
    const addImage = (imgUrl: string, source: string, altText: string = ''): boolean => {
      // Check exact URL duplication first
      if (!imgUrl || seenUrls.has(imgUrl)) {
        if (DEBUG) console.log(`⏭️ Skipping exact URL duplicate: ${imgUrl}`);
        return false;
      }
      
      // Check duplicates by origin + filename (strip query params for CDN variants)
      const filename = getImageFilename(imgUrl);
      
      // Skip if filename extraction failed completely
      if (!filename) {
        if (DEBUG) console.log(`⚠️ Could not extract filename from: ${imgUrl.slice(-60)}`);
        return false;
      }
      
      let canonicalKey: string;
      let sizeInfo: { width?: number; height?: number; maxDimension: number };
      
      try {
        const baseFilename = filename.split('?')[0].split('#')[0].toLowerCase();
        const dedupKeyWithSize = buildImageDedupKey(imgUrl, baseFilename);  // Includes size for exact duplicate check
        canonicalKey = buildCanonicalImageKey(imgUrl, baseFilename);  // WITHOUT size for collapsing variants
        sizeInfo = extractImageSizeHint(imgUrl);
        
        if (seenFilenames.has(dedupKeyWithSize)) {
          if (DEBUG) console.log(`⏭️ Skipping duplicate: ${dedupKeyWithSize.slice(-60)} from ${source}`);
          return false;
        }
        seenFilenames.add(dedupKeyWithSize);
        if (DEBUG) console.log(`🆕 New image tracked: ${canonicalKey.slice(-40)} (${sizeInfo.maxDimension}px)`);
      } catch (e) {
        // Fallback to filename-only check
        const baseFilename = filename.split('?')[0].split('#')[0].toLowerCase();
        canonicalKey = baseFilename;
        sizeInfo = { maxDimension: 0 };
        
        if (baseFilename && seenFilenames.has(baseFilename)) {
          if (DEBUG) console.log(`⏭️ Skipping duplicate filename: ${baseFilename} from ${source}`);
          return false;
        }
        if (baseFilename) {
          seenFilenames.add(baseFilename);
          if (DEBUG) console.log(`🆕 New image tracked (fallback): ${baseFilename}`);
        }
      }
      
      // Handle relative URLs
      const absoluteUrl = imgUrl.startsWith('http') ? imgUrl : new URL(imgUrl, url).href;
      
      // TIER 1: Block known bad domains
      if (isBlockedDomain(absoluteUrl)) {
        if (DEBUG) console.log(`🚫 Blocked domain: ${absoluteUrl.slice(-40)}`);
        return false;
      }
      
      // TIER 2: Smart quality filter
      if (!isLikelyProductImage(absoluteUrl, altText)) {
        return false;
      }
      
      // TIER 3: Calculate priority with size hint
      const priority = calculateImagePriority(absoluteUrl, source, sizeInfo.maxDimension);
      
      imageCollection.push({ 
        url: absoluteUrl, 
        priority, 
        source,
        canonicalKey,
        sizeHint: sizeInfo.maxDimension
      });
      seenUrls.add(imgUrl);
      console.log(`✅ Added from ${source} (priority: ${priority}, size: ${sizeInfo.maxDimension}px): ${absoluteUrl}`);
      return true;
    };

    // Process JSON state images that were found in Layer 0
    if (pendingJsonImages.length > 0) {
      console.log(`📦 Processing ${pendingJsonImages.length} images from JSON state...`);
      pendingJsonImages.forEach(({ url, source, altText }) => {
        const added = addImage(url, source, altText);
        if (added) {
          console.log(`  ✅ Added JSON state image: ${url.substring(0, 80)}...`);
        }
      });
      console.log(`📦 Layer 0 complete: ${imageCollection.length} images after JSON processing`);
    }

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

  layer1Count = imageCollection.length;
  console.log(`📦 Layer 1 found: ${layer1Count} images`);

  // ===== LAYER 2.5: SCRIPT/JSON-LD EXTRACTION (For Vue/React SPAs like Tira Beauty) =====
  if (imageCollection.length < 5 && hostname.includes('tirabeauty.com')) {
    console.log('📜 Layer 2.5: Extracting images from page scripts for Tira Beauty...');
    
    const scripts = doc.querySelectorAll('script[type="application/ld+json"], script:not([src])');
    const scriptImages = new Set<string>();
    let scriptImageCount = 0;
    
    for (const script of scripts) {
      const content = script.textContent;
      if (!content) continue;
      
      // Extract all Tira CDN URLs from script content (match image extensions)
      const cdnUrlPattern = /https:\/\/cdn\.tirabeauty\.com\/[^\s"'<>{}[\]()]+?\.(?:jpg|jpeg|png|webp)/gi;
      const matches = content.match(cdnUrlPattern);
      
      if (matches) {
        if (DEBUG) console.log(`  Found ${matches.length} CDN URLs in script tag`);
        
        for (const match of matches) {
          try {
            // Clean URL (remove any trailing punctuation/characters)
            let cleanUrl = match.replace(/[,;}\]]+$/, '');
            const urlObj = new URL(cleanUrl);
            
            // Skip if it's a loader/spinner/placeholder
            const isLoader = ['/loader', '/spinner', '/loading', '/placeholder', '/icon'].some(
              pattern => urlObj.pathname.toLowerCase().includes(pattern)
            );
            if (isLoader) {
              if (DEBUG) console.log(`  ⏭️ Skipping loader: ${urlObj.pathname.slice(-50)}`);
              continue;
            }
            
            // Normalize to original/ if it contains resize-w:
            let pathname = urlObj.pathname;
            if (pathname.includes('/resize-w:')) {
              pathname = pathname.replace(/\/resize-w:\d+\//, '/original/');
              urlObj.pathname = pathname;
              if (DEBUG) console.log(`  🔧 Normalized resize-w: to original/`);
            }
            
            // Remove dpr parameter for highest quality
            urlObj.searchParams.delete('dpr');
            
            const finalUrl = urlObj.toString();
            
            // TIRA PRODUCT IMAGE VALIDATION
            // Only accept images from product item directories
            const isProductImage = pathname.includes('/products/pictures/item/');
            
            // Exclude non-product images (logos, icons, platform assets)
            const excludePatterns = [
              '/application/pictures/',  // App icons
              '/brands/pictures/',       // Brand logos
              '/company/',               // Company assets
              '/platform/extensions/',   // Extension widgets
              '/free-logo/',            // Logos
              '/square-logo/',          // Square logos
              '/favicon/',              // Favicons
            ];
            
            const isExcluded = excludePatterns.some(pattern => pathname.includes(pattern));
            
            // Only add if it's a product image and not excluded
            if (isProductImage && !isExcluded) {
              if (!scriptImages.has(finalUrl)) {
                scriptImages.add(finalUrl);
                scriptImageCount++;
                if (DEBUG) console.log(`  ✅ Added product image: ${pathname.slice(-80)}`);
              }
            } else {
              if (DEBUG) {
                if (isExcluded) {
                  console.log(`  ⏭️ Skipping non-product (excluded): ${pathname.slice(-60)}`);
                } else if (!isProductImage) {
                  console.log(`  ⏭️ Skipping non-product directory: ${pathname.slice(-60)}`);
                }
              }
            }
          } catch (e) {
            // Invalid URL, skip silently
          }
        }
      }
    }
    
    // Add script images to main images array
    scriptImages.forEach(url => {
      if (!imageCollection.some(img => img.url === url)) {
        addImage(url, 'Script');
      }
    });
    
    if (scriptImageCount > 0) {
      console.log(`✅ Layer 2.5 found: ${scriptImageCount} images from scripts`);
    } else {
      console.log(`⚠️ Layer 2.5: No images found in scripts`);
    }
  }

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
      
      // PRIORITY 0.5: Tira Beauty lazy-loaded selectors
      'img.lazyload[data-src]',                           // LazyLoad.js pattern
      'img.product-detail-image[data-src]',               // Tira Beauty main image
      '.product-image-images img[data-src]',              // Tira Beauty image container
      'img[src^="data:image"][data-src]',                 // Images with placeholder + data-src
      
      // PRIORITY 0.55: Nykaa-specific selectors (NO [srcset] requirement)
      '[class*="ImageGallery"] img',                      // Nykaa gallery wrapper
      '[class*="image-gallery"] img',                     // Nykaa lowercase variant
      '[class*="product-image"] img',                     // Nykaa product images (no srcset required)
      '[class*="productPage"] img',                       // Product page lowercase
      '[class*="ProductPage"] img',                       // Product page capital P
      '[class*="css-"] img[src*="nykaa"]',                // Emotion styled-components with Nykaa CDN
      'main img[src*="nykaa"]',                           // Main content with Nykaa CDN
      'img[alt*="product"]',                              // Product alt text (no srcset required)
      'img[alt*="Product"]',                              // Product alt text capital P (no srcset required)
      '[class*="product"] img[src*="nykaa"]',             // Product containers with Nykaa CDN
      '[data-testid*="image"] img',                       // React test ID patterns
      '[data-testid*="gallery"] img',                     // Gallery test IDs
      '[role="img"] img',                                 // Semantic role="img"
      
      // PRIORITY 0.6: Tira Beauty Vue/React SPA patterns (srcset-based)
      'img[slot="image"]',                                // Vue slot-based images (Tira Beauty)
      'img[slot="image"][srcset]',                        // Slot with srcset
      'img[slot="image"][src]',                           // Slot with src fallback
      'img.load-image[srcset]',                           // Tira's load-image class
      '.pic-loader img',                                  // Tira's pic-loader wrapper
      '[data-v-] img[srcset]',                            // Any Vue component with srcset
      'img[srcset^="https://cdn.tirabeauty.com"]',        // Direct Tira CDN match
      'picture img[srcset]',                              // Modern <picture> elements (Tira)
      
      // PRIORITY 0.7: Generic CDN patterns (broad e-commerce fallback)
      'img[srcset*="cdn."]',                              // Any CDN in srcset (prioritizes srcset)
      'img[src*="cdn."][srcset*="cdn."]',                 // CDN in both attributes (stricter)
      'img[src*="/products/"][srcset]',                   // Product paths
      'img[src*="/items/"][srcset]',                      // Item paths (Asian e-commerce)
      
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

    // ===== ✅ REFINEMENT 3: UNIVERSAL FALLBACK SELECTORS (TRIGGER ONLY IF MAIN LAYERS FAIL) =====
    const universalFallbackSelectors = [
      // WooCommerce
      'img.wp-post-image',
      '.woocommerce-product-gallery__image img',
      
      // Generic structural hints
      'main img[src*="/product"]',
      'main img[src*="/media"]',
      '[role="main"] img[src*="/images"]',
      
      // Semantic product markup
      'img[itemprop="image"]',
      '[itemprop="image"] img',
      'figure.product img',
      
      // Generic product containers
      '.product img[src*="cdn"]',
      '.item-image img',
      'img[data-zoom]',
      
      // Flipkart/Myntra patterns
      'img[src*="rukmini"]',
      'img[src*="flixcart"]',
      'img[src*="assets.myntassets"]',
      
      // Generic CDN patterns
      'img[src*="cdn."][alt*="product"]',
      'img[src*="images."][alt*="product"]',
      'img[src*="digitaloceanspaces"]',
      
      // Generic e-commerce patterns
      'a img[src*="/product/"]',
      'a img[src*="/p/"]'
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
        console.log(`  - Sample img[${idx}]:`);
        console.log(`      src="${img.getAttribute('src')?.slice(0, 80)}"`);
        console.log(`      data-src="${img.getAttribute('data-src')?.slice(0, 80)}"`);
        console.log(`      srcset="${img.getAttribute('srcset')?.slice(0, 80)}"`);
        console.log(`      class="${img.className}"`);
        console.log(`      slot="${img.getAttribute('slot')}"`);
      });
    }

    for (let i = 0; i < gallerySelectors.length; i++) {
      const selector = gallerySelectors[i];
      const priority = i; // Lower index = higher priority
      
      // Scope selector to product container if found
      const scopedSelector = productContainer 
        ? productContainer.querySelectorAll(selector)
        : doc.querySelectorAll(selector);
      
      if (scopedSelector.length > 0) {
        if (DEBUG) {
          console.log(`Checking selector [${i}]: ${selector} (${scopedSelector.length} matches)`);
        }
      } else {
        // ⬅️ NEW: Log selectors that didn't match (only for Vue/Tira selectors)
        if (DEBUG && i >= 10 && i <= 20) { // Only log Priority 0.6-0.7 selectors
          console.log(`⚠️ Selector [${i}] found 0 matches: ${selector}`);
        }
      }
      
      if (scopedSelector.length > 0) {
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
        
        // Special handling for specific e-commerce sites
        const isTira = url.includes('tirabeauty.com');
        const isNykaa = url.includes('nykaa.com');
        const srcAttr = img.getAttribute('src');
        const srcsetAttr = img.getAttribute('srcset');

        let src: string | undefined;

        if (isTira && srcAttr) {
          // For Tira, prefer src (contains the active/high-res image)
          src = srcAttr;
          
          // If srcset exists and src contains resize-w:, try to get 2x version from srcset
          if (srcsetAttr && srcAttr.includes('resize-w:')) {
            // Extract 2x URL from srcset (format: "url 1x, url 2x")
            const srcsetParts = srcsetAttr.split(',').map(s => s.trim());
            const highRes = srcsetParts.find(part => part.includes(' 2x'));
            if (highRes) {
              src = highRes.split(' ')[0]; // Get URL before the "2x" descriptor
            }
          }
        } else if (isNykaa) {
          // For Nykaa, prioritize src first (Nykaa uses simple <img src> tags)
          src = img.getAttribute('src') ||
                img.getAttribute('data-src') ||
                img.getAttribute('data-lazy-src') ||
                img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0];
        } else {
          // Standard extraction for other sites (data-src first for lazy loading)
          src = img.getAttribute('data-src') ||
                img.getAttribute('data-lazy-src') ||
                img.getAttribute('data-image') ||
                img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                img.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                img.getAttribute('src');
        }
        
        if (!src) return;
        
        // Filter out loader/spinner/placeholder images
        const loaderPatterns = [
          '/loader',
          '/spinner',
          '/loading',
          '/placeholder',
          '/assets/loader',
          '/theme/assets/loader'
        ];

        const isLoader = loaderPatterns.some(pattern => 
          src.toLowerCase().includes(pattern)
        );

        if (isLoader) {
          if (DEBUG) console.log(`⏭️ Skipping loader/spinner: ${src}`);
          return;
        }
        
        // Normalize URL for better quality (Shopify/e-commerce CDNs)
        const normalizedSrc = normalizeImageUrl(src);
        
        const filename = getImageFilename(normalizedSrc);
        const dedupKey = buildImageDedupKey(normalizedSrc, filename);  // ✅ Use shared helper
        
        if (!seenFilenames.has(dedupKey)) {
          seenFilenames.add(dedupKey);
          collectedGalleryImages.set(normalizedSrc, { url: normalizedSrc, source: selector, priority });
          if (DEBUG) console.log(`✅ Gallery image added: ${dedupKey.slice(-60)}`);
        } else if (DEBUG) {
          console.log(`⏭️ Skipping duplicate: ${dedupKey.slice(-60)}`);
        }
        });
      }
      
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
          
          // Prioritize data-* attributes over src (for lazy-loaded images)
          let src = img.getAttribute('data-src') ||
                       img.getAttribute('data-lazy-src') ||
                       img.getAttribute('data-image') ||
                       img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                       img.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                       img.getAttribute('src');  // src is now LAST (fallback only)
          
          if (!src) return;
          
          // Normalize URL for better quality (Shopify/e-commerce CDNs)
          const normalizedSrc = normalizeImageUrl(src);
          
          const filename = getImageFilename(normalizedSrc);
          
          // Use proxy-aware deduplication (same as primary gallery loop)
          try {
            const dedupKey = buildImageDedupKey(normalizedSrc, filename);
            if (!seenFilenames.has(dedupKey)) {
              seenFilenames.add(dedupKey);
              collectedGalleryImages.set(normalizedSrc, { url: normalizedSrc, source: `${selector} (full doc)`, priority: i });
              if (DEBUG) console.log(`✅ Full doc image added: ${dedupKey.slice(-60)}`);
            } else if (DEBUG) {
              console.log(`⏭️ Skipping duplicate (full doc): ${dedupKey.slice(-60)}`);
            }
          } catch {
            // Fallback to simple filename check if buildImageDedupKey throws
            if (!seenFilenames.has(filename)) {
              seenFilenames.add(filename);
              collectedGalleryImages.set(normalizedSrc, { url: normalizedSrc, source: `${selector} (full doc)`, priority: i });
            }
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

layer2Count = imageCollection.length - layer1Count;
console.log(`🖼️ Layer 2 found: ${layer2Count} images`);

// ===== LAYER 3: SIZE-AWARE MAIN CONTENT SWEEP (FALLBACK) =====
if (imageCollection.length === 0) {
  console.log('📦 Layer 3: No images found, sweeping main content...');
  
  try {
    // Find main content area
    const mainContent = doc.querySelector('main') || 
                        doc.querySelector('[role="main"]') || 
                        doc.querySelector('body');
    
    if (mainContent) {
      // Find all images in main content
      const allImages = mainContent.querySelectorAll('img, source, picture');
      
      let scannedCount = 0;
      let acceptedCount = 0;
      
      allImages.forEach(img => {
        try {
          scannedCount++;
          
          // Skip header/footer/ads
          const ancestor = img.closest('header, footer, nav, aside, .ad, .advertisement, [class*="advertisement"]');
          if (ancestor) return;
          
          let imgUrl: string | null = null;
          const tagName = img.tagName?.toLowerCase();
          
          // Extract URL based on element type (Deno-compatible, no instanceof)
          if (tagName === 'img') {
            // Try various attributes where images might be stored
            imgUrl = img.getAttribute('src') || 
                     img.getAttribute('data-src') || 
                     img.getAttribute('data-lazy-src') ||
                     img.getAttribute('data-image') ||
                     img.getAttribute('data-original');
            
            // Check srcset if no src found
            if (!imgUrl) {
              const srcset = img.getAttribute('srcset');
              if (srcset) {
                imgUrl = srcset.split(',')[0].trim().split(' ')[0];
              }
            }
          } else if (tagName === 'source') {
            imgUrl = img.getAttribute('srcset')?.split(' ')[0] || img.getAttribute('src');
          } else if (tagName === 'picture') {
            // For picture elements, look for source or img children
            const sourceEl = img.querySelector('source');
            const imgEl = img.querySelector('img');
            if (sourceEl) {
              imgUrl = sourceEl.getAttribute('srcset')?.split(' ')[0] || sourceEl.getAttribute('src');
            } else if (imgEl) {
              imgUrl = imgEl.getAttribute('src');
            }
          } else {
            // Generic fallback for other elements
            imgUrl = img.getAttribute('src') || img.getAttribute('srcset')?.split(' ')[0];
          }
          
          if (imgUrl) {
            const normalizedUrl = normalizeImageUrl(imgUrl);
            const sizeInfo = extractImageSizeHint(normalizedUrl);
            
            // Only add images with reasonable size hints
            if (sizeInfo.maxDimension >= 400 || sizeInfo.maxDimension === 0) {
              const altText = img.getAttribute('alt') || '';
              const added = addImage(normalizedUrl, 'Main Content', altText);
              if (added) {
                acceptedCount++;
                console.log(`  ✅ Added main content image: ${normalizedUrl.substring(0, 80)}...`);
              }
            }
          }
        } catch (imgError) {
          console.error(`⚠️ Error processing image in Layer 3:`, imgError);
          // Continue with next image
        }
      });
      
      console.log(`📦 Layer 3 complete: Scanned ${scannedCount}, accepted ${acceptedCount} images`);
    }
  } catch (layer3Error) {
    console.error(`❌ Layer 3 main content sweep failed:`, layer3Error);
    console.log(`⚠️ Continuing with images from other layers`);
  }
}

// Product keyword filtering removed - trust gallery selectors instead

const highConfidenceImages = layer1Count + layer2Count;

// ===== ✅ REFINEMENT 3: UNIVERSAL FALLBACK SELECTORS (ONLY IF COLLECTION IS EMPTY) =====
if (imageCollection.length === 0) {
  console.log('🔄 Layer 2.5: Running universal fallback selectors...');
  
  universalFallbackSelectors.forEach(selector => {
    const images = doc.querySelectorAll(selector);
    images.forEach(img => {
      const src = img.getAttribute('data-src') ||
                  img.getAttribute('src') ||
                  img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0];
      const altText = img.getAttribute('alt') || '';
      
      if (src) {
        addImage(normalizeImageUrl(src), 'Universal fallback', altText);
      }
    });
  });
  
  console.log(`🔄 Universal fallback found: ${imageCollection.length} images`);
}

// ===== PHASE 2: DECISION POINT - Should we continue to fallback layers? =====
let shouldContinueToFallbacks = true;

if (isEcommercePage && highConfidenceImages >= MIN_PRODUCT_GALLERY_IMAGES) {
  console.log(`✅ E-commerce page with ${highConfidenceImages} gallery images found - skipping fallback layers`);
  shouldContinueToFallbacks = false;
}

// ===== LAYER 3: OPEN GRAPH IMAGES (FALLBACK) =====
// Only if we have fewer than 3 images so far AND we should continue
if (shouldContinueToFallbacks && imageCollection.length < 3) {
      console.log('🌐 Layer 3: Checking Open Graph images...');
      const ogImages = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"]');
      ogImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Open Graph');
      });
    }

// ===== LAYER 4: TWITTER CARD IMAGES (FALLBACK) =====
if (shouldContinueToFallbacks && imageCollection.length < 3) {
      console.log('🐦 Layer 4: Checking Twitter card images...');
      const twitterImages = doc.querySelectorAll('meta[name="twitter:image"], meta[property="twitter:image"]');
      twitterImages.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) addImage(content, 'Twitter Card');
      });
    }

// Layer 5 body scan removed - prevents noise from unrelated product images

    // ===== COLLAPSE DUPLICATES BY CANONICAL KEY (KEEP LARGEST) =====
    console.log(`🔍 Collapsing ${imageCollection.length} images by canonical key...`);

    const canonicalMap = new Map<string, typeof imageCollection[0]>();

    imageCollection.forEach(item => {
      const existing = canonicalMap.get(item.canonicalKey);
      
      if (!existing) {
        // First time seeing this canonical image
        canonicalMap.set(item.canonicalKey, item);
        if (DEBUG) console.log(`🆕 Canonical: ${item.canonicalKey.slice(-40)} (${item.sizeHint}px)`);
      } else {
        // Duplicate found - keep the larger one
        if (item.sizeHint > existing.sizeHint) {
          if (DEBUG) {
            console.log(`🔄 Replacing: ${existing.canonicalKey.slice(-40)} ${existing.sizeHint}px → ${item.sizeHint}px`);
          }
          canonicalMap.set(item.canonicalKey, item);
        } else {
          if (DEBUG) {
            console.log(`⏭️ Keeping existing: ${existing.canonicalKey.slice(-40)} ${existing.sizeHint}px (skipping ${item.sizeHint}px)`);
          }
        }
      }
    });

    // Replace imageCollection with collapsed results
    imageCollection.length = 0;
    imageCollection.push(...Array.from(canonicalMap.values()));

    console.log(`✅ Collapsed to ${imageCollection.length} unique images`);

    // ===== SORT BY PRIORITY AND EXTRACT TOP 7 IMAGES =====
    console.log(`📊 Sorting ${imageCollection.length} images by priority...`);
    
    // Sort by priority (highest first)
    imageCollection.sort((a, b) => b.priority - a.priority);
    
    // Take top 7
    const topImages = imageCollection.slice(0, 7);
    
    console.log(`📊 Final ranking (top ${topImages.length} of ${imageCollection.length}):`);
    topImages.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [P${item.priority}] ${item.source}: ${item.url.slice(-60)}`);
    });
    
    // Extract URLs for normalization
    const imageUrls = topImages.map(item => item.url);

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
      // Clear partialExtraction flag if we successfully extracted images
      partialExtraction: normalizedImages.length === 0,
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
    
    // NEW: Check for multiple SPA markers
    const spaMarkers = [
      '__NEXT_DATA__',      // Next.js
      'window.__NUXT__',    // Nuxt.js
      'data-reactroot',     // React
      'data-hydration',     // Various frameworks
      'ng-version',         // Angular
      'v-cloak',            // Vue.js
      'swiper-slide',       // Swiper galleries
      'product-thumbs-wrapper'
    ];
    
    const hasSpaMarkers = spaMarkers.some(marker => html.includes(marker));
    const extractedImageCount = normalizedImages.length;
    
    // Retry if:
    // 1. First attempt (stage === 0)
    // 2. SPA markers detected OR very few images found
    // 3. It's an e-commerce page
    const shouldRetryWithJs = (
      stage === 0 && 
      extractedImageCount < 3 && 
      isEcommercePage &&
      hasSpaMarkers
    );
    
    if (shouldRetryWithJs) {
      const trigger = hasSpaMarkers ? 'SPA markers detected' : 'Low image count';
      console.warn(`⚠️ ${trigger}: Only ${extractedImageCount} images from e-commerce page`);
      console.log(`🔄 Retrying with JS render... (Trigger: ${trigger})`);
      
      try {
        return await extractMetadata(url, 1, true);
      } catch (retryError) {
        console.error(`❌ JS render retry failed:`, retryError);
        console.log(`⚠️ Using partial results (${extractedImageCount} images)`);
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
