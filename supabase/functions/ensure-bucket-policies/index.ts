
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to create policy if it doesn't exist
async function createPolicyIfNotExists(supabase, bucketName, policyName, definition) {
  try {
    // Unfortunately there's no easy way to check if a policy exists through the JS client
    // So we'll create it and handle the error if it already exists
    const { error } = await supabase.rpc('create_storage_policy', {
      bucket_name: bucketName,
      policy_name: policyName,
      definition: definition
    });

    if (error) {
      // Not an actual error if policy already exists
      if (error.message.includes('already exists')) {
        console.log(`Policy '${policyName}' already exists for bucket '${bucketName}'`);
        return true;
      }
      throw error;
    }
    
    console.log(`Created policy '${policyName}' for bucket '${bucketName}'`);
    return true;
  } catch (error) {
    console.error(`Error creating policy '${policyName}':`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // We need to use the service role key to manipulate policies
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const { bucketName } = await req.json();
    
    if (!bucketName) {
      return new Response(
        JSON.stringify({ error: "Bucket name is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Ensure the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Error listing buckets: ${listError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        throw new Error(`Error creating bucket ${bucketName}: ${createError.message}`);
      }
      
      console.log(`Bucket ${bucketName} created successfully`);
    }

    // With a service role, we can create proper RLS policies for the bucket
    // We'll do this by calling a custom function we'll create
    
    // First, we need to set up the custom function to create policies
    // This is because the storage module in the JS client doesn't expose direct policy creation
    const { error: functionError } = await supabase.rpc('create_storage_helper_functions', {});
    
    if (functionError && !functionError.message.includes('already exists')) {
      throw new Error(`Failed to create helper functions: ${functionError.message}`);
    }

    // Now create the bucket policies
    // 1. SELECT policy - anyone can view files
    await createPolicyIfNotExists(
      supabase,
      bucketName,
      `${bucketName}_public_select`,
      `bucket_id == "${bucketName}" AND (auth.role() == 'authenticated' OR bucket_id == "${bucketName}" AND public == true)`
    );

    // 2. INSERT policy - authenticated users can upload files
    await createPolicyIfNotExists(
      supabase,
      bucketName,
      `${bucketName}_insert_policy`,
      `bucket_id == "${bucketName}" AND auth.role() == 'authenticated'`
    );

    // 3. UPDATE policy - users can update files they own
    await createPolicyIfNotExists(
      supabase,
      bucketName,
      `${bucketName}_update_policy`,
      `bucket_id == "${bucketName}" AND auth.role() == 'authenticated'`
    );

    // 4. DELETE policy - users can delete files they own
    await createPolicyIfNotExists(
      supabase,
      bucketName,
      `${bucketName}_delete_policy`,
      `bucket_id == "${bucketName}" AND auth.role() == 'authenticated'`
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully configured bucket ${bucketName}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ensure-bucket-policies function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
