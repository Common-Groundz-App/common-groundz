
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, maxResults = 8 } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📚 Searching books for: "${query}"`)

    let results = []
    let errors = []

    // Try Google Books API as the primary source
    try {
      console.log('📚 Calling Google Books API...')
      const googleBooksResponse = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/search-google-books`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, maxResults })
      })

      if (googleBooksResponse.ok) {
        const googleData = await googleBooksResponse.json()
        if (googleData.results && googleData.results.length > 0) {
          results = results.concat(googleData.results)
          console.log(`✅ Found ${googleData.results.length} books from Google Books`)
        }
      } else {
        console.error('Google Books API error:', await googleBooksResponse.text())
        errors.push('Google Books API temporarily unavailable')
      }
    } catch (error) {
      console.error('Error calling Google Books API:', error)
      errors.push('Google Books search failed')
    }

    // If we don't have enough results, we could add other book APIs here in the future
    if (results.length < 3) {
      console.log(`📚 Only found ${results.length} books, could use additional sources`)
    }

    // Limit results to requested amount
    results = results.slice(0, maxResults)

    console.log(`✅ Book search completed. Found ${results.length} total books`)

    return new Response(
      JSON.stringify({ 
        results,
        total: results.length,
        errors: errors.length > 0 ? errors : null,
        source: 'books_search'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in book search:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search books',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
