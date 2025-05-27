
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");
    if (!OMDB_API_KEY) {
      throw new Error("OMDB_API_KEY is not set");
    }

    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`🎬 Searching movies for query: "${query}"`);

    // Using OMDB API for movie search
    const searchUrl = new URL("http://www.omdbapi.com/");
    searchUrl.searchParams.append("s", query); // Search by title
    searchUrl.searchParams.append("type", "movie");
    searchUrl.searchParams.append("apikey", OMDB_API_KEY);
    
    const response = await fetch(searchUrl.toString());
    const data = await response.json();
    
    if (data.Response === "False") {
      console.log(`No movies found for query: "${query}"`);
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎥 OMDB returned ${data.Search?.length || 0} movie results`);

    // Format the response to match our entity structure with enhanced metadata
    const results = await Promise.all(
      data.Search.slice(0, 5).map(async (movie: any) => {
        // For each movie, get detailed info
        const detailUrl = new URL("http://www.omdbapi.com/");
        detailUrl.searchParams.append("i", movie.imdbID);
        detailUrl.searchParams.append("apikey", OMDB_API_KEY);
        
        try {
          const detailResponse = await fetch(detailUrl.toString());
          const detailData = await detailResponse.json();
          
          if (detailData.Response === "False") {
            console.warn(`Failed to get details for movie: ${movie.Title}`);
            return null;
          }

          // Parse cast and crew
          const cast = detailData.Actors ? detailData.Actors.split(', ') : [];
          const director = detailData.Director !== "N/A" ? detailData.Director : null;
          const writer = detailData.Writer !== "N/A" ? detailData.Writer : null;
          
          // Parse genres
          const genres = detailData.Genre ? detailData.Genre.split(', ') : [];
          
          // Parse production companies
          const productionCompanies = detailData.Production ? [detailData.Production] : [];
          
          // Parse countries
          const countries = detailData.Country ? detailData.Country.split(', ') : [];
          
          // Parse languages
          const languages = detailData.Language ? detailData.Language.split(', ') : [];
          
          // Parse ratings
          const imdbRating = detailData.imdbRating !== "N/A" ? parseFloat(detailData.imdbRating) : null;
          const imdbVotes = detailData.imdbVotes !== "N/A" ? detailData.imdbVotes.replace(/,/g, '') : null;
          
          // Parse runtime
          const runtime = detailData.Runtime !== "N/A" ? 
            parseInt(detailData.Runtime.replace(/\D/g, '')) : null;
          
          // Parse year
          const releaseYear = detailData.Year !== "N/A" ? parseInt(detailData.Year) : null;

          const result = {
            name: detailData.Title,
            venue: null,
            description: detailData.Plot !== "N/A" ? detailData.Plot : null,
            image_url: detailData.Poster !== "N/A" ? detailData.Poster : null,
            api_source: "omdb",
            api_ref: detailData.imdbID,
            metadata: {
              // Basic metadata
              year: releaseYear,
              rated: detailData.Rated !== "N/A" ? detailData.Rated : null,
              runtime: runtime,
              genre: detailData.Genre !== "N/A" ? detailData.Genre : null,
              director: director,
              actors: detailData.Actors !== "N/A" ? detailData.Actors : null,
              imdbRating: imdbRating,
              
              // Enhanced metadata for entity creation
              publication_year: releaseYear,
              languages: languages,
              cast_crew: {
                director: director,
                cast: cast.slice(0, 10), // Top 10 cast members
                writer: writer,
                producer: null // OMDB doesn't provide producer info
              },
              external_ratings: {
                imdb: imdbRating,
                imdb_votes: imdbVotes,
                metascore: detailData.Metascore !== "N/A" ? parseInt(detailData.Metascore) : null
              },
              specifications: {
                runtime: runtime,
                genres: genres,
                production_companies: productionCompanies,
                countries: countries,
                rated: detailData.Rated !== "N/A" ? detailData.Rated : null,
                box_office: detailData.BoxOffice !== "N/A" ? detailData.BoxOffice : null,
                awards: detailData.Awards !== "N/A" ? detailData.Awards : null,
                dvd_release: detailData.DVD !== "N/A" ? detailData.DVD : null,
                website: detailData.Website !== "N/A" ? detailData.Website : null
              },
              
              // Additional OMDB specific data
              imdb_id: detailData.imdbID,
              type: detailData.Type,
              plot: detailData.Plot !== "N/A" ? detailData.Plot : null,
              released: detailData.Released !== "N/A" ? detailData.Released : null
            }
          };
          
          console.log(`🎭 Enhanced movie result:`, {
            title: result.name,
            year: releaseYear,
            director: director,
            castCount: cast.length,
            rating: imdbRating,
            genreCount: genres.length
          });
          
          return result;
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.Title}:`, error);
          return null;
        }
      })
    );

    // Filter out null results
    const validResults = results.filter(result => result !== null);

    console.log(`✅ Returning ${validResults.length} enhanced movie results`);

    return new Response(
      JSON.stringify({ results: validResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in search-movies function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
