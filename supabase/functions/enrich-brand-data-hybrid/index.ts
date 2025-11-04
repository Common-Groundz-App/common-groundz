import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOMAIN_CONFIG = {
  MAJOR_MARKETPLACES: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'tata', 'nykaa',
    'purplle', 'smytten', 'beautybarn', 'foxy', 'sephora'
  ],
  
  BEAUTY_RETAILERS: [
    'ulta', 'sephora', 'beautybay', 'lookfantastic', 'cultbeauty',
    'spacenk', 'boots', 'superdrug', 'feelunique'
  ],
  
  SOCIAL_MEDIA: [
    'facebook', 'instagram', 'twitter', 'linkedin', 'tiktok',
    'youtube', 'pinterest', 'reddit', 'tumblr', 'snapchat'
  ],
  
  REVIEW_SITES: [
    'trustpilot', 'yelp', 'google', 'reddit', 'quora', 'wikipedia'
  ],
  
  CDN_PATTERNS: [
    'cdn-image', 'cloudinary', 'imgix', 'fastly'
  ],
  
  PRODUCT_INDICATORS: [
    '/product-', '/item-', 'prdtimg', '/pd/', '/products/'
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName } = await req.json();

    if (!brandName) {
      return new Response(
        JSON.stringify({ error: 'Brand name is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleCx = Deno.env.get('GOOGLE_CX');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    console.log(`\n🔍 [HYBRID] Enriching brand: "${brandName}"`);
    console.log(`   API Keys: Google=${!!googleApiKey}, Lovable=${!!lovableApiKey}`);

    if (!googleApiKey || !googleCx) {
      return new Response(
        JSON.stringify({
          logoUrl: null,
          officialWebsite: null,
          description: `${brandName} is a beauty and skincare brand.`,
          enriched: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Phase 1: Deterministic enrichment (website + logo)
    const officialWebsite = await findOfficialWebsite(brandName, googleApiKey, googleCx);
    const logoUrl = await searchBrandLogo(brandName, officialWebsite, googleApiKey, googleCx);

    // Phase 2: Smart description (scrape + AI fallback)
    let description: string | null = null;
    let descriptionSource = 'fallback';

    if (officialWebsite) {
      const scrapedDescription = await scrapeDescription(officialWebsite, brandName);
      
      if (scrapedDescription && !isProductDescription(scrapedDescription)) {
        description = scrapedDescription;
        descriptionSource = 'scraped';
        console.log(`   ✅ Using scraped description (passed quality check)`);
      } else {
        console.log(`   ⚠️ Scraped description failed quality check`);
        
        // AI synthesis fallback
        if (lovableApiKey) {
          description = await synthesizeBrandDescription(brandName, officialWebsite, lovableApiKey);
          if (description) {
            descriptionSource = 'ai-synthesized';
          }
        }
      }
    }

    // Final fallback
    if (!description) {
      description = `${brandName} is a beauty and skincare brand.`;
      descriptionSource = 'fallback';
    }

    const enrichmentResult = {
      logoUrl: logoUrl || null,
      officialWebsite: officialWebsite || null,
      description: description,
      enriched: !!(officialWebsite || logoUrl),
      descriptionSource // For A/B testing analysis
    };

    console.log(`\n📊 [HYBRID] Result for "${brandName}":`);
    console.log(`   → Website: ${officialWebsite || 'not found'}`);
    console.log(`   → Logo: ${logoUrl || 'not found'}`);
    console.log(`   → Description: ${description.substring(0, 60)}...`);
    console.log(`   → Source: ${descriptionSource}`);

    return new Response(
      JSON.stringify(enrichmentResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to enrich brand data' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================================================
// PRODUCT DESCRIPTION DETECTOR
// ============================================================================

function isProductDescription(text: string): boolean {
  if (!text || text.length < 20) return false;
  
  const productKeywords = [
    'buy', 'shop', 'cart', 'add to', 'price', '₹', '$', '€', '£',
    'in stock', 'out of stock', 'free shipping', 'delivery',
    'craving for', 'try them today', 'order now', 'get yours',
    'limited time', 'sale', 'discount', 'available', 'check out',
    'add to bag', 'checkout'
  ];
  
  const lowerText = text.toLowerCase();
  let matchCount = 0;
  
  for (const keyword of productKeywords) {
    if (lowerText.includes(keyword)) {
      matchCount++;
      if (matchCount >= 2) return true; // Early exit
    }
  }
  
  return false;
}

// ============================================================================
// AI DESCRIPTION SYNTHESIS
// ============================================================================

async function synthesizeBrandDescription(
  brandName: string,
  websiteUrl: string,
  lovableApiKey: string
): Promise<string | null> {
  try {
    console.log(`   🤖 Using AI to synthesize brand description...`);
    
    const prompt = `You are a brand research assistant. Find information about the brand "${brandName}" whose official website is ${websiteUrl}.

Use Google Search to find:
1. Brand history and founding story
2. Brand mission or philosophy  
3. Key product categories
4. What makes this brand unique

Return ONLY a single paragraph (2-3 sentences) that describes the BRAND (not specific products).

Example good output:
"Beauty of Joseon is a Korean skincare brand inspired by the beauty secrets of the Joseon Dynasty. The brand combines traditional Korean ingredients like ginseng and rice with modern skincare science to create effective, gentle formulations."

Example bad output (too product-focused):
"Buy Beauty of Joseon products with free shipping. Try their bestselling serum today! Available now."

Your response:`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        tools: [{ type: 'google_search' }],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`   ⚠️ AI synthesis failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const aiDescription = data.choices?.[0]?.message?.content?.trim();
    
    if (aiDescription && aiDescription.length > 30 && !isProductDescription(aiDescription)) {
      console.log(`   ✅ AI-synthesized description (${aiDescription.length} chars)`);
      return aiDescription;
    }
    
    console.warn(`   ⚠️ AI response did not pass quality check`);
    return null;
  } catch (error) {
    console.error('   ❌ AI synthesis error:', error);
    return null;
  }
}

// ============================================================================
// DETERMINISTIC FUNCTIONS (unchanged from original)
// ============================================================================

function matchesExclusion(url: string, exclusionLists: string[][]): boolean {
  const lowerUrl = url.toLowerCase();
  return exclusionLists.some(list =>
    list.some(domain => lowerUrl.includes(domain))
  );
}

function safeGetHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function scoreWebsiteResult(item: any, brandName: string): number {
  if (!item || !item.link || typeof item.link !== 'string') {
    return -100;
  }

  try {
    let score = 0;
    const link = item.link.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Positive signals
    const domain = safeGetHostname(item.link);
    if (domain && domain.includes(brandLower)) score += 15;
    if (title.includes(brandLower)) score += 10;
    if (snippet.includes('official') || title.includes('official')) score += 8;
    if (link.endsWith('/') || link.endsWith('.com') || link.endsWith('.in')) score += 5;

    // Negative signals
    if (matchesExclusion(link, [
      DOMAIN_CONFIG.MAJOR_MARKETPLACES,
      DOMAIN_CONFIG.BEAUTY_RETAILERS
    ])) score -= 20;
    
    if (matchesExclusion(link, [DOMAIN_CONFIG.SOCIAL_MEDIA])) score -= 10;
    if (matchesExclusion(link, [DOMAIN_CONFIG.REVIEW_SITES])) score -= 5;

    return score;
  } catch (error) {
    console.warn(`Error scoring website result: ${item.link}`, error);
    return -100;
  }
}

async function findOfficialWebsite(brandName: string, apiKey: string, cx: string): Promise<string | null> {
  try {
    const searchQuery = `${brandName} official website`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}&num=10`;

    console.log(`   Searching for official website...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Google API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.log(`   No results found`);
      return null;
    }

    const scoredResults = data.items
      .map((item: any) => ({
        url: item.link,
        score: scoreWebsiteResult(item, brandName)
      }))
      .sort((a: any, b: any) => b.score - a.score);

    console.log(`   Scored ${scoredResults.length} results, best score: ${scoredResults[0]?.score}`);

    return scoredResults[0]?.score > 0 ? scoredResults[0].url : null;
  } catch (error) {
    console.error('Website search error:', error);
    return null;
  }
}

function scoreLogoImage(item: any, brandName: string): number {
  if (!item || !item.link || typeof item.link !== 'string') {
    return -100;
  }

  try {
    let score = 0;
    const link = item.link.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Positive signals
    if (link.includes('logo')) score += 15;
    if (link.includes('.png') || link.includes('.svg')) score += 8;
    if (title.includes('logo') || title.includes('brand')) score += 5;
    if (title.includes(brandLower)) score += 3;

    // Negative signals (graduated)
    if (DOMAIN_CONFIG.CDN_PATTERNS.some(p => link.includes(p))) score -= 2;
    
    if (DOMAIN_CONFIG.PRODUCT_INDICATORS.some(p => link.includes(p)) && 
        !link.includes('logo')) {
      score -= 3;
    }
    
    if (matchesExclusion(link, [
      DOMAIN_CONFIG.MAJOR_MARKETPLACES,
      DOMAIN_CONFIG.BEAUTY_RETAILERS
    ])) score -= 20;

    return score;
  } catch (error) {
    console.warn(`Error scoring logo image: ${item.link}`, error);
    return -100;
  }
}

async function searchBrandLogo(brandName: string, officialWebsite: string | null, apiKey: string, cx: string): Promise<string | null> {
  try {
    let searchQuery: string;
    if (officialWebsite) {
      const hostname = safeGetHostname(officialWebsite);
      searchQuery = hostname 
        ? `"${brandName}" logo site:${hostname}`
        : `${brandName} brand logo transparent png`;
    } else {
      searchQuery = `${brandName} official brand logo transparent png -product`;
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=10&imgSize=medium`;

    console.log(`   Searching for brand logo...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Google Image API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.log(`   No logo results found`);
      return null;
    }

    const scoredImages = data.items
      .map((item: any) => ({
        url: item.link,
        score: scoreLogoImage(item, brandName)
      }))
      .sort((a: any, b: any) => b.score - a.score);

    console.log(`   Scored ${scoredImages.length} images, best score: ${scoredImages[0]?.score}`);

    return scoredImages[0]?.score >= -5 ? scoredImages[0].url : null;
  } catch (error) {
    console.error('Logo search error:', error);
    return null;
  }
}

async function scrapeDescription(websiteUrl: string, brandName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to fetch website: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    const ogDescription = extractMetaTag(html, 'og:description');
    if (ogDescription && ogDescription.length > 20) {
      return ogDescription;
    }

    const metaDescription = extractMetaTag(html, 'description');
    if (metaDescription && metaDescription.length > 20) {
      return metaDescription;
    }

    const aboutDescription = extractAboutSection(html);
    if (aboutDescription && aboutDescription.length > 20) {
      return aboutDescription;
    }

    return null;
  } catch (error) {
    console.error('Scraping error:', error);
    return null;
  }
}

function extractMetaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=[\\\"']${property}[\\\"'][^>]*content=[\\\"']([^\\\"']+)[\\\"']`, 'i'),
    new RegExp(`<meta[^>]*content=[\\\"']([^\\\"']+)[\\\"'][^>]*property=[\\\"']${property}[\\\"']`, 'i'),
    new RegExp(`<meta[^>]*name=[\\\"']${property}[\\\"'][^>]*content=[\\\"']([^\\\"']+)[\\\"']`, 'i'),
    new RegExp(`<meta[^>]*content=[\\\"']([^\\\"']+)[\\\"'][^>]*name=[\\\"']${property}[\\\"']`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractAboutSection(html: string): string | null {
  const aboutPatterns = [
    /<section[^>]*class=[\\\"'][^\\\"']*about[^\\\"']*[\\\"'][^>]*>([\\s\\S]{0,1000}?)<\/section>/i,
    /<div[^>]*class=[\\\"'][^\\\"']*about[^\\\"']*[\\\"'][^>]*>([\\s\\S]{0,1000}?)<\/div>/i,
    /<p[^>]*class=[\\\"'][^\\\"']*about[^\\\"']*[\\\"'][^>]*>([\\s\\S]{0,500}?)<\/p>/i
  ];

  for (const pattern of aboutPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (text.length > 50 && text.length < 500) {
        return text;
      }
    }
  }

  return null;
}
