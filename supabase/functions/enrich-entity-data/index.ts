
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the next entity to enrich from the queue
    const { data: queueItem, error: queueError } = await supabase
      .from('entity_enrichment_queue')
      .select('*, entities(*)')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueError || !queueItem) {
      console.log('No pending entities to enrich');
      return new Response(
        JSON.stringify({ message: 'No pending entities to enrich' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing entity enrichment for: ${queueItem.entities.name}`);

    // Mark as processing
    await supabase
      .from('entity_enrichment_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', queueItem.id);

    try {
      // Enrich entity based on its API source
      const enrichedData = await enrichEntityData(queueItem.entities);
      
      if (enrichedData) {
        // Update entity with enriched data
        const { error: updateError } = await supabase
          .from('entities')
          .update({
            ...enrichedData,
            last_enriched_at: new Date().toISOString(),
            data_quality_score: calculateDataQualityScore(enrichedData)
          })
          .eq('id', queueItem.entity_id);

        if (updateError) {
          throw updateError;
        }

        // Mark as completed
        await supabase
          .from('entity_enrichment_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);

        console.log(`Successfully enriched entity: ${queueItem.entities.name}`);
      } else {
        throw new Error('Failed to enrich entity data');
      }

    } catch (enrichError) {
      console.error('Error enriching entity:', enrichError);
      
      // Update retry count and status
      const newRetryCount = (queueItem.retry_count || 0) + 1;
      const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';
      
      await supabase
        .from('entity_enrichment_queue')
        .update({ 
          status: newStatus,
          retry_count: newRetryCount,
          error_message: enrichError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', queueItem.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        entity: queueItem.entities.name,
        status: 'processed'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in enrich-entity-data function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

async function enrichEntityData(entity: any) {
  console.log(`Enriching data for ${entity.type}: ${entity.name}`);
  
  switch (entity.api_source) {
    case 'openlibrary':
      return await enrichBookData(entity);
    case 'tmdb':
      return await enrichMovieData(entity);
    case 'google_places':
      return await enrichPlaceData(entity);
    default:
      return await enrichGenericData(entity);
  }
}

async function enrichBookData(entity: any) {
  try {
    // If we have an ISBN, fetch detailed data from Open Library
    if (entity.isbn || entity.metadata?.isbn) {
      const isbn = entity.isbn || entity.metadata?.isbn;
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      
      if (response.ok) {
        const data = await response.json();
        const bookData = data[`ISBN:${isbn}`];
        
        if (bookData) {
          return {
            authors: bookData.authors?.map((a: any) => a.name) || entity.authors,
            publication_year: bookData.publish_date ? new Date(bookData.publish_date).getFullYear() : entity.publication_year,
            isbn: isbn,
            languages: bookData.languages?.map((l: any) => l.name) || entity.languages,
            external_ratings: {
              ...entity.external_ratings,
              openlibrary: bookData.rating
            },
            specifications: {
              ...entity.specifications,
              page_count: bookData.number_of_pages,
              publisher: bookData.publishers?.[0]?.name,
              subjects: bookData.subjects?.map((s: any) => s.name)
            }
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error enriching book data:', error);
    return null;
  }
}

async function enrichMovieData(entity: any) {
  try {
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    if (!TMDB_API_KEY || !entity.api_ref) return null;

    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${entity.api_ref}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    );
    
    if (response.ok) {
      const movieData = await response.json();
      
      return {
        publication_year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : entity.publication_year,
        languages: movieData.spoken_languages?.map((l: any) => l.english_name) || entity.languages,
        external_ratings: {
          ...entity.external_ratings,
          tmdb: movieData.vote_average,
          imdb: movieData.imdb_id
        },
        cast_crew: {
          director: movieData.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
          cast: movieData.credits?.cast?.slice(0, 10).map((c: any) => c.name),
          producer: movieData.credits?.crew?.filter((c: any) => c.job === 'Producer').map((c: any) => c.name)
        },
        specifications: {
          ...entity.specifications,
          runtime: movieData.runtime,
          budget: movieData.budget,
          revenue: movieData.revenue,
          genres: movieData.genres?.map((g: any) => g.name),
          production_companies: movieData.production_companies?.map((c: any) => c.name)
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error enriching movie data:', error);
    return null;
  }
}

async function enrichPlaceData(entity: any) {
  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY || !entity.api_ref) return null;

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${entity.api_ref}&key=${GOOGLE_PLACES_API_KEY}&fields=rating,user_ratings_total,price_level,formatted_address,formatted_phone_number,website,opening_hours,types`
    );
    
    if (response.ok) {
      const data = await response.json();
      const placeData = data.result;
      
      if (placeData) {
        return {
          external_ratings: {
            ...entity.external_ratings,
            google_rating: placeData.rating,
            user_ratings_total: placeData.user_ratings_total,
            price_level: placeData.price_level
          },
          specifications: {
            ...entity.specifications,
            address: placeData.formatted_address,
            phone: placeData.formatted_phone_number,
            website: placeData.website,
            hours: placeData.opening_hours,
            types: placeData.types
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error enriching place data:', error);
    return null;
  }
}

async function enrichGenericData(entity: any) {
  // For entities without specific API sources, we can still enhance basic metadata
  return {
    data_quality_score: calculateDataQualityScore(entity),
    last_enriched_at: new Date().toISOString()
  };
}

function calculateDataQualityScore(entity: any): number {
  let score = 0;
  
  if (entity.name) score += 10;
  if (entity.description) score += 15;
  if (entity.image_url) score += 10;
  if (entity.authors?.length) score += 10;
  if (entity.publication_year) score += 5;
  if (entity.isbn) score += 10;
  if (entity.languages?.length) score += 5;
  if (entity.external_ratings && Object.keys(entity.external_ratings).length > 0) score += 15;
  if (entity.specifications && Object.keys(entity.specifications).length > 0) score += 10;
  if (entity.cast_crew && Object.keys(entity.cast_crew).length > 0) score += 10;
  if (entity.ingredients?.length) score += 5;
  
  return Math.min(score, 100);
}
