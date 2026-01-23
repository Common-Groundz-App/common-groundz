import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Circuit breaker for external APIs
const circuitBreaker = {
  books: { failures: 0, lastFailure: 0, isOpen: false },
  movies: { failures: 0, lastFailure: 0, isOpen: false },
  places: { failures: 0, lastFailure: 0, isOpen: false }
}

const FAILURE_THRESHOLD = 3
const RECOVERY_TIME = 60000 // 1 minute

function isCircuitOpen(service: keyof typeof circuitBreaker): boolean {
  const circuit = circuitBreaker[service]
  if (circuit.failures >= FAILURE_THRESHOLD) {
    if (Date.now() - circuit.lastFailure > RECOVERY_TIME) {
      circuit.failures = 0
      circuit.isOpen = false
    } else {
      circuit.isOpen = true
    }
  }
  return circuit.isOpen
}

function recordFailure(service: keyof typeof circuitBreaker) {
  const circuit = circuitBreaker[service]
  circuit.failures++
  circuit.lastFailure = Date.now()
}

function recordSuccess(service: keyof typeof circuitBreaker) {
  circuitBreaker[service].failures = 0
}

// Smart image URL processor with Google Books and Movie Image proxies
function processImageUrl(originalUrl: string, entityType: string): string {
  if (!originalUrl) {
    return getEntityTypeFallbackImage(entityType)
  }
  
  console.log('Processing image URL:', originalUrl, 'for type:', entityType);
  
  // For Google Places images, use our proxy
  if (originalUrl.includes('maps.googleapis.com/maps/api/place/photo')) {
    const url = new URL(originalUrl);
    const photoReference = url.searchParams.get('photoreference');
    const maxWidth = url.searchParams.get('maxwidth') || '400';
    
    if (photoReference) {
      console.log('Using proxy for Google Places image:', photoReference);
      return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${photoReference}&maxWidth=${maxWidth}`;
    }
  }
  
  // For Google Books images, use our proxy
  if (originalUrl.includes('books.google.com/books/content')) {
    // First convert to HTTPS if needed
    let httpsUrl = originalUrl;
    if (originalUrl.startsWith('http://')) {
      httpsUrl = originalUrl.replace('http://', 'https://');
    }
    
    console.log('Using proxy for Google Books image:', httpsUrl);
    return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-books?url=${encodeURIComponent(httpsUrl)}`;
  }
  
  // For movie images from Amazon (OMDB), use our proxy
  if (originalUrl.includes('m.media-amazon.com') || originalUrl.includes('images-amazon.com')) {
    // Convert to HTTPS if needed
    let httpsUrl = originalUrl;
    if (originalUrl.startsWith('http://')) {
      httpsUrl = originalUrl.replace('http://', 'https://');
    }
    
    console.log('Using proxy for movie image:', httpsUrl);
    return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-movie-image?url=${encodeURIComponent(httpsUrl)}`;
  }
  
  // Block domains that cause CORS issues (excluding Google Books and Amazon movies now that we proxy them)
  const definitivelyBlockedDomains = [
    'googleusercontent.com',  // These definitely cause CORS issues
    'covers.openlibrary.org'  // Known to be unreliable
  ];
  
  if (definitivelyBlockedDomains.some(domain => originalUrl.includes(domain))) {
    console.log('Blocking CORS-problematic domain:', originalUrl);
    return getEntityTypeFallbackImage(entityType);
  }
  
  // For all other URLs, try to ensure HTTPS
  let secureUrl = originalUrl;
  if (originalUrl.startsWith('http://')) {
    secureUrl = originalUrl.replace('http://', 'https://');
    console.log('Converted to HTTPS:', secureUrl);
  }
  
  return secureUrl;
}

function getEntityTypeFallbackImage(entityType: string): string {
  const fallbacks = {
    book: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000',
    movie: 'https://images.unsplash.com/photo-1489590528505-98d2b5aba04b?auto=format&fit=crop&q=80&w=1000',
    place: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1000',
    default: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000'
  }
  return fallbacks[entityType as keyof typeof fallbacks] || fallbacks.default
}

// Normalize search query to handle special characters (dots, spaces, hyphens)
function normalizeSearchQuery(query: string): string[] {
  const variations = new Set<string>()
  const normalized = query.toLowerCase().trim()
  
  // Add original query
  variations.add(normalized)
  
  // Add version with spaces/dots/hyphens removed (snature)
  variations.add(normalized.replace(/[\s.-]/g, ''))
  
  // Add version with spaces/dots converted to hyphens (s-nature)
  variations.add(normalized.replace(/[\s.]/g, '-'))
  
  // Add version with hyphens/spaces converted to dots (s.nature)
  variations.add(normalized.replace(/[\s-]/g, '.'))
  
  // Add version with hyphens/dots converted to spaces (s nature)
  variations.add(normalized.replace(/[-.]/g, ' '))
  
  // Handle single-letter prefixes (e.g., "snature" → "s-nature", "s.nature")
  if (normalized.length > 1 && !/[\s.-]/.test(normalized)) {
    // If query has no separators, try adding them after first character
    // This handles brands like "S.NATURE", "L'OREAL", etc.
    const firstChar = normalized.charAt(0)
    const rest = normalized.slice(1)
    
    variations.add(`${firstChar}-${rest}`)  // "s-nature"
    variations.add(`${firstChar}.${rest}`)  // "s.nature"
    variations.add(`${firstChar} ${rest}`)  // "s nature"
  }
  
  return Array.from(variations)
}

// Enhanced search functions with timeout and error handling
async function searchBooks(query: string, maxResults: number = 8) {
  if (isCircuitOpen('books')) {
    console.log('Books circuit breaker is open, skipping search')
    return []
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const googleBooksApiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY")
    let googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&langRestrict=en`
    
    if (googleBooksApiKey) {
      googleBooksUrl += `&key=${googleBooksApiKey}`
    }
    
    const response = await fetch(googleBooksUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Supabase Edge Function/1.0' }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.items?.length) {
      return []
    }

    const results = data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo
      
      return {
        id: item.id,
        name: volumeInfo.title,
        authors: volumeInfo.authors || [],
        description: volumeInfo.description || '',
        image_url: processImageUrl(volumeInfo.imageLinks?.thumbnail || '', 'book'),
        publication_year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.split('-')[0]) : null,
        isbn: volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || '',
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

    recordSuccess('books')
    console.log(`✅ Found ${results.length} books from Google Books`)
    return results

  } catch (error) {
    recordFailure('books')
    console.error('Books search failed:', error.message)
    return []
  }
}

async function searchMovies(query: string, maxResults: number = 5) {
  if (isCircuitOpen('movies')) {
    console.log('Movies circuit breaker is open, skipping search')
    return []
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const omdbApiKey = Deno.env.get("OMDB_API_KEY")
    if (!omdbApiKey) {
      console.log('OMDB API key not available, skipping movie search')
      return []
    }
    
    const response = await fetch(
      `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&type=movie&apikey=${omdbApiKey}`,
      { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Supabase Edge Function/1.0' }
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`OMDB API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.Response === "False" || !data.Search?.length) {
      return []
    }

    const results = data.Search.slice(0, maxResults).map((movie: any) => ({
      id: movie.imdbID,
      name: movie.Title,
      description: `${movie.Type} from ${movie.Year}`,
      image_url: processImageUrl(movie.Poster !== 'N/A' ? movie.Poster : '', 'movie'),
      api_source: 'omdb',
      api_ref: movie.imdbID,
      type: 'movie',
      venue: movie.Year,
      metadata: {
        year: movie.Year,
        type: movie.Type,
        imdb_id: movie.imdbID
      }
    }))

    recordSuccess('movies')
    console.log(`✅ Found ${results.length} movies from OMDB`)
    return results

  } catch (error) {
    recordFailure('movies')
    console.error('Movies search failed:', error.message)
    return []
  }
}

async function searchPlaces(query: string, maxResults: number = 20) {
  if (isCircuitOpen('places')) {
    console.log('Places circuit breaker is open, skipping search')
    return []
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const googlePlacesApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")
    if (!googlePlacesApiKey) {
      console.log('Google Places API key not available, skipping places search')
      return []
    }
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googlePlacesApiKey}`,
      { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Supabase Edge Function/1.0' }
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.status !== 'OK' || !data.results?.length) {
      return []
    }

    const results = data.results.slice(0, maxResults).map((place: any) => {
      let imageUrl = getEntityTypeFallbackImage('place')
      
      // Use our proxy for Google Places photos
      if (place.photos?.[0]?.photo_reference) {
        imageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${place.photos[0].photo_reference}&maxWidth=400`
      }

      return {
        id: place.place_id,
        name: place.name,
        description: place.formatted_address,
        image_url: imageUrl,
        api_source: 'google_places',
        api_ref: place.place_id,
        type: 'place',
        venue: place.formatted_address,
        metadata: {
          rating: place.rating,
          price_level: place.price_level,
          types: place.types,
          user_ratings_total: place.user_ratings_total,
          vicinity: place.vicinity,
          place_id: place.place_id,
          photo_reference: place.photos?.[0]?.photo_reference
        }
      }
    })

    recordSuccess('places')
    console.log(`✅ Found ${results.length} places from Google Places`)
    return results

  } catch (error) {
    recordFailure('places')
    console.error('Places search failed:', error.message)
    return []
  }
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

    console.log(`🔍 Enhanced unified search for: "${query}" (${mode} mode)`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Initialize results
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

    // 1. Search local database with prioritized slug matching
    try {
      console.log('🔍 Searching local database with slug priority...')
      
      // First: Search for exact and prefix slug matches (highest priority)
      // Also search parent slugs to find child products by brand name
      const searchVariations = normalizeSearchQuery(query)
      console.log('🔍 Search variations:', searchVariations)
      
      // Execute queries for all search variations
      const slugSearchPromises = searchVariations.flatMap(variation => [
        // Exact slug match
        supabase
          .from('entities')
          .select('*, parent_id')
          .eq('slug', variation)
          .eq('is_deleted', false)
          .limit(limit),
        // Prefix slug match
        supabase
          .from('entities')
          .select('*, parent_id')
          .ilike('slug', `${variation}%`)
          .eq('is_deleted', false)
          .limit(limit)
      ])
      
      const slugSearchResults = await Promise.allSettled(slugSearchPromises)
      
      // Parent-slug subquery approach: Find parent entities using all variations
      console.log('🔍 Searching for parent entities using variations')
      const parentSearchPromises = searchVariations.flatMap(variation => [
        // Exact parent slug match
        supabase
          .from('entities')
          .select('id')
          .eq('slug', variation)
          .eq('is_deleted', false),
        // Prefix parent slug match (e.g., "skin" finds "skin1004")
        supabase
          .from('entities')
          .select('id')
          .ilike('slug', `${variation}%`)
          .eq('is_deleted', false)
      ])
      
      const parentSearchResults = await Promise.allSettled(parentSearchPromises)
      
      const parentIds: string[] = []
      parentSearchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data) {
          parentIds.push(...result.value.data.map((p: any) => p.id))
        }
      })
      
      // Deduplicate parent IDs
      const uniqueParentIds = [...new Set(parentIds)]
      console.log(`🔍 Found ${uniqueParentIds.length} parent entities from variations`)
      
      // Then find children of those parents
      let childEntities: any[] = []
      if (uniqueParentIds.length > 0) {
        const { data, error } = await supabase
          .from('entities')
          .select('*, parent_id')
          .in('parent_id', uniqueParentIds)
          .eq('is_deleted', false)
          .limit(limit)
        
        if (error) {
          console.error('❌ Parent-slug child query failed:', error)
        } else if (data) {
          childEntities = data
          console.log(`🔍 Found ${childEntities.length} child entities under those parents`)
        }
      }
      
      // Combine all slug search results
      const slugEntities: any[] = []
      
      slugSearchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            console.error('❌ Slug search failed:', result.value.error)
          } else if (result.value.data) {
            slugEntities.push(...result.value.data)
          }
        }
      })
      
      // Add child entities from parent-slug subquery
      slugEntities.push(...childEntities)
      
      // Log any rejected promises
      const slugErrors = slugSearchResults
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason)
      if (slugErrors.length > 0) {
        console.error('❌ Slug search rejected promises:', slugErrors)
      }
      
      // Deduplicate slug entities by ID
      const uniqueSlugEntities = Array.from(
        new Map(slugEntities.map(entity => [entity.id, entity])).values()
      )
      
      console.log(`✅ Found ${uniqueSlugEntities.length} unique slug-based entities (from ${slugEntities.length} total matches)`)
      
      // Second: Search for broader matches in name, description, slug using all variations
      console.log('🔍 Searching with broad queries using variations')
      
      // Execute queries for all search variations
      const broadSearchPromises = searchVariations.flatMap(variation => [
        // Name match
        supabase
          .from('entities')
          .select('*, parent_id')
          .ilike('name', `%${variation}%`)
          .eq('is_deleted', false)
          .limit(limit),
        // Description match
        supabase
          .from('entities')
          .select('*, parent_id')
          .ilike('description', `%${variation}%`)
          .eq('is_deleted', false)
          .limit(limit),
        // Slug match
        supabase
          .from('entities')
          .select('*, parent_id')
          .ilike('slug', `%${variation}%`)
          .eq('is_deleted', false)
          .limit(limit)
      ])
      
      const broadSearchResults = await Promise.allSettled(broadSearchPromises)
      
      // Combine all broad search results with proper error checking
      const broadEntities: any[] = []
      
      broadSearchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            console.error('❌ Broad search failed:', result.value.error)
          } else if (result.value.data) {
            broadEntities.push(...result.value.data)
          }
        }
      })
      
      // Log any rejected promises
      const broadErrors = broadSearchResults
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason)
      if (broadErrors.length > 0) {
        console.error('❌ Broad search rejected promises:', broadErrors)
      }
      
      // Deduplicate broad entities by ID
      const uniqueBroadEntities = Array.from(
        new Map(broadEntities.map(entity => [entity.id, entity])).values()
      )
      
      console.log(`✅ Found ${uniqueBroadEntities.length} unique broad-match entities (from ${broadEntities.length} total matches)`)
      
      // Merge results: slug matches first, then broad matches (deduplicated)
      const slugEntityIds = new Set(uniqueSlugEntities.map((e: any) => e.id))
      const mergedEntities = [
        ...uniqueSlugEntities,
        ...uniqueBroadEntities.filter((e: any) => !slugEntityIds.has(e.id))
      ].slice(0, limit)
      
      console.log(`🎯 Found ${uniqueSlugEntities.length} unique slug matches, ${uniqueBroadEntities.length} unique broad matches, ${mergedEntities.length} total merged`)
      
      // Hydrate parent slugs for entities with parent_id
      async function hydrateParents(entities: any[]) {
        const parentIds = [...new Set(
          entities
            .map(e => e.parent_id)
            .filter(id => id != null)
        )]
        
        if (parentIds.length === 0) {
          return entities.map(e => ({ ...e, parent_slug: null }))
        }
        
        console.log(`🔄 Hydrating ${parentIds.length} parent entities...`)
        
        const { data: parents, error } = await supabase
          .from('entities')
          .select('id, slug')
          .in('id', parentIds)
        
        if (error) {
          console.error('❌ Failed to hydrate parents:', error)
          return entities.map(e => ({ ...e, parent_slug: null }))
        }
        
        const parentMap = new Map(parents.map(p => [p.id, p]))
        
        return entities.map(entity => ({
          ...entity,
          parent_slug: entity.parent_id ? parentMap.get(entity.parent_id)?.slug || null : null
        }))
      }
      
      const hydratedEntities = await hydrateParents(mergedEntities)
      
      // Search other tables in parallel
      const [usersResult, reviewsResult, recommendationsResult] = await Promise.allSettled([
        supabase.from('profiles').select('id, username, avatar_url, bio').or(`username.ilike.%${query}%, bio.ilike.%${query}%`).limit(limit),
        supabase.from('reviews').select(`id, title, description, rating, created_at, user_id, entities!inner(name, slug)`).or(`title.ilike.%${query}%, description.ilike.%${query}%`).eq('status', 'published').limit(limit),
        supabase.from('recommendations').select(`id, title, description, rating, category, created_at, user_id, entities!inner(name, slug)`).or(`title.ilike.%${query}%, description.ilike.%${query}%`).limit(limit)
      ])

      // Collect unique user IDs from reviews and recommendations
      const reviews = reviewsResult.status === 'fulfilled' && reviewsResult.value.data ? reviewsResult.value.data : []
      const recommendations = recommendationsResult.status === 'fulfilled' && recommendationsResult.value.data ? recommendationsResult.value.data : []
      
      const userIds = new Set<string>()
      reviews.forEach((r: any) => r.user_id && userIds.add(r.user_id))
      recommendations.forEach((r: any) => r.user_id && userIds.add(r.user_id))

      // Only fetch profiles if we have user IDs (avoid Supabase .in() error with empty array)
      let profilesMap = new Map()
      if (userIds.size > 0) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', Array.from(userIds))
        
        profilesMap = new Map(userProfiles?.map((p: any) => [p.id, p]) || [])
      }

      // Set hydrated entity results
      results.entities = hydratedEntities
      
      if (usersResult.status === 'fulfilled') {
        if (usersResult.value.error) {
          console.error('❌ Users search failed:', usersResult.value.error)
        } else if (usersResult.value.data) {
          results.users = usersResult.value.data
        }
      }
      if (reviewsResult.status === 'fulfilled') {
        if (reviewsResult.value.error) {
          console.error('❌ Reviews search failed:', reviewsResult.value.error)
        } else if (reviewsResult.value.data) {
          results.reviews = reviewsResult.value.data.map((review: any) => ({
            ...review,
            entity_name: review.entities?.name || '',
            username: profilesMap.get(review.user_id)?.username || '',
            avatar_url: profilesMap.get(review.user_id)?.avatar_url || null
          }))
        }
      }
      if (recommendationsResult.status === 'fulfilled') {
        if (recommendationsResult.value.error) {
          console.error('❌ Recommendations search failed:', recommendationsResult.value.error)
        } else if (recommendationsResult.value.data) {
          results.recommendations = recommendationsResult.value.data.map((rec: any) => ({
            ...rec,
            entity_name: rec.entities?.name || '',
            username: profilesMap.get(rec.user_id)?.username || '',
            avatar_url: profilesMap.get(rec.user_id)?.avatar_url || null
          }))
        }
      }
      
      console.log(`✅ Local search: ${results.entities.length} entities (${slugEntities?.length || 0} slug priority), ${results.users.length} users`)
    } catch (localError) {
      console.error('Local database search failed:', localError)
      // Continue with external searches even if local fails
    }

    // 2. Search external APIs with enhanced error handling
    // Only call external APIs in 'quick' mode, skip in 'local-only' mode
    if (mode === 'quick') {
      console.log('🌐 Starting external API searches (quick mode)...')
      
      // Use Promise.allSettled for parallel execution with individual error handling
      const [booksResult, moviesResult, placesResult] = await Promise.allSettled([
        searchBooks(query, 8),
        searchMovies(query, 5),
        searchPlaces(query, 20)
      ])

      if (booksResult.status === 'fulfilled') {
        results.categorized.books = booksResult.value
      }
      if (moviesResult.status === 'fulfilled') {
        results.categorized.movies = moviesResult.value
      }
      if (placesResult.status === 'fulfilled') {
        results.categorized.places = placesResult.value
      }
    } else if (mode === 'local-only') {
      // Local-only mode: Skip ALL external API calls to minimize costs
      // Used for fast initial search results during typing
      console.log('🏠 Local-only mode - skipping ALL external API calls')
    }

    // Combine all products for backwards compatibility
    results.products = [
      ...results.categorized.books,
      ...results.categorized.movies,
      ...results.categorized.places
    ]

    const totalExternalResults = results.products.length
    console.log(`✅ Enhanced search completed: ${totalExternalResults} external results`)
    console.log(`📊 Results breakdown: ${results.categorized.books.length} books, ${results.categorized.movies.length} movies, ${results.categorized.places.length} places`)

    return new Response(
      JSON.stringify({
        ...results,
        total: totalExternalResults,
        mode,
        circuit_status: {
          books: circuitBreaker.books.isOpen ? 'open' : 'closed',
          movies: circuitBreaker.movies.isOpen ? 'open' : 'closed',
          places: circuitBreaker.places.isOpen ? 'open' : 'closed'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in enhanced unified search:', error)
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
