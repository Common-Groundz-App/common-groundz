
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, limit = 20, type = 'all', mode = 'quick' } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🔍 Unified search for: "${query}" (${mode} mode)`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Use the fast unified-search-v2 function instead of individual slow calls
    console.log('🚀 Using unified-search-v2 for fast results...')
    
    const { data: unifiedData, error: unifiedError } = await supabase.functions.invoke('unified-search-v2', {
      body: { 
        query,
        limit,
        type,
        mode
      }
    })

    if (unifiedError) {
      console.error('Unified search error:', unifiedError)
      throw new Error('Unified search failed: ' + unifiedError.message)
    }

    if (!unifiedData) {
      throw new Error('No data returned from unified search')
    }

    console.log(`✅ Fast unified search completed for "${query}"`)

    // Return the data in the same format expected by the Search page
    const responseData = {
      users: unifiedData.users || [],
      entities: unifiedData.entities || [],
      reviews: unifiedData.reviews || [],
      recommendations: unifiedData.recommendations || [],
      products: unifiedData.products || [],
      categorized: unifiedData.categorized || {
        books: [],
        movies: [],
        places: []
      },
      total: unifiedData.total || 0,
      mode,
      errors: unifiedData.errors || null,
      circuit_status: unifiedData.circuit_status
    }

    console.log(`✅ Unified search results (${mode} mode):`, {
      users: responseData.users.length,
      entities: responseData.entities.length,
      reviews: responseData.reviews.length,
      recommendations: responseData.recommendations.length,
      products: responseData.products.length,
      categorized: {
        books: responseData.categorized.books.length,
        movies: responseData.categorized.movies.length,
        places: responseData.categorized.places.length
      }
    })

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in unified search:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Search failed',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
