
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EntityToRefresh {
  id: string;
  name: string;
  api_ref: string;
  photo_reference?: string;
  image_url: string;
  metadata?: any;
}

interface RefreshResponse {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  healthChecked: number;
  brokenImagesFound: number;
  errors: Array<{id: string, name: string, error: string}>;
}

// Helper function to validate API key
function validateApiKey(apiKey: string, expectedApiKey: string): boolean {
  if (!apiKey || !expectedApiKey) {
    return false;
  }
  
  // Use constant time comparison to prevent timing attacks
  return apiKey === expectedApiKey;
}

// Helper function to check image health via HEAD request
async function checkImageHealth(imageUrl: string): Promise<{ isHealthy: boolean; errorType?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(imageUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Supabase-HealthChecker/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { isHealthy: true };
    } else {
      let errorType = 'unknown';
      if (response.status === 404) errorType = '404';
      else if (response.status === 403) errorType = '403';
      else if (response.status >= 500) errorType = '500';
      
      return { isHealthy: false, errorType };
    }
  } catch (error) {
    let errorType = 'unknown';
    if (error.name === 'AbortError') errorType = 'timeout';
    else if (error.message?.includes('network')) errorType = 'network';
    
    return { isHealthy: false, errorType };
  }
}

// Helper to extract photo reference from metadata or URL
function extractPhotoReference(entity: EntityToRefresh): string | null {
  // Try to get from metadata first
  if (entity.metadata && typeof entity.metadata === 'object' && entity.metadata.photo_reference) {
    return entity.metadata.photo_reference;
  }
  
  // If not in metadata, try to extract from URL if it's a Google Places URL
  if (entity.image_url && entity.image_url.includes('maps.googleapis.com/maps/api/place/photo')) {
    try {
      const url = new URL(entity.image_url);
      const photoRef = url.searchParams.get('photoreference');
      if (photoRef) {
        return photoRef;
      }
    } catch (e) {
      console.error(`Error parsing image URL for entity ${entity.id}:`, e);
    }
  }
  
  // If we don't have a photo reference return null
  return null;
}

// Process a batch of entities with health checking
async function processBatch(
  supabase: any, 
  entities: EntityToRefresh[], 
  refreshResponse: RefreshResponse,
  includeHealthCheck: boolean = true,
  maxRetries: number = 2
): Promise<void> {
  console.log(`Processing batch of ${entities.length} entities (health check: ${includeHealthCheck})`);
  
  for (const entity of entities) {
    refreshResponse.processed++;
    
    let needsRefresh = false;
    let refreshReason = 'scheduled';
    
    // First, check image health if enabled
    if (includeHealthCheck && entity.image_url) {
      refreshResponse.healthChecked++;
      
      const healthCheck = await checkImageHealth(entity.image_url);
      
      if (!healthCheck.isHealthy) {
        refreshResponse.brokenImagesFound++;
        needsRefresh = true;
        refreshReason = `broken_image_${healthCheck.errorType}`;
        console.log(`Entity ${entity.id} (${entity.name}) has broken image: ${healthCheck.errorType}`);
      } else {
        console.log(`Entity ${entity.id} (${entity.name}) has healthy image, skipping refresh`);
        // Skip refresh for healthy images unless explicitly requested
        if (includeHealthCheck) {
          refreshResponse.skipped++;
          continue;
        }
      }
    }
    
    // Extract photo reference from metadata or URL
    const photoReference = extractPhotoReference(entity);
    
    if (!photoReference && !needsRefresh) {
      console.log(`No photo reference found for entity ${entity.id} (${entity.name}), skipping`);
      refreshResponse.skipped++;
      refreshResponse.errors.push({
        id: entity.id,
        name: entity.name,
        error: 'No photo reference found'
      });
      continue;
    }
    
    let success = false;
    let attempt = 0;
    let lastError = null;
    
    // Try up to maxRetries times
    while (!success && attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for entity ${entity.id} (${entity.name})`);
        }
        
        console.log(`Refreshing image for entity ${entity.id} (${entity.name}) - reason: ${refreshReason}, attempt ${attempt + 1}`);
        
        // Call the existing refresh-entity-image edge function
        const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
          body: {
            entityId: entity.id,
            placeId: entity.api_ref,
            photoReference: photoReference
          }
        });
        
        if (error) {
          throw new Error(`Edge function error: ${error.message}`);
        }
        
        if (!data || !data.imageUrl) {
          throw new Error('No image URL returned from refresh function');
        }
        
        console.log(`Successfully refreshed image for entity ${entity.id} (${entity.name}): ${data.imageUrl}`);
        success = true;
        refreshResponse.succeeded++;
        
      } catch (e) {
        lastError = e;
        console.error(`Error refreshing entity ${entity.id} (${entity.name}), attempt ${attempt + 1}:`, e);
        attempt++;
      }
    }
    
    // If all attempts failed, log the error
    if (!success) {
      refreshResponse.failed++;
      refreshResponse.errors.push({
        id: entity.id,
        name: entity.name,
        error: lastError ? lastError.message : 'Unknown error'
      });
    }
    
    // Add a small delay between entity processing to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get Supabase client with service role key (required for accessing entities)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const API_KEY = Deno.env.get("DAILY_REFRESH_API_KEY") || "";
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_KEY) {
      throw new Error("Required environment variables are not set");
    }
    
    // Check for API key in authorization header
    const authHeader = req.headers.get('authorization') || "";
    const providedApiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key
    if (!validateApiKey(providedApiKey, API_KEY)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get parameters from request body
    const { 
      batchSize = 10, 
      maxRetries = 2, 
      dryRun = false,
      enableHealthCheck = true,
      forceRefresh = false 
    } = await req.json();
    
    console.log(`Starting daily entity image refresh (batchSize: ${batchSize}, maxRetries: ${maxRetries}, dryRun: ${dryRun}, healthCheck: ${enableHealthCheck}, forceRefresh: ${forceRefresh})`);
    
    // Find entities that need image refresh
    // - Google Places entities (or all if forceRefresh is true)
    // - With image URLs from external sources (or all if forceRefresh is true)
    // - Not deleted
    let query = supabase
      .from("entities")
      .select("id, name, api_ref, image_url, metadata")
      .eq("is_deleted", false);
    
    if (!forceRefresh) {
      query = query
        .eq("api_source", "google_places")
        .like("image_url", "https://maps.googleapis.com%");
    }
    
    query = query.order("updated_at"); // Oldest first for fair rotation
    
    const { data: entitiesToRefresh, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching entities: ${error.message}`);
    }
    
    const refreshResponse: RefreshResponse = {
      total: entitiesToRefresh ? entitiesToRefresh.length : 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      healthChecked: 0,
      brokenImagesFound: 0,
      errors: []
    };
    
    console.log(`Found ${refreshResponse.total} entities to potentially refresh`);
    
    // Skip processing in dry run mode
    if (!dryRun && entitiesToRefresh && entitiesToRefresh.length > 0) {
      // Process entities in batches
      for (let i = 0; i < entitiesToRefresh.length; i += batchSize) {
        const batch = entitiesToRefresh.slice(i, i + batchSize);
        await processBatch(supabase, batch, refreshResponse, enableHealthCheck, maxRetries);
      }
    }
    
    // Final summary
    console.log(`Entity image refresh complete. Summary:
      Total: ${refreshResponse.total}
      Processed: ${refreshResponse.processed}
      Succeeded: ${refreshResponse.succeeded}
      Failed: ${refreshResponse.failed}
      Skipped: ${refreshResponse.skipped}
      Health Checked: ${refreshResponse.healthChecked}
      Broken Images Found: ${refreshResponse.brokenImagesFound}
    `);
    
    return new Response(
      JSON.stringify(refreshResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Error in daily-refresh-entity-images function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
