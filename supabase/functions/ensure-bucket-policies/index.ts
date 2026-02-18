import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowlist of permitted bucket names
const ALLOWED_BUCKETS = ['entity-images', 'post_media'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === Auth gate (before body parse) ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userId = claimsData.claims.sub;

    // === Admin check via service_role ===
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'NOT_ADMIN' }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // === Now parse body ===
    const { bucketName } = await req.json();
    
    if (!bucketName) {
      return new Response(
        JSON.stringify({ error: "Bucket name is required", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Bucket allowlist check ===
    if (!ALLOWED_BUCKETS.includes(bucketName)) {
      console.warn(`⚠️ Rejected bucket name not in allowlist: ${bucketName}`);
      return new Response(
        JSON.stringify({ error: "Bucket name not allowed", code: "BUCKET_NOT_ALLOWED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Setting up bucket policies for: ${bucketName}`);

    // Ensure the bucket exists first
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`Error listing buckets: ${listError.message}`);
      throw new Error(`Error listing buckets: ${listError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}: ${createError.message}`);
        throw new Error(`Error creating bucket ${bucketName}: ${createError.message}`);
      }
      
      console.log(`Bucket ${bucketName} created successfully`);
    }

    // Use the storage policy creation function
    const { error: policyError } = await supabase.rpc('create_storage_open_policy', {
      bucket_id: bucketName
    });

    if (policyError) {
      console.error(`Error creating storage policies: ${policyError.message}`);
      console.log(`Policy setup completed with warnings for bucket: ${bucketName}`);
    } else {
      console.log(`Storage policies created successfully for bucket: ${bucketName}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully configured bucket ${bucketName}`,
        bucketExists: bucketExists
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ensure-bucket-policies function:", error);
    return new Response(
      JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR', success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
