
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
    url.searchParams.append("limit", "10");

    const response = await fetch(url.toString());
    const data = await response.json();

    console.log(`📖 Open Library returned ${data.docs?.length || 0} results`);

    // Format results to fit externalResults format with enhanced metadata
    const results = (data.docs || []).slice(0, 5).map((book: any) => {
      // Extract authors
      const authors = book.author_name ? 
        (Array.isArray(book.author_name) ? book.author_name : [book.author_name]) : 
        [];

      // Extract description - try multiple fields
      const description = book.first_sentence ? 
        (typeof book.first_sentence === "string" ? book.first_sentence : 
         (Array.isArray(book.first_sentence) ? book.first_sentence[0] : "")) :
        (book.subtitle || "");

      // Extract publication info
      const publicationYear = book.first_publish_year || 
        (book.publish_year && book.publish_year.length > 0 ? Math.min(...book.publish_year) : null);

      // Extract ISBN
      const isbn = book.isbn ? (Array.isArray(book.isbn) ? book.isbn[0] : book.isbn) : null;

      // Extract languages
      const languages = book.language ? 
        (Array.isArray(book.language) ? book.language : [book.language]) : 
        [];

      // Extract publisher
      const publisher = book.publisher ? 
        (Array.isArray(book.publisher) ? book.publisher[0] : book.publisher) : 
        null;

      // Extract subjects/genres
      const subjects = book.subject ? 
        (Array.isArray(book.subject) ? book.subject.slice(0, 5) : [book.subject]) : 
        [];

      const result = {
        name: book.title,
        venue: authors.length > 0 ? authors.join(", ") : "Unknown Author",
        description: description || null,
        image_url: book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : null,
        api_source: "openlibrary",
        api_ref: book.key,
        metadata: {
          // Basic metadata
          publish_year: publicationYear,
          edition_count: book.edition_count,
          language: languages,
          isbn: isbn,
          publisher: publisher,
          
          // Enhanced metadata for entity creation
          authors: authors,
          publication_year: publicationYear,
          subjects: subjects,
          page_count: book.number_of_pages_median || null,
          
          // Additional Open Library specific data
          oclc: book.oclc,
          lccn: book.lccn,
          has_fulltext: book.has_fulltext || false,
          public_scan: book.public_scan_b || false,
          lending_edition: book.lending_edition_s || null,
          lending_identifier: book.lending_identifier_s || null,
          
          // Rating information if available
          ratings_average: book.ratings_average || null,
          ratings_count: book.ratings_count || null,
          
          // Additional descriptive fields
          subtitle: book.subtitle || null,
          by_statement: book.by_statement || null,
          publish_place: book.publish_place ? 
            (Array.isArray(book.publish_place) ? book.publish_place : [book.publish_place]) : 
            null
        }
      };
      
      console.log(`📗 Enhanced book result:`, {
        title: result.name,
        authors: authors.length,
        hasISBN: !!isbn,
        publicationYear: publicationYear,
        subjects: subjects.length
      });
      
      return result;
    });

    console.log(`✅ Returning ${results.length} enhanced book results`);

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
