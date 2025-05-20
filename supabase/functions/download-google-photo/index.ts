
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
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get request data
    const { placeId, photoRef } = await req.json();
    
    if (!placeId) {
      return new Response(
        JSON.stringify({ error: "Place ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!photoRef) {
      return new Response(
        JSON.stringify({ error: "Photo reference is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`Processing request for Place ID: ${placeId}, Photo Reference: ${photoRef}`);
    
    // Build the Google Places photo URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
    
    // Fetch the image from Google Places API
    const response = await fetch(photoUrl, {
      headers: {
        // Add a user agent to avoid being blocked
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image from Google Places API: ${response.status}`);
    }
    
    // Get the image data as blob
    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      throw new Error("Downloaded image has zero size");
    }
    
    // Generate a unique file name based on place ID and timestamp
    const timestamp = Date.now();
    const fileName = `${placeId}_${timestamp}.jpg`;
    const filePath = `google-places/${fileName}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('entity-images')
      .upload(filePath, imageBlob, {
        cacheControl: '31536000', // Cache for 1 year
        contentType: imageBlob.type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Error uploading image to storage: ${uploadError.message}`);
    }
    
    // Get the public URL to the file
    const { data: { publicUrl } } = supabase.storage
      .from('entity-images')
      .getPublicUrl(filePath);
      
    console.log(`Successfully uploaded image to: ${filePath}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        publicUrl,
        filePath
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in download-google-photo function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
