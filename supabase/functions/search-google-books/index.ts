
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    language?: string;
    averageRating?: number;
    ratingsCount?: number;
  };
}

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
  totalItems: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, maxResults = 10 } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📚 Searching Google Books for: "${query}"`)

    // Google Books API endpoint
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&langRestrict=en`
    
    const response = await fetch(googleBooksUrl)
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data: GoogleBooksResponse = await response.json()
    
    if (!data.items || data.items.length === 0) {
      console.log(`No books found for query: "${query}"`)
      return new Response(
        JSON.stringify({ results: [], total: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Transform Google Books data to our format
    const transformedResults = data.items.map((item: GoogleBooksItem) => {
      const volumeInfo = item.volumeInfo
      
      // Get ISBN (prefer ISBN-13, fallback to ISBN-10)
      let isbn = ''
      if (volumeInfo.industryIdentifiers) {
        const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13')
        const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10')
        isbn = isbn13?.identifier || isbn10?.identifier || ''
      }

      return {
        id: item.id,
        name: volumeInfo.title,
        authors: volumeInfo.authors || [],
        description: volumeInfo.description || '',
        image_url: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || 
                   volumeInfo.imageLinks?.smallThumbnail?.replace('http:', 'https:') || '',
        publication_year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.split('-')[0]) : null,
        isbn: isbn,
        api_source: 'google_books',
        api_ref: item.id,
        type: 'book',
        venue: volumeInfo.authors?.[0] || '',
        specifications: {
          publisher: volumeInfo.publisher,
          page_count: volumeInfo.pageCount,
          language: volumeInfo.language || 'en',
          categories: volumeInfo.categories || []
        },
        external_ratings: volumeInfo.averageRating ? {
          google_books: volumeInfo.averageRating,
          google_books_count: volumeInfo.ratingsCount || 0
        } : {},
        metadata: {
          google_books_id: item.id,
          published_date: volumeInfo.publishedDate,
          rating_count: volumeInfo.ratingsCount || 0
        }
      }
    })

    console.log(`✅ Found ${transformedResults.length} books from Google Books`)

    return new Response(
      JSON.stringify({ 
        results: transformedResults,
        total: data.totalItems,
        source: 'google_books'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in Google Books search:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search Google Books',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
