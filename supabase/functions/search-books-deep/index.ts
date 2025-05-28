
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
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📚 Deep book search for: "${query}"`);

    const results = [];

    // Search Google Books API for comprehensive book data
    try {
      const googleBooksApiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY");
      const url = googleBooksApiKey 
        ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${googleBooksApiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`;
      
      console.log("📚 Searching Google Books API...");
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          for (const item of data.items) {
            const volumeInfo = item.volumeInfo;
            results.push({
              name: volumeInfo.title,
              venue: volumeInfo.authors ? volumeInfo.authors.join(', ') : 'Unknown Author',
              description: volumeInfo.description ? 
                volumeInfo.description.substring(0, 200) + (volumeInfo.description.length > 200 ? '...' : '') :
                `Book by ${volumeInfo.authors?.join(', ') || 'Unknown Author'}`,
              image_url: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail,
              api_source: 'google_books',
              api_ref: item.id,
              type: 'book',
              metadata: {
                authors: volumeInfo.authors,
                publisher: volumeInfo.publisher,
                published_date: volumeInfo.publishedDate,
                page_count: volumeInfo.pageCount,
                categories: volumeInfo.categories,
                average_rating: volumeInfo.averageRating,
                ratings_count: volumeInfo.ratingsCount,
                isbn: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier,
                language: volumeInfo.language
              }
            });
          }
          console.log(`✅ Found ${results.length} books from Google Books`);
        }
      }
    } catch (error) {
      console.error('Google Books API error:', error);
    }

    // Search Open Library as backup
    try {
      if (results.length < 8) {
        console.log("📚 Searching Open Library...");
        const openLibResponse = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`
        );
        
        if (openLibResponse.ok) {
          const openLibData = await openLibResponse.json();
          if (openLibData.docs) {
            for (const book of openLibData.docs.slice(0, 8 - results.length)) {
              // Avoid duplicates
              const alreadyExists = results.some(r => 
                r.name.toLowerCase() === book.title?.toLowerCase() &&
                r.venue.toLowerCase().includes(book.author_name?.[0]?.toLowerCase() || '')
              );
              
              if (!alreadyExists && book.title) {
                const coverUrl = book.cover_i ? 
                  `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null;
                
                results.push({
                  name: book.title,
                  venue: book.author_name ? book.author_name.slice(0, 2).join(', ') : 'Unknown Author',
                  description: book.first_sentence ? 
                    book.first_sentence.join(' ').substring(0, 200) + '...' :
                    `Book published in ${book.first_publish_year || 'Unknown Year'}`,
                  image_url: coverUrl,
                  api_source: 'open_library',
                  api_ref: book.key,
                  type: 'book',
                  metadata: {
                    authors: book.author_name,
                    first_publish_year: book.first_publish_year,
                    publisher: book.publisher?.[0],
                    subject: book.subject?.slice(0, 5),
                    isbn: book.isbn?.[0],
                    language: book.language?.[0]
                  }
                });
              }
            }
            console.log(`✅ Found ${results.length} total books including Open Library`);
          }
        }
      }
    } catch (error) {
      console.error('Open Library API error:', error);
    }

    return new Response(
      JSON.stringify({ results: results.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-books-deep:", error);
    return new Response(
      JSON.stringify({ error: error.message, results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
