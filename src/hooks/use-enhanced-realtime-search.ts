/**
 * Enhanced Realtime Search Hook with Tiered Debounce
 * 
 * SEARCH API CALL POLICY:
 * - Local-only mode (450ms debounce): Searches local database only, NO external API calls
 * - Quick mode (1100ms debounce, ≥4 chars): Searches local + external APIs
 * - Results cached for 60 seconds per query to prevent duplicate calls
 * - Separate AbortControllers for local vs external; post-await aborted-check
 *   guarantees stale responses can never overwrite fresh state, even if the
 *   Supabase SDK silently drops the `signal` option.
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
const LOCAL_DEBOUNCE_MS = 450;    // Fast local search (bumped from 300)
const EXTERNAL_DEBOUNCE_MS = 1100; // Slower external search (bumped from 800)
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

/** True for benign aborts / cancelled fetches we don't want to log. */
const isAbortLike = (err: any): boolean => {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('aborted') || msg.includes('failed to fetch');
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
  // Split abort controllers — local and external are independent lifecycles.
  const localAbortRef = useRef<AbortController | null>(null);
  const externalAbortRef = useRef<AbortController | null>(null);
  const lastLocalQueryRef = useRef<string>('');
  const lastExternalQueryRef = useRef<string>('');
  
  const searchMode = options?.mode || 'quick';

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Tier 1: Local-only search (fast, 450ms debounce)
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

    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Dedupe — same query already in flight or just resolved.
    if (lastLocalQueryRef.current === normalizedQuery) {
      return;
    }

    // Cancel previous in-flight local request.
    if (localAbortRef.current) {
      localAbortRef.current.abort();
    }
    const controller = new AbortController();
    localAbortRef.current = controller;
    lastLocalQueryRef.current = normalizedQuery;

    setLoadingStates(prev => ({ ...prev, local: true }));

    try {
      const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
        body: { 
          query: searchQuery, 
          limit: 20, 
          type: 'all', 
          mode: 'local-only'  // Forces local-only, no external API calls
        },
        // @ts-expect-error supabase-js types may not expose `signal` yet
        signal: controller.signal,
      });

      // Belt-and-braces: even if the SDK ignored signal, drop stale responses.
      if (controller.signal.aborted) return;

      if (!searchError && data) {
        // Also search hashtags
        let hashtagResults: any[] = [];
        if (searchQuery.startsWith('#') && searchQuery.length > 1) {
          hashtagResults = await searchHashtags(searchQuery.substring(1), 10);
        } else if (searchQuery.length >= 2) {
          hashtagResults = await searchHashtags(searchQuery, 5);
        }

        if (controller.signal.aborted) return;

        setResults(prev => ({
          ...prev,
          users: data?.users || [],
          entities: data?.entities || [],
          reviews: data?.reviews || [],
          recommendations: data?.recommendations || [],
          hashtags: hashtagResults,
        }));
      }
    } catch (err: any) {
      if (!isAbortLike(err)) {
        console.error('Local search failed:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingStates(prev => ({ ...prev, local: false }));
      }
    }
  }, []);

  // Tier 2: External API search (slower, 1100ms debounce, ≥4 chars, cached)
  const performExternalSearch = useCallback(async (searchQuery: string) => {
    // Length guard — runs BEFORE any invoke, so short queries never hit the wire.
    if (!searchQuery || searchQuery.trim().length < MIN_EXTERNAL_QUERY_LENGTH) {
      setLoadingStates(prev => ({ ...prev, external: false }));
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Prevent duplicate calls for same query
    if (lastExternalQueryRef.current === normalizedQuery) {
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

    // Cancel previous in-flight external request
    if (externalAbortRef.current) {
      externalAbortRef.current.abort();
    }
    const controller = new AbortController();
    externalAbortRef.current = controller;

    setLoadingStates(prev => ({ ...prev, external: true }));
    lastExternalQueryRef.current = normalizedQuery;

    try {
      const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
        body: { 
          query: searchQuery, 
          limit: 20, 
          type: 'all', 
          mode: 'quick'  // Calls external APIs (Books, Movies, Places)
        },
        // @ts-expect-error supabase-js types may not expose `signal` yet
        signal: controller.signal,
      });

      // Belt-and-braces: drop stale responses if we've moved on.
      if (controller.signal.aborted) return;

      if (!searchError && data) {
        const externalData = {
          products: data?.products || [],
          categorized: data?.categorized || { books: [], movies: [], places: [] }
        };
        
        // Cache the results to prevent duplicate API calls
        setCachedExternalResults(searchQuery, externalData);
        
        setResults(prev => ({ ...prev, ...externalData }));
      }
    } catch (err: any) {
      if (!isAbortLike(err)) {
        console.error('External search failed:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingStates(prev => ({ ...prev, external: false }));
      }
    }
  }, []);

  // Main effect: coordinate tiered debounce
  useEffect(() => {
    // Clear results and loading states for empty queries
    if (!query || query.trim().length < 2) {
      // Cancel anything in flight when the user clears the input.
      if (localAbortRef.current) localAbortRef.current.abort();
      if (externalAbortRef.current) externalAbortRef.current.abort();
      lastLocalQueryRef.current = '';
      lastExternalQueryRef.current = '';

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

    // Tier 1: Local search after 450ms (fast, no external API calls)
    localTimerRef.current = setTimeout(() => {
      performLocalSearch(query);
    }, LOCAL_DEBOUNCE_MS);

    // Tier 2: External search after 1100ms idle (slower, requires longer pause)
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
    lastLocalQueryRef.current = '';
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
