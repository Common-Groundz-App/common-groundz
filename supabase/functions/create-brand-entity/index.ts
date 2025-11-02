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

    // Step 1: Check if brand already exists (avoid duplicates, exclude soft-deleted)
    const { data: existingBrand } = await supabaseAdmin
      .from('entities')
      .select('id, name, image_url, slug, description, website_url, created_at, updated_at, metadata')
      .eq('type', 'brand')
      .ilike('name', brandName)
      .is('deleted_at', null)
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

    // Step 2: Generate slug from brand name
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

    // Step 3: Create MINIMAL brand entity immediately (always succeeds)
    console.log(`⚡ Creating minimal brand entity immediately...`);
    
    const { data: brandEntity, error } = await supabaseAdmin
      .from('entities')
      .insert({
        name: brandName,
        type: 'brand',
        slug: slug,
        description: `${brandName} brand`,
        created_by: userId || null,
        user_created: true,
        approval_status: 'approved',
        metadata: {
          auto_created: true,
          created_from_product_url: sourceUrl,
          creation_method: 'hybrid-auto-create',
          enrichment_pending: true,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating brand entity:', error);
      throw error;
    }

    console.log(`✅ Created minimal brand entity: ${brandEntity.id} (${brandEntity.name})`);

    // Step 4: Start background enrichment (non-blocking, fire-and-forget)
    const enrichBrandInBackground = async () => {
      try {
        console.log(`🎨 Starting background enrichment for brand: ${brandEntity.id}`);
        
        const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
        const googleCxId = Deno.env.get('GOOGLE_CX_ID');

        if (!googleApiKey || !googleCxId) {
          console.log('⚠️ Google API credentials not configured, skipping enrichment');
          return;
        }

        let brandLogo: string | null = null;
        let officialWebsite: string | null = null;
        let brandDescription: string | null = null;
        let officialDomain: string | null = null;

        // Find official website
        try {
          const websiteSearchUrl = `https://www.googleapis.com/customsearch/v1?` +
            `key=${googleApiKey}&cx=${googleCxId}&` +
            `q=${encodeURIComponent(brandName + ' official website')}&num=3`;
          
          const websiteResponse = await fetch(websiteSearchUrl, {
            signal: AbortSignal.timeout(10000)
          });
          
          if (websiteResponse.ok) {
            const websiteData = await websiteResponse.json();
            
            if (websiteData.items && websiteData.items.length > 0) {
              officialWebsite = websiteData.items[0].link;
              const urlObj = new URL(officialWebsite);
              officialDomain = urlObj.hostname.replace('www.', '');
              console.log(`🌐 Found official website: ${officialWebsite}`);
            }
          }
        } catch (error) {
          console.error('⚠️ Website search failed:', error.message);
        }

        // Scrape description from official website
        if (officialWebsite) {
          try {
            const pageResponse = await fetch(officialWebsite, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandBot/1.0)' },
              signal: AbortSignal.timeout(8000)
            });
            
            if (pageResponse.ok) {
              const html = await pageResponse.text();
              
              const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
              const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
              
              brandDescription = (ogDescMatch?.[1] || metaDescMatch?.[1])?.substring(0, 500);
              
              if (brandDescription) {
                console.log(`📝 Scraped description: ${brandDescription.substring(0, 100)}...`);
              }
            }
          } catch (error) {
            console.error('⚠️ Description scraping failed:', error.message);
          }
        }

        // Find brand logo
        try {
          const logoSearchUrl = `https://www.googleapis.com/customsearch/v1?` +
            `key=${googleApiKey}&cx=${googleCxId}&` +
            `q=${encodeURIComponent(brandName + ' official logo')}&` +
            `searchType=image&num=5&imgSize=large&safe=active`;
          
          const logoResponse = await fetch(logoSearchUrl, {
            signal: AbortSignal.timeout(10000)
          });
          
          if (logoResponse.ok) {
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
              
              if (!brandLogo) {
                brandLogo = logoData.items[0].link;
                console.log(`🖼️ Found brand logo: ${brandLogo}`);
              }
            }
          }
        } catch (error) {
          console.error('⚠️ Logo search failed:', error.message);
        }

        // Update brand with enriched data
        const updateData: any = {
          metadata: {
            ...brandEntity.metadata,
            enrichment_pending: false,
            enrichment_completed: true,
            enrichment_timestamp: new Date().toISOString(),
            official_website_found: !!officialWebsite,
            description_scraped: !!brandDescription,
            logo_from_official_domain: !!officialDomain && brandLogo?.includes(officialDomain),
            enrichment_quality: officialWebsite && brandDescription && brandLogo ? 'high' : 
                               (officialWebsite || brandDescription || brandLogo ? 'medium' : 'low')
          }
        };

        if (brandLogo) updateData.image_url = brandLogo;
        if (officialWebsite) updateData.website_url = officialWebsite;
        if (brandDescription) updateData.description = brandDescription;

        const { error: updateError } = await supabaseAdmin
          .from('entities')
          .update(updateData)
          .eq('id', brandEntity.id);

        if (updateError) {
          console.error('⚠️ Failed to update brand with enriched data:', updateError);
        } else {
          console.log(`✨ Successfully enriched brand: ${brandEntity.id}`);
        }

      } catch (error) {
        console.error('⚠️ Background enrichment failed:', error);
      }
    };

    // Trigger background enrichment without blocking response
    enrichBrandInBackground().catch(err => 
      console.error('Background enrichment error:', err)
    );

    // Return minimal brand immediately so product creation can proceed
    return new Response(JSON.stringify({ 
      success: true, 
      brandEntity,
      alreadyExisted: false,
      enrichmentPending: true
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
