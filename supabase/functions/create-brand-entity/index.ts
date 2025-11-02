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

    const { brandName, sourceUrl, userId, logo, website, description } = await req.json();

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

    // Step 3: Create brand entity with enriched data
    console.log(`✨ Creating brand entity with enriched data...`);
    console.log(`   → Logo: ${logo || 'none'}`);
    console.log(`   → Website: ${website || 'none'}`);
    console.log(`   → Description: ${description ? 'provided' : 'fallback'}`);
    
    const { data: brandEntity, error } = await supabaseAdmin
      .from('entities')
      .insert({
        name: brandName,
        type: 'brand',
        slug: slug,
        image_url: logo || null,
        website_url: website || null,
        description: description || `${brandName} brand`,
        created_by: userId || null,
        user_created: true,
        approval_status: 'approved',
        metadata: {
          auto_created: true,
          created_from_product_url: sourceUrl,
          creation_method: 'enriched-auto-create',
          enriched: !!(logo || website || description),
          enrichment_date: logo || website || description ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating brand entity:', error);
      throw error;
    }

    console.log(`✅ Created enriched brand entity: ${brandEntity.id} (${brandEntity.name})`);

    // Return enriched brand entity
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
