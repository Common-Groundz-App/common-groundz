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
      .eq('is_deleted', false)
      .maybeSingle();

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

    // Step 1.5: Check for existing brand by website_url (de-duplication)
    if (website) {
      console.log(`🔍 Checking for brand by website: "${website}"`);
      const { data: brandByWebsite } = await supabaseAdmin
        .from('entities')
        .select('id, name, image_url, slug, description, website_url, created_at, updated_at, metadata, is_deleted')
        .eq('type', 'brand')
        .eq('website_url', website)
        .maybeSingle();

      if (brandByWebsite) {
        if (brandByWebsite.is_deleted) {
          // Restore soft-deleted brand found by website
          console.log(`♻️ Found soft-deleted brand by website: ${brandByWebsite.id}, restoring...`);
          
          const { data: restoredBrand, error: restoreError } = await supabaseAdmin
            .from('entities')
            .update({
              is_deleted: false,
              updated_at: new Date().toISOString(),
              image_url: logo || brandByWebsite.image_url,
              website_url: website || brandByWebsite.website_url,
              description: description || brandByWebsite.description,
              metadata: {
                ...(brandByWebsite.metadata || {}),
                restored: true,
                restored_at: new Date().toISOString(),
                restored_from: 'website_match',
                enriched: !!(logo || website || description),
                enrichment_date: logo || website || description ? new Date().toISOString() : null
              }
            })
            .eq('id', brandByWebsite.id)
            .select()
            .single();

          if (restoreError) {
            console.error('❌ Error restoring brand by website:', restoreError);
            throw restoreError;
          }

          console.log(`✅ Restored soft-deleted brand by website: ${restoredBrand.id} (${restoredBrand.name})`);
          return new Response(JSON.stringify({ 
            success: true, 
            brandEntity: restoredBrand,
            alreadyExisted: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        } else {
          // Brand with same website already exists and is active
          console.log(`✅ Brand already exists (matched by website): ${brandByWebsite.id}`);
          return new Response(JSON.stringify({ 
            success: true, 
            brandEntity: brandByWebsite,
            alreadyExisted: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }
      }
    }

    // Step 1.6: Check for soft-deleted brand by name (fallback for brands without website)
    console.log(`🔍 Checking for soft-deleted brand by name: "${brandName}"`);
    const { data: softDeletedBrand } = await supabaseAdmin
      .from('entities')
      .select('id, name, image_url, slug, description, website_url, created_at, updated_at, metadata')
      .eq('type', 'brand')
      .ilike('name', brandName)
      .eq('is_deleted', true)
      .maybeSingle();

    if (softDeletedBrand) {
      console.log(`♻️ Found soft-deleted brand by name: ${softDeletedBrand.id}, restoring...`);
      
      const { data: restoredBrand, error: restoreError } = await supabaseAdmin
        .from('entities')
        .update({
          is_deleted: false,
          updated_at: new Date().toISOString(),
          image_url: logo || softDeletedBrand.image_url,
          website_url: website || softDeletedBrand.website_url,
          description: description || softDeletedBrand.description,
          metadata: {
            ...(softDeletedBrand.metadata || {}),
            restored: true,
            restored_at: new Date().toISOString(),
            restored_from: 'name_match',
            enriched: !!(logo || website || description),
            enrichment_date: logo || website || description ? new Date().toISOString() : null
          }
        })
        .eq('id', softDeletedBrand.id)
        .select()
        .single();

      if (restoreError) {
        console.error('❌ Error restoring brand by name:', restoreError);
        throw restoreError;
      }

      console.log(`✅ Restored soft-deleted brand by name: ${restoredBrand.id} (${restoredBrand.name})`);
      return new Response(JSON.stringify({ 
        success: true, 
        brandEntity: restoredBrand,
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

    // Ensure slug uniqueness (excluding soft-deleted entities)
    while (true) {
      const { data: existingSlug } = await supabaseAdmin
        .from('entities')
        .select('id')
        .eq('slug', slug)
        .eq('is_deleted', false)
        .maybeSingle();

      if (!existingSlug) break;
      
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    console.log(`🔗 Generated slug: "${slug}"`);

    // Step 3: Create brand entity with enriched data (with race condition protection)
    console.log(`✨ Creating brand entity with enriched data...`);
    console.log(`   → Logo: ${logo || 'none'}`);
    console.log(`   → Website: ${website || 'none'}`);
    console.log(`   → Description: ${description ? 'provided' : 'fallback'}`);
    
    let insertAttempts = 0;
    const maxAttempts = 5;
    let brandEntity;

    while (insertAttempts < maxAttempts) {
      const { data, error } = await supabaseAdmin
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

      if (!error) {
        brandEntity = data;
        console.log(`✅ Created enriched brand entity: ${brandEntity.id} (${brandEntity.name})`);
        break;
      }

      // Handle slug conflict (race condition)
      if (error.code === '23505' && error.message.includes('slug')) {
        slugCounter++;
        slug = `${baseSlug}-${slugCounter}`;
        console.log(`⚠️ Slug conflict detected, retrying with: "${slug}"`);
        insertAttempts++;
        continue;
      }

      // Other error, throw immediately
      console.error('❌ Error creating brand entity:', error);
      throw error;
    }

    if (!brandEntity) {
      throw new Error('Failed to create brand after multiple slug conflict retries');
    }

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
