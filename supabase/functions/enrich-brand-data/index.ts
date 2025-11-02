import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { brandName } = await req.json();

    if (!brandName) {
      throw new Error('Brand name is required');
    }

    console.log(`🔍 Starting brand enrichment for: "${brandName}"`);

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleCxId = Deno.env.get('GOOGLE_CX_ID');

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

// Find official brand website using Google Custom Search
async function findOfficialWebsite(brandName: string, apiKey: string, cxId: string): Promise<string | null> {
  try {
    const searchQuery = `${brandName} official website`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&num=5`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
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

    // Find the most likely official website
    for (const item of data.items) {
      const link = item.link.toLowerCase();
      const title = item.title.toLowerCase();
      const brandLower = brandName.toLowerCase();

      // Skip social media, marketplaces, reviews
      if (
        link.includes('facebook.com') ||
        link.includes('instagram.com') ||
        link.includes('twitter.com') ||
        link.includes('amazon.com') ||
        link.includes('ebay.com') ||
        link.includes('alibaba.com') ||
        link.includes('wikipedia.org')
      ) {
        continue;
      }

      // Check if URL or title contains brand name
      if (link.includes(brandLower) || title.includes(brandLower)) {
        return item.link;
      }
    }

    // Fallback: return first non-social media result
    return data.items[0]?.link || null;
  } catch (error) {
    console.error('Website search error:', error);
    return null;
  }
}

// Search for brand logo using Google Custom Search Image API
async function searchBrandLogo(brandName: string, officialWebsite: string | null, apiKey: string, cxId: string): Promise<string | null> {
  try {
    const searchQuery = officialWebsite
      ? `${brandName} logo site:${new URL(officialWebsite).hostname}`
      : `${brandName} official logo`;
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=3`;
    
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

    // Prefer logos from official website
    if (officialWebsite) {
      const officialDomain = new URL(officialWebsite).hostname;
      for (const item of data.items) {
        if (item.link && item.link.includes(officialDomain)) {
          return item.link;
        }
      }
    }

    // Fallback: return first result
    return data.items[0]?.link || null;
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

    // Fallback description
    return null;
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
