
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENTITY_IMAGES_BUCKET = 'entity-images';

// Build a Google Places photo URL from photo reference
function buildGooglePhotoUrl(photoReference: string, apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${apiKey}`;
}

// Build a Google Books image URL from book ID
function buildGoogleBooksUrl(bookId: string, apiKey: string): string {
  return `https://www.googleapis.com/books/v1/volumes/${bookId}?key=${apiKey}&fields=volumeInfo/imageLinks`;
}

// Build a TMDB movie details URL from movie ID
function buildTmdbMovieUrl(movieId: string, apiKey: string): string {
  return `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`;
}

// Function to save an image from URL to our storage bucket
async function saveImageToStorage(imageUrl: string, entityId: string, supabase: any) {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/*',
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const contentType = imageResponse.headers.get("content-type");
    const imageBlob = await imageResponse.blob();
    const fileExt = contentType?.split("/")[1] || "jpeg";
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`Uploading image to storage: ${filePath} (${contentType}, size: ${imageBlob.size} bytes)`);
    
    // Ensure the bucket has proper policies before upload
    await ensureBucketPolicies(supabase, ENTITY_IMAGES_BUCKET);
    
    // Upload to our storage
    const { data, error: uploadError } = await supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .upload(filePath, imageBlob, {
        contentType,
        upsert: false,
      });
      
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      
      // Try to troubleshoot the error
      if (uploadError.message.includes('permission_denied')) {
        console.error('Upload permission denied. Attempting to fix bucket policies...');
        await createBucketWithPolicies(supabase, ENTITY_IMAGES_BUCKET);
        
        // Try upload one more time
        const { data: retryData, error: retryError } = await supabase.storage
          .from(ENTITY_IMAGES_BUCKET)
          .upload(filePath, imageBlob, {
            contentType,
            upsert: false,
          });
          
        if (retryError) {
          console.error("Retry upload still failed:", retryError);
          throw new Error(`Storage upload failed after policy fix: ${retryError.message}`);
        }
      } else {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .getPublicUrl(filePath);
      
    console.log(`Image saved to storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`Error saving image to storage:`, error);
    return null;
  }
}

// Handle Google Books entities
async function handleGoogleBooksEntity(entityId: string, googleBooksId: string, apiKey: string, supabase: any) {
  try {
    console.log(`Processing Google Books entity with ID: ${googleBooksId}`);
    
    const booksUrl = buildGoogleBooksUrl(googleBooksId, apiKey);
    console.log(`Fetching book details from: ${booksUrl}`);
    
    const response = await fetch(booksUrl);
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.volumeInfo?.imageLinks) {
      throw new Error("No image links found for this book");
    }
    
    // Try to get the best quality image available
    const imageLinks = data.volumeInfo.imageLinks;
    const imageUrl = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.small || imageLinks.thumbnail;
    
    if (!imageUrl) {
      throw new Error("No suitable image found for this book");
    }
    
    console.log(`Found book image URL: ${imageUrl}`);
    
    // Convert to HTTPS if needed
    const httpsImageUrl = imageUrl.replace('http://', 'https://');
    
    // Save image to our storage
    const storedImageUrl = await saveImageToStorage(httpsImageUrl, entityId, supabase);
    
    if (!storedImageUrl) {
      throw new Error("Failed to save Google Books image to storage");
    }
    
    return { imageUrl: storedImageUrl, metadata: { google_books_id: googleBooksId } };
  } catch (error) {
    console.error("Error handling Google Books entity:", error);
    throw error;
  }
}

// Handle TMDB movie entities
async function handleTmdbMovieEntity(entityId: string, tmdbId: string, apiKey: string, supabase: any) {
  try {
    console.log(`Processing TMDB movie entity with ID: ${tmdbId}`);
    
    const movieUrl = buildTmdbMovieUrl(tmdbId, apiKey);
    console.log(`Fetching movie details from: ${movieUrl}`);
    
    const response = await fetch(movieUrl);
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.poster_path) {
      throw new Error("No poster image found for this movie");
    }
    
    // TMDB provides relative poster paths, we need to construct the full URL
    // Using w500 size for good quality
    const imageUrl = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
    
    console.log(`Found movie poster URL: ${imageUrl}`);
    
    // Save image to our storage
    const storedImageUrl = await saveImageToStorage(imageUrl, entityId, supabase);
    
    if (!storedImageUrl) {
      throw new Error("Failed to save TMDB movie image to storage");
    }
    
    return { imageUrl: storedImageUrl, metadata: { tmdb_id: tmdbId } };
  } catch (error) {
    console.error("Error handling TMDB movie entity:", error);
    throw error;
  }
}

// Handle external image URLs (for non-API entities)
async function handleExternalImageUrl(entityId: string, imageUrl: string, supabase: any) {
  try {
    console.log(`Processing external image URL: ${imageUrl}`);
    
    // For proxy URLs, use them directly for downloading
    const downloadUrl = imageUrl;
    
    // Save image to our storage
    const storedImageUrl = await saveImageToStorage(downloadUrl, entityId, supabase);
    
    if (!storedImageUrl) {
      throw new Error("Failed to save external image to storage");
    }
    
    return { imageUrl: storedImageUrl };
  } catch (error) {
    console.error("Error handling external image URL:", error);
    throw error;
  }
}

// Create a bucket if it doesn't exist with all needed policies
async function createBucketWithPolicies(supabase: any, bucketName: string) {
  try {
    // First ensure the bucket exists
    const bucketResult = await ensureBucketExists(supabase, bucketName);
    if (!bucketResult) {
      throw new Error(`Failed to create bucket ${bucketName}`);
    }
    
    // Then create policies using the service role
    // For this function, we need to use direct SQL execution using rpc
    // We'll create an open policy for now to ensure things work
    const { data, error } = await supabase.rpc('create_storage_open_policy', {
      bucket_id: bucketName
    });
    
    if (error) {
      console.error(`Error creating open policy for ${bucketName}:`, error);
      return false;
    }
    
    console.log(`Successfully created open policy for bucket ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error creating bucket with policies:`, error);
    return false;
  }
}

// Create a bucket if it doesn't exist
async function ensureBucketExists(supabase: any, bucketName: string) {
  try {
    // List buckets to check if our bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      throw listError;
    }
    
    // Check if bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Bucket ${bucketName} doesn't exist, creating it...`);
      
      // Create the bucket
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}:`, createError);
        throw createError;
      }
      
      console.log(`Bucket ${bucketName} created successfully`);
    } else {
      console.log(`Bucket ${bucketName} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error("Error ensuring bucket exists:", error);
    return false;
  }
}

// Ensure a bucket has the correct policies
async function ensureBucketPolicies(supabase: any, bucketName: string) {
  try {
    // First ensure the bucket exists
    await ensureBucketExists(supabase, bucketName);
    
    // Then try to update the bucket to be public
    const { error } = await supabase.storage.updateBucket(bucketName, {
      public: true
    });
    
    if (error) {
      console.error(`Error updating bucket ${bucketName} to public:`, error);
      return false;
    }
    
    console.log(`Successfully updated bucket ${bucketName} to be public`);
    return true;
  } catch (error) {
    console.error("Error ensuring bucket policies:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY");
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // We need to use the service role key to manage storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request data
    const requestData = await req.json();
    const { placeId, photoReference, entityId, googleBooksId, tmdbId, externalImageUrl, apiSource } = requestData;
    
    console.log("Request received:", { placeId, photoReference, entityId, googleBooksId, tmdbId, externalImageUrl, apiSource });
    
    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "Entity ID is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Ensure the entity-images bucket exists with proper policies
    const bucketPrepared = await ensureBucketPolicies(supabase, ENTITY_IMAGES_BUCKET);
    
    if (!bucketPrepared) {
      console.error("Failed to prepare storage bucket");
      // Continue anyway and see if we can still upload
    }

    let result;

    // Handle Google Places entities
    if (placeId || photoReference) {
      if (!GOOGLE_PLACES_API_KEY) {
        throw new Error("GOOGLE_PLACES_API_KEY is not set");
      }

      // If we have a photo reference, use it directly
      if (photoReference) {
        const googleImageUrl = buildGooglePhotoUrl(photoReference, GOOGLE_PLACES_API_KEY);
        
        console.log("Using provided photo reference to fetch image:", photoReference);
        
        // Save image to our storage
        const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
        
        if (!storedImageUrl) {
          throw new Error("Failed to save Google Places image to storage");
        }
        
        result = { imageUrl: storedImageUrl, photoReference };
      } else if (placeId) {
        // Fetch place details to get photo reference
        console.log("No photo reference provided, fetching place details for:", placeId);
        
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.append("place_id", placeId);
        detailsUrl.searchParams.append("fields", "photos");
        detailsUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);

        const response = await fetch(detailsUrl.toString(), {
          headers: {
            'Accept': 'application/json',
          }
        });
        
        const data = await response.json();

        if (!response.ok) {
          throw new Error(`Google Places API error: ${data.error_message || "Unknown error"}`);
        }

        // Check if the place has photos
        if (data.result?.photos && data.result.photos.length > 0) {
          const newPhotoRef = data.result.photos[0].photo_reference;
          
          if (newPhotoRef) {
            console.log("Found new photo reference:", newPhotoRef);
            
            const googleImageUrl = buildGooglePhotoUrl(newPhotoRef, GOOGLE_PLACES_API_KEY);
            
            // Save image to our storage
            const storedImageUrl = await saveImageToStorage(googleImageUrl, entityId, supabase);
            
            if (!storedImageUrl) {
              throw new Error("Failed to save Google Places image to storage");
            }
            
            result = { imageUrl: storedImageUrl, photoReference: newPhotoRef };
          }
        } else {
          throw new Error("No photos available for this place");
        }
      }
    }
    // Handle Google Books entities
    else if (googleBooksId) {
      if (!GOOGLE_BOOKS_API_KEY) {
        throw new Error("GOOGLE_BOOKS_API_KEY is not set");
      }
      
      result = await handleGoogleBooksEntity(entityId, googleBooksId, GOOGLE_BOOKS_API_KEY, supabase);
    }
    // Handle TMDB movie entities
    else if (tmdbId) {
      if (!TMDB_API_KEY) {
        throw new Error("TMDB_API_KEY is not set");
      }
      
      result = await handleTmdbMovieEntity(entityId, tmdbId, TMDB_API_KEY, supabase);
    }
    // Handle external image URLs (for non-API entities or proxy URLs)
    else if (externalImageUrl) {
      result = await handleExternalImageUrl(entityId, externalImageUrl, supabase);
    }
    else {
      return new Response(
        JSON.stringify({ error: "Either placeId/photoReference, googleBooksId, tmdbId, or externalImageUrl is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Update entity record with new image URL and metadata
    const updateData: any = { image_url: result.imageUrl };
    
    if (result.photoReference) {
      updateData.metadata = { photo_reference: result.photoReference };
    } else if (result.metadata) {
      updateData.metadata = result.metadata;
    }
    
    const { error: updateError } = await supabase
      .from('entities')
      .update(updateData)
      .eq('id', entityId);
      
    if (updateError) {
      console.error("Error updating entity record:", updateError);
    }
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in refresh-entity-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
