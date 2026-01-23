/**
 * Enhanced Realtime Search Hook with Tiered Debounce
 * 
 * SEARCH API CALL POLICY:
 * - Local-only mode (300ms debounce): Searches local database only, NO external API calls
 * - Quick mode (800ms debounce, ≥4 chars): Searches local + external APIs
 * - Results cached for 60 seconds per query to prevent duplicate calls
 * - AbortController used to cancel in-flight requests on new input
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedSearchResults } from '@/hooks/use-unified-search';
import { searchHashtags } from '@/services/hashtagService';

export interface SearchLoading {
  local: boolean;
  external: boolean;
}

// Tiered debounce configuration
const LOCAL_DEBOUNCE_MS = 300;   // Fast local search
const EXTERNAL_DEBOUNCE_MS = 800; // Slower external search (requires idle time)
const MIN_EXTERNAL_QUERY_LENGTH = 4; // Minimum chars for external search
const EXTERNAL_CACHE_TTL_MS = 60000; // 60 second cache for external results

// Simple cache for external search results to prevent duplicate API calls
const externalSearchCache = new Map<string, { 
  data: any; 
  timestamp: number; 
}>();

const getCachedExternalResults = (query: string) => {
  const key = query.toLowerCase().trim();
  const cached = externalSearchCache.get(key);
  if (cached && Date.now() - cached.timestamp < EXTERNAL_CACHE_TTL_MS) {
    console.log(`✅ Using cached external results for: "${query}"`);
    return cached.data;
  }
  return null;
};

const setCachedExternalResults = (query: string, data: any) => {
  const key = query.toLowerCase().trim();
  externalSearchCache.set(key, {
    data,
    timestamp: Date.now()
  });
  // Clean up old cache entries (keep last 20)
  if (externalSearchCache.size > 20) {
    const firstKey = externalSearchCache.keys().next().value;
    if (firstKey) externalSearchCache.delete(firstKey);
  }
};

export const useEnhancedRealtimeSearch = (query: string, options?: { mode?: 'quick' | 'deep' }) => {
  const [results, setResults] = useState<UnifiedSearchResults & { 
    categorized: Record<string, any[]>; 
    hashtags?: any[] 
  }>({
    users: [],
    entities: [],
    reviews: [],
    recommendations: [],
    products: [],
    hashtags: [],
    categorized: {
      books: [],
      movies: [],
      places: []
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<SearchLoading>({
    local: false,
    external: false
  });
  const [error, setError] = useState<string | null>(null);
  const [showAllResults, setShowAllResults] = useState({
    users: false,
    entities: false,
    books: false,
    movies: false,
    places: false,
    hashtags: false
  });
  
  // Refs for managing debounce timers and abort
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);
  const externalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastExternalQueryRef = useRef<string>('');
  
  const searchMode = options?.mode || 'quick';

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Tier 1: Local-only search (fast, 300ms debounce)
  const performLocalSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults(prev => ({ 
        ...prev, 
        users: [], 
        entities: [], 
        reviews: [], 
        recommendations: [] 
      }));
      setLoadingStates(prev => ({ ...prev, local: false }));
      return;
    }

    setLoadingStates(prev => ({ ...prev, local: true }));

    try {
      console.log(`🔍 [LOCAL] Searching: "${searchQuery}"`);
      
      const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
        body: { 
          query: searchQuery, 
          limit: 20, 
          type: 'all', 
          mode: 'local-only'  // IMPORTANT: Forces local-only, no external API calls
        }
      });
      
      if (!searchError && data) {
        // Also search hashtags
        let hashtagResults: any[] = [];
        if (searchQuery.startsWith('#') && searchQuery.length > 1) {
          hashtagResults = await searchHashtags(searchQuery.substring(1), 10);
        } else if (searchQuery.length >= 2) {
          hashtagResults = await searchHashtags(searchQuery, 5);
        }

        setResults(prev => ({
          ...prev,
          users: data?.users || [],
          entities: data?.entities || [],
          reviews: data?.reviews || [],
          recommendations: data?.recommendations || [],
          hashtags: hashtagResults,
        }));
      }
    } catch (err) {
      console.error('Local search failed:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, local: false }));
    }
  }, []);

  // Tier 2: External API search (slower, 800ms debounce, ≥4 chars, cached)
  const performExternalSearch = useCallback(async (searchQuery: string) => {
    // Skip if query too short
    if (!searchQuery || searchQuery.trim().length < MIN_EXTERNAL_QUERY_LENGTH) {
      console.log(`⏭️ Skipping external search (length ${searchQuery?.length || 0} < ${MIN_EXTERNAL_QUERY_LENGTH})`);
      setLoadingStates(prev => ({ ...prev, external: false }));
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Prevent duplicate calls for same query
    if (lastExternalQueryRef.current === normalizedQuery) {
      console.log(`⏭️ Skipping duplicate external search for: "${searchQuery}"`);
      return;
    }

    // Check cache first
    const cached = getCachedExternalResults(searchQuery);
    if (cached) {
      setResults(prev => ({
        ...prev,
        products: cached.products || [],
        categorized: cached.categorized || { books: [], movies: [], places: [] }
      }));
      setLoadingStates(prev => ({ ...prev, external: false }));
      return;
    }

    // Cancel previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoadingStates(prev => ({ ...prev, external: true }));
    lastExternalQueryRef.current = normalizedQuery;

    try {
      console.log(`🌐 [EXTERNAL] Searching: "${searchQuery}"`);
      
      const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
        body: { 
          query: searchQuery, 
          limit: 20, 
          type: 'all', 
          mode: 'quick'  // Calls external APIs (Books, Movies, Places)
        }
      });
      
      if (!searchError && data) {
        const externalData = {
          products: data?.products || [],
          categorized: data?.categorized || { books: [], movies: [], places: [] }
        };
        
        // Cache the results to prevent duplicate API calls
        setCachedExternalResults(searchQuery, externalData);
        
        setResults(prev => ({ ...prev, ...externalData }));
        
        console.log(`✅ External results: ${externalData.products.length} products`);
        
        // Log circuit breaker status if available
        if (data?.circuit_status) {
          console.log('🔧 Circuit breaker status:', data.circuit_status);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('External search failed:', err);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, external: false }));
    }
  }, []);

  // Main effect: coordinate tiered debounce
  useEffect(() => {
    // Clear results and loading states for empty queries
    if (!query || query.trim().length < 2) {
      setResults({
        users: [],
        entities: [],
        reviews: [],
        recommendations: [],
        products: [],
        hashtags: [],
        categorized: {
          books: [],
          movies: [],
          places: []
        }
      });
      setIsLoading(false);
      setLoadingStates({ local: false, external: false });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Clear previous timers
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (externalTimerRef.current) clearTimeout(externalTimerRef.current);

    // Tier 1: Local search after 300ms (fast, no external API calls)
    localTimerRef.current = setTimeout(() => {
      performLocalSearch(query);
    }, LOCAL_DEBOUNCE_MS);

    // Tier 2: External search after 800ms idle (slower, requires longer pause)
    if (searchMode === 'quick') {
      externalTimerRef.current = setTimeout(() => {
        performExternalSearch(query);
      }, EXTERNAL_DEBOUNCE_MS);
    }

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (externalTimerRef.current) clearTimeout(externalTimerRef.current);
    };
  }, [query, performLocalSearch, performExternalSearch, searchMode]);

  // Update overall loading state based on individual states
  useEffect(() => {
    setIsLoading(loadingStates.local || loadingStates.external);
  }, [loadingStates]);

  // Manual refetch function
  const refetch = useCallback(() => {
    console.log('🔄 Manual refetch triggered');
    lastExternalQueryRef.current = ''; // Reset to allow re-fetch
    performLocalSearch(query);
    if (searchMode === 'quick') {
      performExternalSearch(query);
    }
  }, [query, performLocalSearch, performExternalSearch, searchMode]);

  return { 
    results, 
    isLoading, 
    loadingStates, 
    error,
    showAllResults,
    toggleShowAll,
    searchMode, // Return the original searchMode passed in options
    refetch
  };
};
