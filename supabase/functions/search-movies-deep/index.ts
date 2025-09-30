
import { serve } from "std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎬 Deep movie search for: "${query}"`);

    const results = [];

    // Search OMDB API for comprehensive movie data
    try {
      const omdbApiKey = Deno.env.get("OMDB_API_KEY");
      if (omdbApiKey) {
        console.log("🎬 Searching OMDB API...");
        const omdbResponse = await fetch(
          `http://www.omdbapi.com/?apikey=${omdbApiKey}&s=${encodeURIComponent(query)}&type=movie&page=1`
        );
        
        if (omdbResponse.ok) {
          const omdbData = await omdbResponse.json();
          if (omdbData.Search) {
            for (const movie of omdbData.Search.slice(0, 5)) {
              // Get detailed info for each movie
              const detailResponse = await fetch(
                `http://www.omdbapi.com/?apikey=${omdbApiKey}&i=${movie.imdbID}&plot=full`
              );
              
              if (detailResponse.ok) {
                const detail = await detailResponse.json();
                results.push({
                  name: detail.Title,
                  venue: `${detail.Year} • ${detail.Director || 'Unknown Director'}`,
                  description: detail.Plot || `${detail.Genre} movie starring ${detail.Actors}`,
                  image_url: detail.Poster !== 'N/A' ? detail.Poster : null,
                  api_source: 'omdb',
                  api_ref: detail.imdbID,
                  type: 'movie',
                  metadata: {
                    year: detail.Year,
                    director: detail.Director,
                    actors: detail.Actors,
                    genre: detail.Genre,
                    imdb_rating: detail.imdbRating,
                    runtime: detail.Runtime,
                    plot: detail.Plot
                  }
                });
              }
            }
            console.log(`✅ Found ${results.length} movies from OMDB`);
          }
        }
      }
    } catch (error) {
      console.error('OMDB API error:', error);
    }

    // Search TMDb as backup/additional source
    try {
      const tmdbApiKey = Deno.env.get("TMDB_API_KEY");
      if (tmdbApiKey && results.length < 8) {
        console.log("🎬 Searching TMDb API...");
        const tmdbResponse = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(query)}&page=1`
        );
        
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();
          if (tmdbData.results) {
            for (const movie of tmdbData.results.slice(0, 8 - results.length)) {
              // Avoid duplicates by checking if we already have this movie
              const alreadyExists = results.some(r => 
                r.name.toLowerCase() === movie.title.toLowerCase() && 
                r.metadata?.year === movie.release_date?.substring(0, 4)
              );
              
              if (!alreadyExists) {
                results.push({
                  name: movie.title,
                  venue: `${movie.release_date?.substring(0, 4) || 'Unknown Year'} • TMDb`,
                  description: movie.overview || `Movie released in ${movie.release_date?.substring(0, 4)}`,
                  image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                  api_source: 'tmdb',
                  api_ref: movie.id.toString(),
                  type: 'movie',
                  metadata: {
                    year: movie.release_date?.substring(0, 4),
                    popularity: movie.popularity,
                    vote_average: movie.vote_average,
                    vote_count: movie.vote_count,
                    overview: movie.overview
                  }
                });
              }
            }
            console.log(`✅ Found ${results.length} total movies including TMDb`);
          }
        }
      }
    } catch (error) {
      console.error('TMDb API error:', error);
    }

    return new Response(
      JSON.stringify({ results: results.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-movies-deep:", error);
    return new Response(
      JSON.stringify({ error: error.message, results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
