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
import { normalizeSearchQuery } from '@/utils/searchNormalize';

export interface SearchLoading {
  local: boolean;
  external: boolean;
}

// Tiered debounce configuration
const LOCAL_DEBOUNCE_MS = 450;    // Fast local search (bumped from 300)
const EXTERNAL_DEBOUNCE_MS = 1100; // Slower external search (bumped from 800)
const MIN_EXTERNAL_QUERY_LENGTH = 4; // Minimum chars for external search
const EXTERNAL_CACHE_TTL_MS = 60000; // 60 second cache for external results

// Simple cache for external search results to prevent duplicate API calls.
// Two-tier: in-memory Map (session) + localStorage (cross-reload, 60s TTL, 50 entries).
const externalSearchCache = new Map<string, { 
  data: any; 
  timestamp: number; 
}>();

const PERSIST_KEY = 'cg_search_cache_v1';
const PERSIST_MAX_ENTRIES = 50;

type PersistedCache = Record<string, { data: any; timestamp: number }>;

const readPersistedCache = (): PersistedCache => {
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePersistedCache = (cache: PersistedCache) => {
  try {
    // Trim to most recent N entries by timestamp.
    const entries = Object.entries(cache);
    if (entries.length > PERSIST_MAX_ENTRIES) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const trimmed: PersistedCache = {};
      for (const [k, v] of entries.slice(0, PERSIST_MAX_ENTRIES)) trimmed[k] = v;
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(cache));
    }
  } catch {
    // Quota / private mode — silent no-op.
  }
};

const getCachedExternalResults = (query: string, locationKey = '') => {
  const key = `${query.toLowerCase().trim()}${locationKey}`;
  // 1) In-memory first.
  const mem = externalSearchCache.get(key);
  if (mem && Date.now() - mem.timestamp < EXTERNAL_CACHE_TTL_MS) {
    return mem.data;
  }
  // 2) Fall back to persisted cache.
  const persisted = readPersistedCache();
  const p = persisted[key];
  if (p && Date.now() - p.timestamp < EXTERNAL_CACHE_TTL_MS) {
    // Hydrate in-memory tier so subsequent hits are O(1).
    externalSearchCache.set(key, p);
    return p.data;
  }
  return null;
};

const setCachedExternalResults = (query: string, data: any, locationKey = '') => {
  const key = `${query.toLowerCase().trim()}${locationKey}`;
  const entry = { data, timestamp: Date.now() };
  externalSearchCache.set(key, entry);
  // Clean up old in-memory entries (keep last 20)
  if (externalSearchCache.size > 20) {
    const firstKey = externalSearchCache.keys().next().value;
    if (firstKey) externalSearchCache.delete(firstKey);
  }
  // Mirror to localStorage (silent on failure).
  const persisted = readPersistedCache();
  persisted[key] = entry;
  writePersistedCache(persisted);
};

/** True for benign aborts / cancelled fetches we don't want to log. */
const isAbortLike = (err: any): boolean => {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('aborted') || msg.includes('failed to fetch');
};

export interface SearchLocationOptions {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export const useEnhancedRealtimeSearch = (
  query: string,
  options?: { mode?: 'quick' | 'deep'; location?: SearchLocationOptions },
) => {
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

  // Additive "settled" signal — last query for which BOTH tiers have reached
  // a terminal state (success / handled error / abort / skipped). Consumers
  // like the Search page use this to gate result commits, avoiding the race
  // where loadingStates briefly flip to false between the local and external
  // debounce windows. Other consumers (Explore dropdown) can ignore it.
  const [settledQuery, setSettledQuery] = useState<string | null>(null);

  // Per-tier "this query has reached a terminal state" tracking. We compute
  // settledQuery from these so it ONLY advances when both tiers agree, for
  // the SAME normalized query.
  const localSettledForRef = useRef<string | null>(null);
  const externalSettledForRef = useRef<string | null>(null);

  // Refs for managing debounce timers and abort
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);
  const externalTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Split abort controllers — local and external are independent lifecycles.
  const localAbortRef = useRef<AbortController | null>(null);
  const externalAbortRef = useRef<AbortController | null>(null);
  const lastLocalQueryRef = useRef<string>('');
  const lastExternalQueryRef = useRef<string>('');

  const searchMode = options?.mode || 'quick';

  // Stable ref to current location options so callbacks don't re-create
  // on every coord change (which would cancel in-flight requests).
  const locationRef = useRef<SearchLocationOptions | undefined>(options?.location);
  locationRef.current = options?.location;

  // Build a cache-key suffix from current location (bucketed to ~1km)
  const buildLocationKey = useCallback(() => {
    const loc = locationRef.current;
    if (!loc?.enabled || loc.latitude == null || loc.longitude == null) return '';
    return `|loc:${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
  }, []);

  // Build the body fragment to send to edge functions
  const buildLocationBody = useCallback(() => {
    const loc = locationRef.current;
    if (!loc?.enabled || loc.latitude == null || loc.longitude == null) {
      return { locationEnabled: false };
    }
    return {
      locationEnabled: true,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      radius: 10000,
    };
  }, []);


  // Mark a tier as terminal for a given query, and advance settledQuery
  // ONLY when both tiers (or the only required tier, in local-only mode)
  // agree on the same normalized query.
  const markTierSettled = useCallback((tier: 'local' | 'external', normalizedQuery: string) => {
    if (tier === 'local') localSettledForRef.current = normalizedQuery;
    else externalSettledForRef.current = normalizedQuery;

    const requireExternal = searchMode === 'quick';
    const localOk = localSettledForRef.current === normalizedQuery;
    const externalOk = !requireExternal || externalSettledForRef.current === normalizedQuery;
    if (localOk && externalOk) {
      setSettledQuery(normalizedQuery);
    }
  }, [searchMode]);

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Tier 1: Local-only search (fast, 450ms debounce)
  const performLocalSearch = useCallback(async (searchQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(searchQuery);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults(prev => ({
        ...prev,
        users: [],
        entities: [],
        reviews: [],
        recommendations: []
      }));
      setLoadingStates(prev => ({ ...prev, local: false }));
      // Terminal: short/empty query — mark settled so consumers don't wait.
      markTierSettled('local', normalizedQuery);
      return;
    }

    // Dedupe — same query already in flight or just resolved.
    if (lastLocalQueryRef.current === normalizedQuery) {
      // Already terminal for this query — re-assert settled in case caller
      // is waiting (e.g. refetch on identical query).
      markTierSettled('local', normalizedQuery);
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
          mode: 'local-only',  // Forces local-only, no external API calls
          ...buildLocationBody(),
        },
        // @ts-expect-error supabase-js types may not expose `signal` yet
        signal: controller.signal,
      });

      // Belt-and-braces: even if the SDK ignored signal, drop stale responses.
      // Aborted = superseded by a newer query; do NOT mark settled (the newer
      // query will reach its own terminal state).
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
      // Errors (other than abort) are still terminal — fall through to mark settled.
    } finally {
      if (!controller.signal.aborted) {
        setLoadingStates(prev => ({ ...prev, local: false }));
        // Terminal: success or handled error.
        markTierSettled('local', normalizedQuery);
      }
    }
  }, [markTierSettled]);

  // Tier 2: External API search (slower, 1100ms debounce, ≥4 chars, cached)
  const performExternalSearch = useCallback(async (searchQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(searchQuery);

    // Length guard — runs BEFORE any invoke, so short queries never hit the wire.
    // Terminal: external tier is intentionally skipped → mark settled so the
    // commit gate doesn't wait forever for a tier that will never run.
    if (!searchQuery || searchQuery.trim().length < MIN_EXTERNAL_QUERY_LENGTH) {
      setLoadingStates(prev => ({ ...prev, external: false }));
      markTierSettled('external', normalizedQuery);
      return;
    }

    const locationKey = buildLocationKey();
    const dedupeKey = `${normalizedQuery}${locationKey}`;

    // Prevent duplicate calls for same query + location combo
    if (lastExternalQueryRef.current === dedupeKey) {
      // Already terminal for this query — re-assert settled.
      markTierSettled('external', normalizedQuery);
      return;
    }

    // Check cache first — terminal: cached hit counts as settled.
    const cached = getCachedExternalResults(searchQuery, locationKey);
    if (cached) {
      setResults(prev => ({
        ...prev,
        products: cached.products || [],
        categorized: cached.categorized || { books: [], movies: [], places: [] }
      }));
      setLoadingStates(prev => ({ ...prev, external: false }));
      lastExternalQueryRef.current = dedupeKey;
      markTierSettled('external', normalizedQuery);
      return;
    }

    // Cancel previous in-flight external request
    if (externalAbortRef.current) {
      externalAbortRef.current.abort();
    }
    const controller = new AbortController();
    externalAbortRef.current = controller;

    setLoadingStates(prev => ({ ...prev, external: true }));
    lastExternalQueryRef.current = dedupeKey;

    try {
      const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
        body: {
          query: searchQuery,
          limit: 20,
          type: 'all',
          mode: 'quick',  // Calls external APIs (Books, Movies, Places)
          ...buildLocationBody(),
        },
        // @ts-expect-error supabase-js types may not expose `signal` yet
        signal: controller.signal,
      });

      // Belt-and-braces: drop stale responses if we've moved on. Aborted =
      // superseded; the newer query will reach its own terminal state.
      if (controller.signal.aborted) return;

      if (!searchError && data) {
        const externalData = {
          products: data?.products || [],
          categorized: data?.categorized || { books: [], movies: [], places: [] }
        };

        // Cache the results to prevent duplicate API calls
        setCachedExternalResults(searchQuery, externalData, locationKey);

        setResults(prev => ({ ...prev, ...externalData }));
      }
    } catch (err: any) {
      if (!isAbortLike(err)) {
        console.error('External search failed:', err);
      }
      // Errors (other than abort) are still terminal — fall through.
    } finally {
      if (!controller.signal.aborted) {
        setLoadingStates(prev => ({ ...prev, external: false }));
        // Terminal: success or handled error.
        markTierSettled('external', normalizedQuery);
      }
    }
  }, [markTierSettled, buildLocationKey, buildLocationBody]);

  // Re-run external search when the user toggles location on/off mid-session.
  // We trip the dedupe by clearing lastExternalQueryRef and letting the main
  // effect schedule a fresh debounce on the next tick.
  const locEnabled = options?.location?.enabled ?? false;
  const locLat = options?.location?.latitude;
  const locLng = options?.location?.longitude;
  useEffect(() => {
    lastExternalQueryRef.current = '';
    externalSettledForRef.current = null;
    if (query && query.trim().length >= MIN_EXTERNAL_QUERY_LENGTH && searchMode === 'quick') {
      // Trigger immediately rather than wait the full debounce — the user just
      // made an intentional choice and expects fresh results.
      performExternalSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locEnabled, locLat, locLng]);

  // Main effect: coordinate tiered debounce
  useEffect(() => {
    // Clear results and loading states for empty queries
    if (!query || query.trim().length < 2) {
      // Cancel anything in flight when the user clears the input.
      if (localAbortRef.current) localAbortRef.current.abort();
      if (externalAbortRef.current) externalAbortRef.current.abort();
      lastLocalQueryRef.current = '';
      lastExternalQueryRef.current = '';
      // Reset settled tracking — there's nothing to wait for.
      localSettledForRef.current = null;
      externalSettledForRef.current = null;
      setSettledQuery(null);

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
    // Reset settled tracking too — refetch is a fresh lifecycle.
    localSettledForRef.current = null;
    externalSettledForRef.current = null;
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
    refetch,
    // Additive: last query for which both required tiers have terminally
    // resolved. Consumers can use this to gate result commits and avoid
    // the local→external race. Other consumers may safely ignore it.
    settledQuery,
  };
};
