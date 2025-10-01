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
      const slugQuery = query.toLowerCase().trim()
      const { data: slugEntities } = await supabase
        .from('entities')
        .select('*, parent:entities!entities_parent_id_fkey(slug, id)')
        .or(`slug.eq.${slugQuery}, slug.ilike.${slugQuery}%`)
        .eq('is_deleted', false)
        .limit(limit)
      
      // Second: Search for broader matches in name, description, and partial slug
      const { data: broadEntities } = await supabase
        .from('entities')
        .select('*, parent:entities!entities_parent_id_fkey(slug, id)')
        .or(`name.ilike.%${query}%, description.ilike.%${query}%, slug.ilike.%${query}%`)
        .eq('is_deleted', false)
        .limit(limit * 2) // Get more results to merge
      
      // Merge results: slug matches first, then broad matches (deduplicated)
      const slugEntityIds = new Set((slugEntities || []).map((e: any) => e.id))
      const mergedEntities = [
        ...(slugEntities || []),
        ...(broadEntities || []).filter((e: any) => !slugEntityIds.has(e.id))
      ].slice(0, limit)
      
      console.log(`🎯 Found ${slugEntities?.length || 0} slug matches, ${(broadEntities || []).length} broad matches`)
      
      // Search other tables in parallel
      const [usersResult, reviewsResult, recommendationsResult] = await Promise.allSettled([
        supabase.from('profiles').select('id, username, avatar_url, bio').or(`username.ilike.%${query}%, bio.ilike.%${query}%`).limit(limit),
        supabase.from('reviews').select(`id, title, content, rating, created_at, entities!inner(name, slug), profiles!inner(username, avatar_url)`).or(`title.ilike.%${query}%, content.ilike.%${query}%`).eq('status', 'published').limit(limit),
        supabase.from('recommendations').select(`id, title, content, rating, category, created_at, entities!inner(name, slug), profiles!inner(username, avatar_url)`).or(`title.ilike.%${query}%, content.ilike.%${query}%`).limit(limit)
      ])

      // Process merged entity results
      results.entities = mergedEntities.map((entity: any) => ({
        ...entity,
        parent_slug: entity.parent?.slug || null
      }))
      
      if (usersResult.status === 'fulfilled' && usersResult.value.data) {
        results.users = usersResult.value.data
      }
      if (reviewsResult.status === 'fulfilled' && reviewsResult.value.data) {
        results.reviews = reviewsResult.value.data.map((review: any) => ({
          ...review,
          entity_name: review.entities?.name || '',
          username: review.profiles?.username || '',
          avatar_url: review.profiles?.avatar_url || null
        }))
      }
      if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value.data) {
        results.recommendations = recommendationsResult.value.data.map((rec: any) => ({
          ...rec,
          entity_name: rec.entities?.name || '',
          username: rec.profiles?.username || '',
          avatar_url: rec.profiles?.avatar_url || null
        }))
      }
      
      console.log(`✅ Local search: ${results.entities.length} entities (${slugEntities?.length || 0} slug priority), ${results.users.length} users`)
    } catch (localError) {
      console.error('Local database search failed:', localError)
      // Continue with external searches even if local fails
    }

    // 2. Search external APIs with enhanced error handling
    if (mode === 'quick') {
      console.log('🌐 Starting external API searches...')
      
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
