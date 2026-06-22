import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidPageImageUrl } from './image_validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LogoSource =
  | 'google_site_scoped'
  | 'google_broad'
  | 'page_owned_og'
  | 'page_owned_apple_touch_icon'
  | 'page_owned_favicon'
  | 'none';

// Domain configuration for filtering search results
const DOMAIN_CONFIG = {
  // Major marketplaces
  MAJOR_MARKETPLACES: [
    'amazon', 'ebay', 'alibaba', 'aliexpress', 'walmart', 'target',
    'shopify', 'etsy', 'wish', 'temu', 'shein'
  ],
  
  // Beauty-specific retailers
  BEAUTY_RETAILERS: [
    'sephora', 'ulta', 'beautybarn', 'nykaa', 'purplle', 
    'oliveyoung', 'yesstyle', 'stylevana', 'maccaron', 'beautytap',
    'cultbeauty', 'lookfantastic', 'spacenk'
  ],
  
  // Social media
  SOCIAL_MEDIA: [
    'facebook', 'instagram', 'twitter', 'linkedin', 'tiktok',
    'youtube', 'pinterest', 'reddit'
  ],
  
  // Review/aggregator sites
  REVIEW_SITES: [
    'trustpilot', 'yelp', 'google', 'reddit', 'quora', 'wikipedia'
  ],
  
  // CDN patterns (light penalty - tiebreaker)
  CDN_PATTERNS: [
    'cdn-image', 'cloudinary', 'imgix', 'fastly'
  ],
  
  // Product image indicators (light penalty - tiebreaker)
  PRODUCT_INDICATORS: [
    '/product-', '/item-', 'prdtimg', '/pd/', '/products/'
  ]
};

// Helper to check if URL matches any exclusion pattern
function matchesExclusion(url: string, categories: string[][]): boolean {
  const urlLower = url.toLowerCase();
  return categories.some(list => 
    list.some(pattern => urlLower.includes(pattern))
  );
}

// Safe URL parsing helper
function safeGetHostname(urlString: string): string | null {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName } = await req.json();

    if (!brandName) {
      throw new Error('Brand name is required');
    }

    console.log(`🔍 Starting brand enrichment for: "${brandName}"`);

  const googleApiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
  const googleCxId = Deno.env.get('GOOGLE_CUSTOM_SEARCH_CX');

    if (!googleApiKey || !googleCxId) {
      console.warn('⚠️ Google API credentials missing, skipping enrichment');
      return new Response(
        JSON.stringify({
          logo: null,
          website: null,
          description: null,
          enriched: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Find official website
    console.log(`🌐 Searching for official website...`);
    const officialWebsite = await findOfficialWebsite(brandName, googleApiKey, googleCxId);
    console.log(`   → Website: ${officialWebsite || 'not found'}`);

    // Step 2: Search for brand logo
    console.log(`🖼️  Searching for brand logo...`);
    const googleLogoResult = await searchBrandLogo(brandName, officialWebsite, googleApiKey, googleCxId);
    let brandLogo: string | null = googleLogoResult.url;
    let logoSource: LogoSource = googleLogoResult.source;
    let pageOwnedLogoCandidateCount = 0;
    let pageOwnedLogoUsedAsFallback = false;
    console.log(`   → Google logo: ${brandLogo || 'not found'} (source=${logoSource})`);

    // Step 2b: Phase 1.8c.6-B — page-owned official-site fallback.
    // Runs ONLY when Google produced no acceptable candidate (score ≤ 0 or empty).
    // No score bump, never competes with a valid Google result.
    if (!brandLogo && officialWebsite) {
      console.log(`   ↪️ Google failed, trying page-owned official-site fallback...`);
      const officialHtml = await fetchOfficialSiteHtml(officialWebsite);
      if (officialHtml) {
        const candidates = extractBrandPageOwnedCandidates(officialHtml, officialWebsite);
        pageOwnedLogoCandidateCount = candidates.length;
        for (const cand of candidates) {
          if (isValidPageImageUrl(cand.url)) {
            brandLogo = cand.url;
            logoSource = cand.source;
            pageOwnedLogoUsedAsFallback = true;
            console.log(`   ✅ Page-owned fallback logo accepted (source=${logoSource})`);
            break;
          }
        }
        if (!pageOwnedLogoUsedAsFallback) {
          console.log(`   ❌ No valid page-owned fallback (candidates=${pageOwnedLogoCandidateCount})`);
        }
      } else {
        console.log(`   ❌ Could not fetch official site HTML for fallback`);
      }
    }

    if (!brandLogo) logoSource = 'none';

    // Step 3: Get brand description (smart cascade)
    console.log(`📝 Getting brand description...`);
    let description: string | null = null;
    let descriptionSource = 'none';

    if (officialWebsite) {
      // Try scraping website first
      const scrapedDescription = await scrapeDescription(officialWebsite, brandName);
      
      if (scrapedDescription && !isProductDescription(scrapedDescription)) {
        // Scraped description is good (brand-focused)
        description = scrapedDescription;
        descriptionSource = 'scraped';
        console.log(`   ✅ Using scraped description (brand-focused)`);
      } else if (scrapedDescription) {
        // Scraped description exists but is product-focused
        console.log(`   ⚠️ Scraped description is product-focused, trying AI...`);
        descriptionSource = 'scraped_rejected';
        
        // Try AI synthesis
        const aiDescription = await synthesizeBrandDescription(brandName, officialWebsite);
        if (aiDescription) {
          description = aiDescription;
          descriptionSource = 'ai_synthesized';
        }
      } else {
        // Scraping failed completely
        console.log(`   ⚠️ Scraping failed, trying AI...`);
        const aiDescription = await synthesizeBrandDescription(brandName, officialWebsite);
        if (aiDescription) {
          description = aiDescription;
          descriptionSource = 'ai_synthesized';
        }
      }
    }

    // Final fallback if all methods failed
    if (!description) {
      description = 'no description';
      descriptionSource = 'fallback';
      console.log(`   ℹ️ Using fallback: "no description"`);
    }

    console.log(`   → Description: ${description.substring(0, 50)}... (source: ${descriptionSource})`);

    const enrichmentResult = {
      logo: brandLogo,
      website: officialWebsite,
      description: description,
      descriptionSource: descriptionSource,
      // Phase 1.8c.6-B telemetry — no raw URLs leaked.
      logoSource,
      pageOwnedLogoCandidateCount,
      pageOwnedLogoUsedAsFallback,
      enriched: !!(brandLogo || officialWebsite || description)
    };

    console.log(`✅ Brand enrichment complete (logoSource=${logoSource}, fallbackUsed=${pageOwnedLogoUsedAsFallback})`);


    return new Response(
      JSON.stringify(enrichmentResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Brand enrichment error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        logo: null,
        website: null,
        description: null,
        enriched: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Score website search result quality
function scoreWebsiteResult(item: any, brandName: string): number {
  // Guard against missing data
  if (!item || !item.link || typeof item.link !== 'string') {
    return -100;
  }
  
  try {
    let score = 0;
    const link = item.link.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Get domain safely
    const domain = safeGetHostname(item.link);
    if (!domain) return -100;
    
    // +10: Domain contains exact brand name
    if (domain.includes(brandLower)) score += 10;
    
    // +15: Domain is very similar to brand name (e.g., "yogabar" matches "yogabars.in")
    const domainBase = domain.split('.')[0]; // Extract "yogabars" from "yogabars.in"
    const brandSimplified = brandLower.replace(/\s+/g, ''); // "yogabar"
    if (domainBase === brandSimplified || 
        domainBase === brandSimplified + 's' || 
        brandSimplified === domainBase + 's') {
      score += 15;
    }
    
    // +5: Title contains "official" or "brand"
    if (title.includes('official') || title.includes('brand')) score += 5;
    
    // +3: Title contains brand name
    if (title.includes(brandLower)) score += 3;
    
    // -15: Design agencies and portfolio sites
    const agencyPatterns = [
      '/work/', '/portfolio/', '/case-study/', '/projects/',
      'behance', 'dribbble', 'agency', 'studio', 'design'
    ];
    if (agencyPatterns.some(pattern => link.includes(pattern))) {
      score -= 15;
    }
    
    // -20: Aggregator/hosting platform domains
    if (matchesExclusion(link, [
      'lovable.me', 'vercel.app', 'netlify.app', 'github.io',
      'herokuapp.com', 'replit.dev', 'glitch.me', 'cloudflare.pages.dev',
      'surge.sh', 'render.com', 'railway.app'
    ])) {
      score -= 20;
    }
    
    // -20: Known marketplace/retailer domains
    if (matchesExclusion(link, [
      DOMAIN_CONFIG.MAJOR_MARKETPLACES,
      DOMAIN_CONFIG.BEAUTY_RETAILERS
    ])) score -= 20;
    
    // -10: Social media or review sites
    if (matchesExclusion(link, [
      DOMAIN_CONFIG.SOCIAL_MEDIA,
      DOMAIN_CONFIG.REVIEW_SITES
    ])) score -= 10;
    
    return score;
  } catch (error) {
    console.warn(`⚠️ Error scoring website result: ${item.link}`, error);
    return -100;
  }
}

// Find official brand website using Google Custom Search
async function findOfficialWebsite(brandName: string, apiKey: string, cxId: string): Promise<string | null> {
  try {
    // Enhanced search query with exclusions
    const searchQuery = `${brandName} brand official website -amazon -ebay -alibaba`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&num=5`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Google Search API failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Score all results and sort by score
    const scoredResults = data.items
      .map((item: any) => ({
        url: item.link,
        score: scoreWebsiteResult(item, brandName)
      }))
      .sort((a: any, b: any) => b.score - a.score);

    console.log(`   Scored ${scoredResults.length} results, best score: ${scoredResults[0]?.score}`);

    // GUARDRAIL: Only accept if score >= 10 (prevents portfolio/aggregator sites)
    if (scoredResults[0]?.score >= 10) {
      return scoredResults[0].url;
    }
    
    console.log(`   ❌ No website met quality threshold (best: ${scoredResults[0]?.score})`);
    return null;
  } catch (error) {
    console.error('Website search error:', error);
    return null;
  }
}

// Score logo image quality with graduated penalties
function scoreLogoImage(item: any, brandName: string): number {
  if (!item || !item.link || typeof item.link !== 'string') {
    return -100;
  }
  
  try {
    let score = 0;
    const link = item.link.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // === POSITIVE SIGNALS (Strong) ===
    // +15: URL contains "logo" (increased for stronger signal)
    if (link.includes('logo')) score += 15;
    
    // +8: PNG or SVG (increased - high-quality formats)
    if (link.includes('.png') || link.includes('.svg')) score += 8;
    
    // +5: Title contains "logo" or "brand"
    if (title.includes('logo') || title.includes('brand')) score += 5;
    
    // +3: Title contains brand name
    if (title.includes(brandLower)) score += 3;
    
    // === NEW: SOCIAL MEDIA BONUS FOR LOGOS ===
    // +5: LinkedIn, Instagram (official brand assets)
    if (link.includes('linkedin.com') || link.includes('instagram.com')) {
      score += 5;
      console.log(`   📱 Social media logo bonus: +5 for ${link.includes('linkedin.com') ? 'LinkedIn' : 'Instagram'}`);
    }
    
    // === NEGATIVE SIGNALS (Graduated) ===
    
    // -2: Generic CDN patterns (light penalty - tiebreaker only)
    if (DOMAIN_CONFIG.CDN_PATTERNS.some(p => link.includes(p))) {
      score -= 2;
    }
    
    // -3: Product indicators (light penalty unless it says "logo")
    if (DOMAIN_CONFIG.PRODUCT_INDICATORS.some(p => link.includes(p)) && 
        !link.includes('logo')) {
      score -= 3;
    }
    
    // -20: Known retailer/marketplace (heavy penalty - disqualifier)
    if (matchesExclusion(link, [
      DOMAIN_CONFIG.MAJOR_MARKETPLACES,
      DOMAIN_CONFIG.BEAUTY_RETAILERS
    ])) {
      score -= 20;
    }
    
    return score;
  } catch (error) {
    console.warn(`⚠️ Error scoring logo image: ${item.link}`, error);
    return -100;
  }
}

// Helper: Perform a single Google Image search query
async function performImageSearch(
  query: string,
  apiKey: string,
  cxId: string
): Promise<any[]> {
  try {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}&searchType=image&num=5`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`   ⚠️ Image search failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.warn(`   ⚠️ Image search error:`, error);
    return [];
  }
}

// Search for brand logo using two-phase approach with fallback.
// Returns { url, source } so the handler can emit logoSource telemetry and
// decide whether to try the Phase 1.8c.6-B page-owned fallback.
async function searchBrandLogo(
  brandName: string,
  officialWebsite: string | null,
  apiKey: string,
  cxId: string
): Promise<{ url: string | null; source: LogoSource }> {
  try {
    const allResults: any[] = [];
    const seenUrls = new Set<string>(); // Deduplication tracker
    const officialHostname = officialWebsite ? safeGetHostname(officialWebsite) : null;
    
    // PHASE 1: Search official website (if available)
    if (officialWebsite) {
      const hostname = officialHostname;
      if (hostname) {
        console.log(`   🔍 Phase 1: Searching official site (${hostname})...`);
        const siteQuery = `"${brandName}" logo site:${hostname}`;
        const siteResults = await performImageSearch(siteQuery, apiKey, cxId);
        
        // Add unique results
        for (const item of siteResults) {
          if (item.link && !seenUrls.has(item.link)) {
            seenUrls.add(item.link);
            allResults.push(item);
          }
        }
        
        // Score the site results to determine if we need Phase 2
        const bestSiteScore = siteResults.length > 0
          ? Math.max(...siteResults.map(item => scoreLogoImage(item, brandName)))
          : -100;
        
        console.log(`   → Found ${siteResults.length} site images, best score: ${bestSiteScore}`);
        
        // PHASE 2: Broader search if site results are poor (threshold: 15)
        if (bestSiteScore < 15) {
          console.log(`   🔍 Phase 2: Site results weak, searching broader sources...`);
          const broaderQuery = `"${brandName}" official brand logo -site:${hostname} -product -buy -shop`;
          const broaderResults = await performImageSearch(broaderQuery, apiKey, cxId);
          
          // Add unique results from broader search
          let addedCount = 0;
          for (const item of broaderResults) {
            if (item.link && !seenUrls.has(item.link)) {
              seenUrls.add(item.link);
              allResults.push(item);
              addedCount++;
            }
          }
          
          console.log(`   → Added ${addedCount} unique images from broader search`);
        } else {
          console.log(`   ✅ Site results good enough, skipping Phase 2`);
        }
      }
    } else {
      // No official website - do broad search only
      console.log(`   🔍 No official website, searching broadly...`);
      const broadQuery = `"${brandName}" official brand logo transparent png -product -buy -shop`;
      const broadResults = await performImageSearch(broadQuery, apiKey, cxId);
      
      for (const item of broadResults) {
        if (item.link && !seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          allResults.push(item);
        }
      }
    }
    
    if (allResults.length === 0) {
      console.log(`   ❌ No logo images found`);
      return { url: null, source: 'none' };
    }
    
    // Score and rank ALL deduplicated results from both phases
    const scoredImages = allResults
      .map((item: any) => ({
        url: item.link,
        score: scoreLogoImage(item, brandName)
      }))
      .sort((a, b) => b.score - a.score);
    
    console.log(`   📊 Scored ${scoredImages.length} unique images:`);
    scoredImages.slice(0, 3).forEach((img, i) => {
      const domain = safeGetHostname(img.url);
      console.log(`      ${i + 1}. Score ${img.score}: ${domain}`);
    });
    
    const bestLogo = scoredImages[0];
    
    // GUARDRAIL: Only accept if score > 0 (prevents low-quality images)
    if (bestLogo && bestLogo.score > 0) {
      console.log(`   ✅ Selected logo with score: ${bestLogo.score}`);
      const winnerHost = safeGetHostname(bestLogo.url);
      const source: LogoSource = (officialHostname && winnerHost === officialHostname)
        ? 'google_site_scoped'
        : 'google_broad';
      return { url: bestLogo.url, source };
    }
    
    console.log(`   ❌ No logo met quality threshold (best: ${bestLogo?.score})`);
    return { url: null, source: 'none' };
  } catch (error) {
    console.error('❌ Logo search error:', error);
    return { url: null, source: 'none' };
  }
}

// Scrape website description
async function scrapeDescription(websiteUrl: string, brandName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for scraping
    
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch website: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Try extracting from meta tags
    const ogDescription = extractMetaTag(html, 'og:description');
    if (ogDescription && ogDescription.length > 20) {
      return ogDescription;
    }

    const metaDescription = extractMetaTag(html, 'description');
    if (metaDescription && metaDescription.length > 20) {
      return metaDescription;
    }

    // Try extracting from about section
    const aboutDescription = extractAboutSection(html);
    if (aboutDescription && aboutDescription.length > 20) {
      return aboutDescription;
    }

    // Return null if scraping failed
    return null;
  } catch (error) {
    console.error('Scraping error:', error);
    return null;
  }
}

// Detect if description is product/e-commerce focused or CMS placeholder
function isProductDescription(text: string): boolean {
  if (!text || text.length < 20) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for CMS placeholder patterns FIRST (high priority)
  const cmsPlaceholders = [
    'add a description',
    'add description',
    'default description',
    'enter description',
    'lorem ipsum',
    'placeholder text',
    'see how this collection',
    'example text',
    'sample description'
  ];
  
  for (const placeholder of cmsPlaceholders) {
    if (lowerText.includes(placeholder)) {
      console.log(`   ⚠️ Detected CMS placeholder: "${placeholder}"`);
      return true; // Treat as invalid
    }
  }
  
  // Check for product/e-commerce keywords
  const productKeywords = [
    'buy', 'shop', 'cart', 'add to', 'price', '₹', '$', '€', '£',
    'in stock', 'out of stock', 'free shipping', 'delivery',
    'craving for', 'try them today', 'order now', 'get yours',
    'limited time', 'sale', 'discount', 'available now'
  ];
  
  let matchCount = 0;
  for (const keyword of productKeywords) {
    if (lowerText.includes(keyword)) {
      matchCount++;
      if (matchCount >= 2) return true; // Early exit
    }
  }
  
  return false;
}

// Use AI to synthesize brand description from web search
async function synthesizeBrandDescription(
  brandName: string,
  websiteUrl: string | null
): Promise<string | null> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  
  if (!geminiApiKey) {
    console.log('   ⚠️ GEMINI_API_KEY not found, skipping AI synthesis');
    return null;
  }
  
  try {
    console.log(`   🤖 Using Gemini AI to synthesize brand description...`);
    
    const searchContext = websiteUrl 
      ? `The brand's official website is ${websiteUrl}.`
      : '';
    
    const prompt = `You are a brand research assistant. Find information about "${brandName}" and write a 2-3 sentence brand description (NOT product description).

${searchContext}

Focus on:
- Brand history/founding
- Brand mission or values
- What makes this brand unique
- Main product categories

Example GOOD output:
"Beauty of Joseon is a Korean skincare brand inspired by the beauty secrets of the Joseon Dynasty. The brand combines traditional Korean ingredients like ginseng and rice with modern skincare science."

Example BAD output (too product-focused):
"Buy Beauty of Joseon products! Try our bestselling serum today with free shipping!"

Write only the brand description, no additional commentary.`;

    // Use Google Gemini API directly (same as analyze-entity-url function)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`   ⚠️ Gemini AI synthesis failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const aiDescription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (aiDescription && aiDescription.length > 30 && !isProductDescription(aiDescription)) {
      console.log(`   ✅ AI-synthesized description (${aiDescription.length} chars)`);
      return aiDescription;
    }
    
    console.log(`   ⚠️ Gemini returned invalid/product description`);
    return null;
  } catch (error) {
    console.error('   ❌ AI synthesis error:', error);
    return null;
  }
}

// Extract meta tag content
function extractMetaTag(html: string, property: string): string | null {
  // Try property="..."
  let regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  let match = html.match(regex);
  
  if (match && match[1]) {
    return match[1].trim();
  }

  // Try name="..."
  regex = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  match = html.match(regex);
  
  if (match && match[1]) {
    return match[1].trim();
  }

  // Try reverse order
  regex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i');
  match = html.match(regex);
  
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

// Extract from about section
function extractAboutSection(html: string): string | null {
  // Look for common about section patterns
  const patterns = [
    /<section[^>]*about[^>]*>([\s\S]{50,500}?)<\/section>/i,
    /<div[^>]*about[^>]*>([\s\S]{50,500}?)<\/div>/i,
    /<p[^>]*about[^>]*>([\s\S]{50,500}?)<\/p>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      // Strip HTML tags and clean up
      const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) {
        return text.substring(0, 300);
      }
    }
  }

  return null;
}

// Phase 1.8c.6-B — bounded fetch of the official site HTML, used only when
// Google returned no acceptable logo. Silent on failure.
async function fetchOfficialSiteHtml(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// Phase 1.8c.6-B — extract page-owned brand asset candidates from official-site
// HTML in priority order: og:image → apple-touch-icon (any size) → <link rel="icon">
// with explicit sizes ≥ 128. Returns absolute URLs only (relative refs are resolved
// against the official site origin). No favicon.ico fallback — that's a site asset,
// not a brand mark.
function extractBrandPageOwnedCandidates(
  html: string,
  officialWebsite: string,
): Array<{ url: string; source: LogoSource }> {
  if (!html) return [];
  let origin = '';
  try {
    origin = new URL(officialWebsite).origin;
  } catch {
    return [];
  }
  const resolve = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return null;
    try {
      return new URL(v, origin).href;
    } catch {
      return null;
    }
  };
  const out: Array<{ url: string; source: LogoSource }> = [];

  const og = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og && og[1]) {
    const r = resolve(og[1]);
    if (r) out.push({ url: r, source: 'page_owned_og' });
  }

  const apple = html.match(/<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i);
  if (apple && apple[1]) {
    const r = resolve(apple[1]);
    if (r) out.push({ url: r, source: 'page_owned_apple_touch_icon' });
  }

  // <link rel="icon"> with explicit sizes ≥ 128. Scan all matches, accept the first.
  const iconTagRe = /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*>/gi;
  const tags = html.match(iconTagRe) || [];
  for (const tag of tags) {
    const sizesMatch = tag.match(/sizes=["']([^"']+)["']/i);
    if (!sizesMatch) continue;
    const sizes = sizesMatch[1].toLowerCase();
    // sizes like "192x192" or "128x128 256x256"
    let maxDim = 0;
    for (const tok of sizes.split(/\s+/)) {
      const m = tok.match(/^(\d+)x(\d+)$/);
      if (m) {
        const d = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
        if (d > maxDim) maxDim = d;
      }
    }
    if (maxDim < 128) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const r = resolve(hrefMatch[1]);
    if (r) {
      out.push({ url: r, source: 'page_owned_favicon' });
      break;
    }
  }

  return out;
}

