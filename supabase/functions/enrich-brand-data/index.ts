import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  
  // Image CDNs and product image patterns
  CDN_PATTERNS: [
    'cdn-image', 'cloudinary', 'imgix', 'fastly', 
    '/products/', '/prdtimg/', '/item/', '/product/'
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
    const brandLogo = await searchBrandLogo(brandName, officialWebsite, googleApiKey, googleCxId);
    console.log(`   → Logo: ${brandLogo || 'not found'}`);

    // Step 3: Scrape website for description
    console.log(`📝 Scraping website description...`);
    const description = officialWebsite 
      ? await scrapeDescription(officialWebsite, brandName)
      : null;
    console.log(`   → Description: ${description ? 'found' : 'not found'}`);

    const enrichmentResult = {
      logo: brandLogo,
      website: officialWebsite,
      description: description,
      enriched: !!(brandLogo || officialWebsite || description)
    };

    console.log(`✅ Brand enrichment complete:`, enrichmentResult);

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
    
    // +5: Title contains "official" or "brand"
    if (title.includes('official') || title.includes('brand')) score += 5;
    
    // +3: Title contains brand name
    if (title.includes(brandLower)) score += 3;
    
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

    // Only return if best score is positive
    return scoredResults[0]?.score > 0 ? scoredResults[0].url : null;
  } catch (error) {
    console.error('Website search error:', error);
    return null;
  }
}

// Score logo image quality
function scoreLogoImage(item: any, brandName: string): number {
  if (!item || !item.link || typeof item.link !== 'string') {
    return -100;
  }
  
  try {
    let score = 0;
    const link = item.link.toLowerCase();
    const title = (item.title || '').toLowerCase();
    
    // +10: URL contains "logo"
    if (link.includes('logo')) score += 10;
    
    // +5: PNG or SVG (better than JPG for logos)
    if (link.includes('.png') || link.includes('.svg')) score += 5;
    
    // +3: Title contains "logo" or "brand"
    if (title.includes('logo') || title.includes('brand')) score += 3;
    
    // -10: URL contains product indicators
    if (matchesExclusion(link, [DOMAIN_CONFIG.CDN_PATTERNS])) score -= 10;
    
    // -5: Generic CDN domains (often product images)
    const domain = safeGetHostname(item.link);
    if (domain && (domain.includes('cdn') || domain.includes('cloudinary'))) {
      score -= 5;
    }
    
    return score;
  } catch (error) {
    console.warn(`⚠️ Error scoring logo image: ${item.link}`, error);
    return -100;
  }
}

// Search for brand logo using Google Custom Search Image API
async function searchBrandLogo(brandName: string, officialWebsite: string | null, apiKey: string, cxId: string): Promise<string | null> {
  try {
    // Enhanced search query with specificity
    let searchQuery: string;
    if (officialWebsite) {
      const hostname = safeGetHostname(officialWebsite);
      searchQuery = hostname 
        ? `${brandName} brand logo transparent png site:${hostname}`
        : `${brandName} brand logo transparent png`;
    } else {
      searchQuery = `${brandName} official brand logo transparent png -product`;
    }
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=5`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Google Image Search API failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Score all images and sort by quality
    const scoredImages = data.items
      .map((item: any) => ({
        url: item.link,
        score: scoreLogoImage(item, brandName)
      }))
      .sort((a: any, b: any) => b.score - a.score);

    console.log(`   Scored ${scoredImages.length} images, best score: ${scoredImages[0]?.score}`);

    // Only return if best score is positive
    return scoredImages[0]?.score > 0 ? scoredImages[0].url : null;
  } catch (error) {
    console.error('Logo search error:', error);
    return null;
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

    // Fallback: generic but accurate description
    return `${brandName} is a beauty and skincare brand.`;
  } catch (error) {
    console.error('Scraping error:', error);
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
