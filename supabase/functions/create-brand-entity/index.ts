import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeBrandName } from '../_shared/brand_normalize.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === Auth gate (before body parse) ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;

    // === Admin check via service_role ===
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'NOT_ADMIN' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === Now parse body ===
    // Phase 3.1: `confirmCreate` is OPTIONAL and backward-compatible.
    //   - Existing brand match → returns existing_found (no flag needed).
    //   - Missing brand or soft-deleted brand + confirmCreate !== true
    //     → returns { status: 'confirm_required' } with HTTP 200 and
    //       does NOT write. Legacy callers that previously created on
    //       missing must opt-in by passing confirmCreate: true.
    //   - confirmCreate === true → create / restore as before.
    const {
      brandName,
      sourceUrl,
      logo,
      website,
      description,
      confirmCreate,
      creationContext,
      allowWebsiteConflict,
    } = await req.json();


    if (!brandName || brandName.length < 2) {
      return new Response(JSON.stringify({ error: 'Valid brand name is required', code: 'INVALID_INPUT' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const shouldWrite = confirmCreate === true;

    console.log(`🏢 create-brand-entity: "${brandName}" (confirmCreate=${shouldWrite})`);
    console.log(`📍 Source URL: ${sourceUrl || 'none'}`);
    console.log(`👤 Authenticated User ID: ${userId}`);

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
        success: true, status: 'existing_found', brandEntity: existingBrand, alreadyExisted: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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
          if (!shouldWrite) {
            console.log(`🛡️ Soft-deleted brand by website found, confirmCreate=false → confirm_required`);
            return new Response(JSON.stringify({
              success: true, status: 'confirm_required',
              candidate: { id: brandByWebsite.id, name: brandByWebsite.name, kind: 'restore_soft_deleted_by_website' }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }
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
                restored: true, restored_at: new Date().toISOString(),
                restored_from: 'website_match',
                restored_by: userId,
                enriched: !!(logo || website || description),
                enrichment_date: logo || website || description ? new Date().toISOString() : null
              }
            })
            .eq('id', brandByWebsite.id)
            .select()
            .single();

          if (restoreError) { console.error('❌ Error restoring brand by website:', restoreError); throw restoreError; }
          console.log(`✅ Restored soft-deleted brand by website: ${restoredBrand.id}`);
          return new Response(JSON.stringify({
            success: true, status: 'restored', brandEntity: restoredBrand, alreadyExisted: true
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        } else {
          console.log(`✅ Brand already exists (matched by website): ${brandByWebsite.id}`);
          return new Response(JSON.stringify({
            success: true, status: 'existing_found', brandEntity: brandByWebsite, alreadyExisted: true
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
      }
    }

    // Step 1.6: Check for soft-deleted brand by name
    const { data: softDeletedBrand } = await supabaseAdmin
      .from('entities')
      .select('id, name, image_url, slug, description, website_url, created_at, updated_at, metadata')
      .eq('type', 'brand')
      .ilike('name', brandName)
      .eq('is_deleted', true)
      .maybeSingle();

    if (softDeletedBrand) {
      if (!shouldWrite) {
        console.log(`🛡️ Soft-deleted brand by name found, confirmCreate=false → confirm_required`);
        return new Response(JSON.stringify({
          success: true, status: 'confirm_required',
          candidate: { id: softDeletedBrand.id, name: softDeletedBrand.name, kind: 'restore_soft_deleted_by_name' }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
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
            restored: true, restored_at: new Date().toISOString(),
            restored_from: 'name_match',
            restored_by: userId,
            enriched: !!(logo || website || description),
            enrichment_date: logo || website || description ? new Date().toISOString() : null
          }
        })
        .eq('id', softDeletedBrand.id)
        .select()
        .single();

      if (restoreError) { console.error('❌ Error restoring brand by name:', restoreError); throw restoreError; }
      console.log(`✅ Restored soft-deleted brand by name: ${restoredBrand.id}`);
      return new Response(JSON.stringify({
        success: true, status: 'restored', brandEntity: restoredBrand, alreadyExisted: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Phase 3.1: no existing brand and no soft-deleted match.
    // Require explicit confirmCreate before inserting a new row.
    if (!shouldWrite) {
      console.log(`🛡️ No existing brand, confirmCreate=false → confirm_required (no write)`);
      return new Response(JSON.stringify({
        success: true, status: 'confirm_required',
        candidate: { name: brandName, kind: 'create_new' }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Step 2: Generate slug
    const baseSlug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug;
    let slugCounter = 1;

    while (true) {
      const { data: existingSlug } = await supabaseAdmin
        .from('entities').select('id').eq('slug', slug).eq('is_deleted', false).maybeSingle();
      if (!existingSlug) break;
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Step 3: Create brand entity (derived created_by from auth)
    let insertAttempts = 0;
    const maxAttempts = 5;
    let brandEntity;

    while (insertAttempts < maxAttempts) {
      const { data, error } = await supabaseAdmin
        .from('entities')
        .insert({
          name: brandName, type: 'brand', slug,
          image_url: logo || null, website_url: website || null,
          description: description || `${brandName} brand`,
          created_by: userId, // Derived from JWT, not client input
          // approval_status intentionally omitted — entities_enforce_creation BEFORE INSERT
          // trigger is the source of truth (admin → 'approved', else 'pending').
          user_created: true,
          metadata: {
            auto_created: true, created_from_product_url: sourceUrl,
            creation_method: 'enriched-auto-create',
            enriched: !!(logo || website || description),
            enrichment_date: logo || website || description ? new Date().toISOString() : null,
            created_at: new Date().toISOString()
          }
        })
        .select().single();

      if (!error) { brandEntity = data; console.log(`✅ Created brand entity: ${brandEntity.id}`); break; }
      if (error.code === '23505' && error.message.includes('slug')) {
        slugCounter++; slug = `${baseSlug}-${slugCounter}`;
        console.log(`⚠️ Slug conflict, retrying with: "${slug}"`);
        insertAttempts++; continue;
      }
      console.error('❌ Error creating brand entity:', error);
      throw error;
    }

    if (!brandEntity) throw new Error('Failed to create brand after multiple slug conflict retries');

    return new Response(JSON.stringify({
      success: true, status: 'created', brandEntity, alreadyExisted: false
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error('❌ Error in create-brand-entity:', error);
    return new Response(JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR', success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
