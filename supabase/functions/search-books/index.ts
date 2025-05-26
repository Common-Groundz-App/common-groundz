
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📚 Searching for books with query: "${query}"`);

    // Use Open Library public API for books
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.append("q", query);

    const response = await fetch(url.toString());
    const data = await response.json();

    console.log(`📖 Open Library returned ${data.docs?.length || 0} results`);

    // Format results to fit externalResults format
    const results = (data.docs || []).slice(0, 5).map((book: any) => {
      const result = {
        name: book.title,
        venue: book.author_name ? (Array.isArray(book.author_name) ? book.author_name.join(", ") : book.author_name) : "Unknown Author",
        description: book.first_sentence ? (
          typeof book.first_sentence === "string"
            ? book.first_sentence
            : (Array.isArray(book.first_sentence) ? book.first_sentence[0] : "")
        ) : null,
        image_url: book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : null,
        api_source: "openlibrary",
        api_ref: book.key,
        metadata: {
          publish_year: book.first_publish_year,
          edition_count: book.edition_count,
          subjects: book.subject,
          language: book.language,
          isbn: book.isbn ? book.isbn[0] : null,
          publisher: book.publisher ? (Array.isArray(book.publisher) ? book.publisher[0] : book.publisher) : null
        }
      };
      
      console.log(`📗 Formatted book result:`, result);
      return result;
    });

    console.log(`✅ Returning ${results.length} formatted book results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in search-books:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
