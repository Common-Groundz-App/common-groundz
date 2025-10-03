
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

    // Initialize results and error tracking
    let results = {
      users: [],
      entities: [],
      reviews: [],
      recommendations: [],
      products: [],
      categorized: {
        books: [],
        movies: [],
        places: []
      }
    }
    let errors = []

    // 1. Search local database (always fast, should not fail)
    try {
      console.log('🔍 Searching local database...')
      
      // Search entities with parent relationship data - including slug and parent slug
      const slugQuery = query.toLowerCase().trim()
      console.log('🔍 Searching entities with query:', query)
      console.log('🔍 Searching with slug query:', slugQuery)
      
      // Parent-slug subquery approach: Find parent entities by exact slug AND prefix slug
      console.log('🔍 Searching for parent entities by slug (exact + prefix):', slugQuery);
      const [exactParentResult, prefixParentResult] = await Promise.allSettled([
        // Exact parent slug match
        supabase
          .from('entities')
          .select('id')
          .eq('slug', slugQuery)
          .eq('is_deleted', false),
        // Prefix parent slug match (e.g., "skin" finds "skin1004")
        supabase
          .from('entities')
          .select('id')
          .ilike('slug', `${slugQuery}%`)
          .eq('is_deleted', false)
      ]);
      
      const parentIds: string[] = [];
      
      if (exactParentResult.status === 'fulfilled' && exactParentResult.value.data) {
        parentIds.push(...exactParentResult.value.data.map((p: any) => p.id));
      }
      
      if (prefixParentResult.status === 'fulfilled' && prefixParentResult.value.data) {
        parentIds.push(...prefixParentResult.value.data.map((p: any) => p.id));
      }
      
      // Deduplicate parent IDs
      const uniqueParentIds = [...new Set(parentIds)];
      console.log(`🔍 Found ${uniqueParentIds.length} parent entities for slug: ${slugQuery}`);
      
      // Then find children of those parents
      let childEntitiesFromParentSlug: any[] = []
      if (uniqueParentIds.length > 0) {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .in('parent_id', uniqueParentIds)
          .eq('is_deleted', false)
          .limit(limit)
        
        if (error) {
          console.error('❌ Parent-slug child query failed:', error)
        } else if (data) {
          childEntitiesFromParentSlug = data
          console.log(`🔍 Found ${childEntitiesFromParentSlug.length} child entities under those parents`)
        }
      }
      
      // Execute separate queries to avoid PostgREST .or() string issues with spaces
      const [nameResult, descResult, slugResult] = await Promise.allSettled([
        // Name match
        supabase
          .from('entities')
          .select('*')
          .ilike('name', `%${query}%`)
          .eq('is_deleted', false)
          .limit(limit),
        // Description match
        supabase
          .from('entities')
          .select('*')
          .ilike('description', `%${query}%`)
          .eq('is_deleted', false)
          .limit(limit),
        // Slug match
        supabase
          .from('entities')
          .select('*')
          .ilike('slug', `%${query}%`)
          .eq('is_deleted', false)
          .limit(limit)
      ])
      
      // Combine all search results and deduplicate by entity ID
      const allEntities: any[] = []
      
      // Add child entities from parent-slug subquery first
      allEntities.push(...childEntitiesFromParentSlug)
      
      if (nameResult.status === 'fulfilled') {
        if (nameResult.value.error) {
          console.error('❌ Name search failed:', nameResult.value.error)
        } else if (nameResult.value.data) {
          allEntities.push(...nameResult.value.data)
        }
      }
      
      if (descResult.status === 'fulfilled') {
        if (descResult.value.error) {
          console.error('❌ Description search failed:', descResult.value.error)
        } else if (descResult.value.data) {
          allEntities.push(...descResult.value.data)
        }
      }
      
      if (slugResult.status === 'fulfilled') {
        if (slugResult.value.error) {
          console.error('❌ Slug search failed:', slugResult.value.error)
        } else if (slugResult.value.data) {
          allEntities.push(...slugResult.value.data)
        }
      }
      
      // Deduplicate by entity ID
      const entityMap = new Map()
      allEntities.forEach(entity => {
        if (!entityMap.has(entity.id)) {
          entityMap.set(entity.id, entity)
        }
      })
      const entities = Array.from(entityMap.values()).slice(0, limit)
      
      // Log any rejected promises
      const entityErrors = [nameResult, descResult, slugResult]
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason)
      
      console.log(`✅ Found ${entities.length} local entities (including ${childEntitiesFromParentSlug.length} from parent-slug match)`)

      if (entityErrors.length > 0) {
        console.error('❌ Entity search rejected promises:', entityErrors)
      }

      // Search users 
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .or(`username.ilike.*${query}*,bio.ilike.*${query}*`)
        .limit(limit)
      
      if (usersError) {
        console.error('❌ User search error:', usersError)
      }

      // Search reviews
      const { data: reviews } = await supabase
        .from('reviews')
        .select(`
          id, title, content, rating, created_at,
          entities!inner(name, slug),
          profiles!inner(username, avatar_url)
        `)
        .or(`title.ilike.%${query}%, content.ilike.%${query}%`)
        .eq('status', 'published')
        .limit(limit)

      // Search recommendations  
      const { data: recommendations } = await supabase
        .from('recommendations')
        .select(`
          id, title, content, rating, category, created_at,
          entities!inner(name, slug),
          profiles!inner(username, avatar_url)
        `)
        .or(`title.ilike.%${query}%, content.ilike.%${query}%`)
        .limit(limit)

      // Process entities to include parent_slug for easier access
      results.entities = (entities || []).map((entity: any) => ({
        ...entity,
        parent_slug: entity.parent?.slug || null
      }))
      results.users = users || []
      results.reviews = (reviews || []).map(review => ({
        ...review,
        entity_name: review.entities?.name || '',
        username: review.profiles?.username || '',
        avatar_url: review.profiles?.avatar_url || null
      }))
      results.recommendations = (recommendations || []).map(rec => ({
        ...rec,
        entity_name: rec.entities?.name || '',
        username: rec.profiles?.username || '',
        avatar_url: rec.profiles?.avatar_url || null
      }))
      
      console.log(`✅ Local search: ${results.entities.length} entities, ${results.users.length} users`)
    } catch (localError) {
      console.error('Local database search failed:', localError)
      errors.push('Local search temporarily unavailable')
    }

    // 2. Search external APIs with individual error handling
    if (mode === 'quick') {
      // Books search with enhanced error handling
      try {
        console.log('📚 Searching books...')
        const bookStartTime = Date.now();
        const { data: bookData, error: bookError } = await supabase.functions.invoke('search-google-books', {
          body: { query, maxResults: 8 }
        })
        const bookDuration = Date.now() - bookStartTime;
        
        if (bookError) {
          console.error('Book search error:', bookError)
          errors.push('Book search temporarily unavailable')
        } else if (bookData?.results) {
          results.categorized.books = bookData.results
          console.log(`📚 Found ${bookData.results.length} books (${bookDuration}ms)`)
        }
      } catch (bookError) {
        console.error('Book search failed:', bookError)
        errors.push('Book search temporarily unavailable')
      }

      // Movies search
      try {
        console.log('🎬 Searching movies...')
        const movieStartTime = Date.now();
        const { data: movieData, error: movieError } = await supabase.functions.invoke('search-movies', {
          body: { query, maxResults: 5 }
        })
        const movieDuration = Date.now() - movieStartTime;
        
        if (movieError) {
          console.error('Movie search error:', movieError)
          errors.push('Movie search temporarily unavailable')
        } else if (movieData?.results) {
          results.categorized.movies = movieData.results
          console.log(`🎬 Found ${movieData.results.length} movies (${movieDuration}ms)`)
        }
      } catch (movieError) {
        console.error('Movie search failed:', movieError)
        errors.push('Movie search temporarily unavailable')
      }

      // Places search
      try {
        console.log('📍 Searching places...')
        const placeStartTime = Date.now();
        const { data: placeData, error: placeError } = await supabase.functions.invoke('search-places', {
          body: { query, maxResults: 20 }
        })
        const placeDuration = Date.now() - placeStartTime;
        
        if (placeError) {
          console.error('Place search error:', placeError)
          errors.push('Place search temporarily unavailable')
        } else if (placeData?.results) {
          results.categorized.places = placeData.results
          console.log(`📍 Found ${placeData.results.length} places (${placeDuration}ms)`)
        }
      } catch (placeError) {
        console.error('Place search failed:', placeError)
        errors.push('Place search temporarily unavailable')
      }
    } else if (mode === 'deep') {
      // Deep search mode - more comprehensive but slower
      const promises = []

      // Books deep search
      promises.push(
        supabase.functions.invoke('search-books-deep', { body: { query, maxResults: 12 } })
          .then(({ data, error }) => {
            if (error) {
              console.error('Deep book search error:', error)
              errors.push('Deep book search temporarily unavailable')
            } else if (data?.results) {
              results.categorized.books = data.results
            }
          })
          .catch(err => {
            console.error('Deep book search failed:', err)
            errors.push('Deep book search temporarily unavailable')
          })
      )

      // Movies deep search
      promises.push(
        supabase.functions.invoke('search-movies-deep', { body: { query, maxResults: 10 } })
          .then(({ data, error }) => {
            if (error) {
              console.error('Deep movie search error:', error)
              errors.push('Deep movie search temporarily unavailable')
            } else if (data?.results) {
              results.categorized.movies = data.results
            }
          })
          .catch(err => {
            console.error('Deep movie search failed:', err)
            errors.push('Deep movie search temporarily unavailable')
          })
      )

      // Places deep search
      promises.push(
        supabase.functions.invoke('search-places-deep', { body: { query, maxResults: 30 } })
          .then(({ data, error }) => {
            if (error) {
              console.error('Deep place search error:', error)
              errors.push('Deep place search temporarily unavailable')  
            } else if (data?.results) {
              results.categorized.places = data.results
            }
          })
          .catch(err => {
            console.error('Deep place search failed:', err)
            errors.push('Deep place search temporarily unavailable')
          })
      )

      // Wait for all deep searches to complete
      await Promise.all(promises)
    }

    // Combine all products for backwards compatibility
    results.products = [
      ...results.categorized.books,
      ...results.categorized.movies,
      ...results.categorized.places
    ]

    const totalExternalResults = results.products.length
    console.log(`✅ ${mode.charAt(0).toUpperCase() + mode.slice(1)} search found ${totalExternalResults} total external results`)
    console.log(`🎬 Found ${results.categorized.movies.length} movie results`)
    console.log(`📚 Found ${results.categorized.books.length} book results`)
    console.log(`📍 Found ${results.categorized.places.length} place results`)

    // Log any errors that occurred
    if (errors.length > 0) {
      console.log(`⚠️ Search completed with ${errors.length} errors:`, errors);
    }

    const responseData = {
      ...results,
      total: totalExternalResults,
      mode,
      errors: errors.length > 0 ? errors : null
    }

    console.log(`✅ Unified search results (${mode} mode):`, {
      users: results.users.length,
      entities: results.entities.length,
      reviews: results.reviews.length,
      recommendations: results.recommendations.length,
      products: results.products.length,
      categorized: {
        books: results.categorized.books.length,
        movies: results.categorized.movies.length,
        places: results.categorized.places.length
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
