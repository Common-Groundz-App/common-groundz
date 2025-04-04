
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

    // Using OMDB API for movie search
    const url = new URL("http://www.omdbapi.com/");
    url.searchParams.append("s", query); // Search by title
    url.searchParams.append("type", "movie");
    url.searchParams.append("apikey", OMDB_API_KEY);
    
    console.log(`Searching movies for query: ${query}`);
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (data.Response === "False") {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the response to match our entity structure
    const results = await Promise.all(
      data.Search.map(async (movie: any) => {
        // For each movie, get detailed info
        const detailUrl = new URL("http://www.omdbapi.com/");
        detailUrl.searchParams.append("i", movie.imdbID);
        detailUrl.searchParams.append("apikey", OMDB_API_KEY);
        
        const detailResponse = await fetch(detailUrl.toString());
        const detailData = await detailResponse.json();
        
        return {
          name: detailData.Title,
          venue: null,
          description: detailData.Plot,
          image_url: detailData.Poster !== "N/A" ? detailData.Poster : null,
          api_source: "omdb",
          api_ref: detailData.imdbID,
          metadata: {
            year: detailData.Year,
            rated: detailData.Rated,
            runtime: detailData.Runtime,
            genre: detailData.Genre,
            director: detailData.Director,
            actors: detailData.Actors,
            imdbRating: detailData.imdbRating
          }
        };
      })
    );

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-movies function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
