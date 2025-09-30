
import { serve } from "std/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, maxResults = 12 } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📚 Deep searching books for: "${query}"`)

    let results = []
    let errors = []

    // Use Google Books API for comprehensive book search
    try {
      console.log('📚 Calling Google Books API for deep search...')
      const googleBooksResponse = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/search-google-books`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, maxResults: maxResults * 2 }) // Get more results for deep search
      })

      if (googleBooksResponse.ok) {
        const googleData = await googleBooksResponse.json()
        if (googleData.results && googleData.results.length > 0) {
          results = results.concat(googleData.results)
          console.log(`✅ Found ${googleData.results.length} books from Google Books (deep search)`)
        }
      } else {
        console.error('Google Books API error in deep search:', await googleBooksResponse.text())
        errors.push('Google Books API temporarily unavailable')
      }
    } catch (error) {
      console.error('Error calling Google Books API in deep search:', error)
      errors.push('Google Books deep search failed')
    }

    // For deep search, we could add more book sources here
    // Examples: Open Library API, Goodreads, etc.

    // Remove duplicates based on ISBN or title
    const uniqueResults = []
    const seenBooks = new Set()

    for (const book of results) {
      const identifier = book.isbn || book.name.toLowerCase()
      if (!seenBooks.has(identifier)) {
        seenBooks.add(identifier)
        uniqueResults.push(book)
      }
    }

    // Limit results to requested amount
    const finalResults = uniqueResults.slice(0, maxResults)

    console.log(`✅ Deep book search completed. Found ${finalResults.length} unique books`)

    return new Response(
      JSON.stringify({ 
        results: finalResults,
        total: finalResults.length,
        errors: errors.length > 0 ? errors : null,
        source: 'books_deep_search'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in deep book search:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to perform deep book search',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
