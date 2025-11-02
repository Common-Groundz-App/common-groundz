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

    // Step 2: Fetch brand logo from Google Images
    const logoSearchQuery = `${brandName} logo brand`;
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleCxId = Deno.env.get('GOOGLE_CX_ID');

    let brandLogo: string | null = null;
    let logoUrl: string | null = null;

    if (googleApiKey && googleCxId) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?` +
          `key=${googleApiKey}&cx=${googleCxId}&` +
          `q=${encodeURIComponent(logoSearchQuery)}&` +
          `searchType=image&num=1&imgSize=medium&safe=active`;

        console.log(`🔍 Searching for brand logo: "${logoSearchQuery}"`);
        
        const logoResponse = await fetch(searchUrl);
        const logoData = await logoResponse.json();
        
        if (logoData.items && logoData.items.length > 0) {
          logoUrl = logoData.items[0].link;
          brandLogo = logoUrl;
          console.log(`🖼️ Found brand logo: ${brandLogo}`);
        } else {
          console.log(`⚠️ No logo found for "${brandName}"`);
        }
      } catch (error) {
        console.error('⚠️ Failed to fetch brand logo:', error);
        // Continue without logo
      }
    } else {
      console.log('⚠️ Google API credentials not configured, skipping logo fetch');
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

    // Step 4: Extract website origin from source URL if available
    let websiteUrl: string | null = null;
    if (sourceUrl) {
      try {
        const urlObj = new URL(sourceUrl);
        websiteUrl = urlObj.origin;
        console.log(`🌐 Extracted website: ${websiteUrl}`);
      } catch (error) {
        console.log('⚠️ Could not extract website from source URL');
      }
    }

    // Step 5: Create brand entity
    const { data: brandEntity, error } = await supabaseAdmin
      .from('entities')
      .insert({
        name: brandName,
        type: 'brand',
        image_url: brandLogo,
        website_url: websiteUrl,
        description: `${brandName} brand`,
        slug: slug,
        created_by: userId || null,
        user_created: true,
        approval_status: 'approved', // Auto-approve brand entities
        metadata: {
          auto_created: true,
          created_from_product_url: sourceUrl,
          creation_method: 'background-auto-create',
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
