
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires',
}

// In-memory cache for search results (5 minutes TTL)
const searchCache = new Map<string, { results: any[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistanceLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${(Math.round(km * 10) / 10).toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const {
      query,
      maxResults = 20,
      latitude,
      longitude,
      radius = 10000, // meters; default 10km
      accuracy, // meters; optional
      locationEnabled = false,
    } = body || {};

    if (!query && (latitude == null || longitude == null)) {
      return new Response(
        JSON.stringify({ error: 'Query or coordinates required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const hasCoords =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      locationEnabled === true;

    // Build cache key — coords bucketed to ~1km to reuse cache across nearby pings
    const coordKey = hasCoords
      ? `:${latitude.toFixed(2)},${longitude.toFixed(2)}:r${radius}`
      : '';
    const cacheKey = `${query || '__nearby__'}:${maxResults}${coordKey}`;
    const cached = searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`✅ Returning cached search results for: "${cacheKey}"`);
      return new Response(
        JSON.stringify({
          results: cached.results,
          total: cached.results.length,
          source: 'google_places',
          cached: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📍 Searching places: query="${query}" coords=${hasCoords ? `${latitude},${longitude}` : 'none'}`)

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      throw new Error('Google Places API key not configured')
    }

    // Build Google URL with optional location bias
    let placesUrl: string;
    if (query) {
      placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&type=establishment`;
      if (hasCoords) {
        placesUrl += `&location=${latitude},${longitude}&radius=${radius}`;
      }
    } else {
      // Pure nearby search (no query)
      placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&key=${apiKey}&type=establishment`;
    }

    const response = await fetch(placesUrl)
    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ results: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const total = data.results.length;
    // Hide distance labels when accuracy is poor (>2km)
    const showDistanceLabels = hasCoords && (accuracy == null || accuracy <= 2000);

    // Transform Google Places data — compute distance + blended relevance
    let transformedResults = data.results.slice(0, maxResults).map((place: any, position: number) => {
      let imageUrl = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=300&h=200&fit=crop'
      if (place.photos && place.photos[0]) {
        const photoRef = place.photos[0].photo_reference
        imageUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${photoRef}&maxWidth=300`
      }

      // Google text-search returns results in relevance order — derive a 0..1 score
      const googleRelevance = total > 0 ? 1 - position / total : 0;

      // Distance computation
      let distanceKm: number | null = null;
      let distanceLabel: string | null = null;
      let proximityScore = 0; // 0..1, decays with distance
      if (hasCoords && place.geometry?.location) {
        const pLat = place.geometry.location.lat;
        const pLng = place.geometry.location.lng;
        if (typeof pLat === 'number' && typeof pLng === 'number') {
          distanceKm = haversineKm(latitude, longitude, pLat, pLng);
          if (showDistanceLabels) {
            distanceLabel = formatDistanceLabel(distanceKm);
          }
          // Smooth decay: full score within 1km, ~0 by ~20km
          proximityScore = Math.max(0, 1 - distanceKm / 20);
        }
      }

      // Blended final score: 70% Google relevance + 30% proximity
      // (when no coords, proximityScore is 0 → falls back to Google order)
      const finalScore = hasCoords
        ? 0.7 * googleRelevance + 0.3 * proximityScore
        : googleRelevance;

      return {
        id: place.place_id,
        name: place.name,
        venue: place.formatted_address || '',
        description: place.types?.join(', ') || '',
        image_url: imageUrl,
        api_source: 'google_places',
        api_ref: place.place_id,
        type: 'place',
        metadata: {
          rating: place.rating || null,
          price_level: place.price_level || null,
          user_ratings_total: place.user_ratings_total || 0,
          types: place.types || [],
          business_status: place.business_status || null,
          geometry: place.geometry || null,
          location: place.geometry?.location || null,
          formatted_address: place.formatted_address || '',
          distance_km: distanceKm,
          distance_label: distanceLabel,
          // Legacy field still consumed by LocationSearchInput
          distance: distanceKm,
          _final_score: finalScore,
        }
      }
    })

    // Re-sort by blended score when location is active
    if (hasCoords) {
      transformedResults.sort(
        (a: any, b: any) =>
          (b.metadata._final_score ?? 0) - (a.metadata._final_score ?? 0),
      );
    }

    searchCache.set(cacheKey, {
      results: transformedResults,
      timestamp: Date.now()
    });

    return new Response(
      JSON.stringify({
        results: transformedResults,
        total: data.results.length,
        source: 'google_places',
        cached: false,
        location_used: hasCoords,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in place search:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to search places',
        details: (error as Error).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
