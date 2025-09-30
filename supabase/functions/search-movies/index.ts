
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");
    
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

    // Handle missing API key gracefully
    if (!OMDB_API_KEY) {
      console.warn("OMDB_API_KEY is not configured - returning empty results");
      return new Response(
        JSON.stringify({ 
          results: [],
          message: "Movie search temporarily unavailable" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎬 Searching movies for query: "${query}"`);

    const searchUrl = new URL("http://www.omdbapi.com/");
    searchUrl.searchParams.append("s", query);
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

    const results = await Promise.all(
      data.Search.slice(0, 5).map(async (movie: any) => {
        try {
          const detailUrl = new URL("http://www.omdbapi.com/");
          detailUrl.searchParams.append("i", movie.imdbID);
          detailUrl.searchParams.append("apikey", OMDB_API_KEY);
          
          const detailResponse = await fetch(detailUrl.toString());
          const detailData = await detailResponse.json();
          
          if (detailData.Response === "False") {
            console.warn(`Failed to get details for movie: ${movie.Title}`);
            return null;
          }

          const cast = detailData.Actors ? detailData.Actors.split(', ') : [];
          const director = detailData.Director !== "N/A" ? detailData.Director : null;
          const writer = detailData.Writer !== "N/A" ? detailData.Writer : null;
          const genres = detailData.Genre ? detailData.Genre.split(', ') : [];
          const productionCompanies = detailData.Production ? [detailData.Production] : [];
          const countries = detailData.Country ? detailData.Country.split(', ') : [];
          const languages = detailData.Language ? detailData.Language.split(', ') : [];
          const imdbRating = detailData.imdbRating !== "N/A" ? parseFloat(detailData.imdbRating) : null;
          const imdbVotes = detailData.imdbVotes !== "N/A" ? detailData.imdbVotes.replace(/,/g, '') : null;
          const runtime = detailData.Runtime !== "N/A" ? 
            parseInt(detailData.Runtime.replace(/\D/g, '')) : null;
          const releaseYear = detailData.Year !== "N/A" ? parseInt(detailData.Year) : null;

          return {
            name: detailData.Title,
            venue: null,
            description: detailData.Plot !== "N/A" ? detailData.Plot : null,
            image_url: detailData.Poster !== "N/A" ? detailData.Poster : null,
            api_source: "omdb",
            api_ref: detailData.imdbID,
            metadata: {
              year: releaseYear,
              rated: detailData.Rated !== "N/A" ? detailData.Rated : null,
              runtime: runtime,
              genre: detailData.Genre !== "N/A" ? detailData.Genre : null,
              director: director,
              actors: detailData.Actors !== "N/A" ? detailData.Actors : null,
              imdbRating: imdbRating,
              publication_year: releaseYear,
              languages: languages,
              cast_crew: {
                director: director,
                cast: cast.slice(0, 10),
                writer: writer,
                producer: null
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
              imdb_id: detailData.imdbID,
              type: detailData.Type,
              plot: detailData.Plot !== "N/A" ? detailData.Plot : null,
              released: detailData.Released !== "N/A" ? detailData.Released : null
            }
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.Title}:`, error);
          return null;
        }
      })
    );

    const validResults = results.filter(result => result !== null);

    console.log(`✅ Returning ${validResults.length} enhanced movie results`);

    return new Response(
      JSON.stringify({ results: validResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in search-movies function:", error);
    return new Response(
      JSON.stringify({ 
        results: [],
        message: "Movie search temporarily unavailable"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
