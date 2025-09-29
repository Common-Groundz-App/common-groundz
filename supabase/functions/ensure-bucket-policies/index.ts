
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log(`Setting up bucket policies for: ${bucketName}`);

    // Ensure the bucket exists first
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`Error listing buckets: ${listError.message}`);
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
      // Don't throw here as policies might already exist
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
      JSON.stringify({ 
        error: (error as Error).message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
