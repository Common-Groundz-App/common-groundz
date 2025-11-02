import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { brandName, sourceUrl, userId } = await req.json();

    if (!brandName || brandName.length < 2) {
      throw new Error('Valid brand name is required');
    }

    console.log(`🏢 Creating brand entity: "${brandName}"`);
    console.log(`📍 Source URL: ${sourceUrl || 'none'}`);
    console.log(`👤 User ID: ${userId || 'system'}`);

    // Step 1: Check if brand already exists (avoid duplicates)
    const { data: existingBrand } = await supabaseAdmin
      .from('entities')
      .select('id, name, image_url, slug, description, website_url, created_at, updated_at, metadata')
      .eq('type', 'brand')
      .ilike('name', brandName)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    if (existingBrand) {
      console.log(`✅ Brand already exists: ${existingBrand.id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        brandEntity: existingBrand,
        alreadyExisted: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Step 2: Find official brand website and enrich brand data
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleCxId = Deno.env.get('GOOGLE_CX_ID');

    let brandLogo: string | null = null;
    let officialWebsite: string | null = null;
    let brandDescription: string | null = null;
    let officialDomain: string | null = null;

    if (googleApiKey && googleCxId) {
      // Step 2A: Find official brand website
      try {
        const websiteSearchQuery = `${brandName} official website`;
        const websiteSearchUrl = `https://www.googleapis.com/customsearch/v1?` +
          `key=${googleApiKey}&cx=${googleCxId}&` +
          `q=${encodeURIComponent(websiteSearchQuery)}&num=3`;
        
        console.log(`🔍 Searching for official website: "${websiteSearchQuery}"`);
        
        const websiteResponse = await fetch(websiteSearchUrl);
        const websiteData = await websiteResponse.json();
        
        if (websiteData.items && websiteData.items.length > 0) {
          officialWebsite = websiteData.items[0].link;
          try {
            const urlObj = new URL(officialWebsite);
            officialDomain = urlObj.hostname.replace('www.', '');
            console.log(`🌐 Found official website: ${officialWebsite}`);
          } catch (e) {
            console.log('⚠️ Could not parse official website URL');
          }
        } else {
          console.log(`⚠️ No official website found for "${brandName}"`);
        }
      } catch (error) {
        console.error('⚠️ Failed to find official website:', error);
      }

      // Step 2B: Scrape brand description from official website
      if (officialWebsite) {
        try {
          console.log(`📄 Scraping brand description from: ${officialWebsite}`);
          
          const pageResponse = await fetch(officialWebsite, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BrandBot/1.0)'
            }
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            
            // Try OG description first
            const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
            if (ogDescMatch && ogDescMatch[1]) {
              brandDescription = ogDescMatch[1].substring(0, 500); // Limit length
              console.log(`📝 Found OG description: ${brandDescription.substring(0, 100)}...`);
            } else {
              // Fallback to meta description
              const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
              if (metaDescMatch && metaDescMatch[1]) {
                brandDescription = metaDescMatch[1].substring(0, 500);
                console.log(`📝 Found meta description: ${brandDescription.substring(0, 100)}...`);
              }
            }
          }
        } catch (error) {
          console.error('⚠️ Failed to scrape brand description:', error);
        }
      }

      // Step 2C: Enhanced logo search (prioritize official domain)
      try {
        const logoSearchQuery = `${brandName} official logo`;
        const logoSearchUrl = `https://www.googleapis.com/customsearch/v1?` +
          `key=${googleApiKey}&cx=${googleCxId}&` +
          `q=${encodeURIComponent(logoSearchQuery)}&` +
          `searchType=image&num=5&imgSize=large&safe=active`;

        console.log(`🔍 Searching for brand logo: "${logoSearchQuery}"`);
        
        const logoResponse = await fetch(logoSearchUrl);
        const logoData = await logoResponse.json();
        
        if (logoData.items && logoData.items.length > 0) {
          // Prioritize images from official domain
          if (officialDomain) {
            const domainMatch = logoData.items.find((item: any) => 
              item.image?.contextLink && new URL(item.image.contextLink).hostname.includes(officialDomain)
            );
            if (domainMatch) {
              brandLogo = domainMatch.link;
              console.log(`🎯 Found logo from official domain: ${brandLogo}`);
            }
          }
          
          // Fallback to first high-quality result
          if (!brandLogo) {
            brandLogo = logoData.items[0].link;
            console.log(`🖼️ Found brand logo: ${brandLogo}`);
          }
        } else {
          console.log(`⚠️ No logo found for "${brandName}"`);
        }
      } catch (error) {
        console.error('⚠️ Failed to fetch brand logo:', error);
      }
    } else {
      console.log('⚠️ Google API credentials not configured, skipping brand enrichment');
    }

    // Step 3: Generate slug from brand name
    const baseSlug = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let slugCounter = 1;

    // Ensure slug uniqueness
    while (true) {
      const { data: existingSlug } = await supabaseAdmin
        .from('entities')
        .select('id')
        .eq('slug', slug)
        .limit(1)
        .single();

      if (!existingSlug) break;
      
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    console.log(`🔗 Generated slug: "${slug}"`);

    // Step 4: Determine final website URL (prefer official website over source URL)
    const websiteUrl = officialWebsite || null;
    if (websiteUrl) {
      console.log(`🌐 Using website URL: ${websiteUrl}`);
    } else {
      console.log('⚠️ No website URL available');
    }

    // Step 5: Create enriched brand entity
    const finalDescription = brandDescription || `${brandName} brand`;
    
    const { data: brandEntity, error } = await supabaseAdmin
      .from('entities')
      .insert({
        name: brandName,
        type: 'brand',
        image_url: brandLogo,
        website_url: websiteUrl,
        description: finalDescription,
        slug: slug,
        created_by: userId || null,
        user_created: true,
        approval_status: 'approved', // Auto-approve brand entities
        metadata: {
          auto_created: true,
          created_from_product_url: sourceUrl,
          creation_method: 'background-auto-create',
          official_website_found: !!officialWebsite,
          description_scraped: !!brandDescription,
          logo_from_official_domain: !!officialDomain && brandLogo?.includes(officialDomain),
          enrichment_quality: officialWebsite && brandDescription ? 'high' : (officialWebsite || brandDescription ? 'medium' : 'low'),
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating brand entity:', error);
      throw error;
    }

    console.log(`✅ Created brand entity: ${brandEntity.id} (${brandEntity.name})`);

    return new Response(JSON.stringify({ 
      success: true, 
      brandEntity,
      alreadyExisted: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in create-brand-entity:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
