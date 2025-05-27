import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ProductSearchResult, 
  EntitySearchResult, 
  ReviewSearchResult, 
  RecommendationSearchResult, 
  SearchResult,
  UnifiedSearchResults 
} from './use-unified-search';

interface SearchClassification {
  classification: 'book' | 'movie' | 'place' | 'food' | 'product' | 'person' | 'general';
  confidence: number;
  reasoning?: string;
  api_used?: 'gemini' | 'openai' | 'fallback';
}

interface RealtimeSearchState {
  results: UnifiedSearchResults;
  isLoading: boolean;
  loadingStates: {
    classification: boolean;
    local: boolean;
    books: boolean;
    movies: boolean;
    places: boolean;
    food: boolean;
    products: boolean;
  };
  error: string | null;
  classification: SearchClassification | null;
}

export const useRealtimeUnifiedSearch = (query: string) => {
  const [state, setState] = useState<RealtimeSearchState>({
    results: {
      products: [],
      entities: [],
      reviews: [],
      recommendations: [],
      users: []
    },
    isLoading: false,
    loadingStates: {
      classification: false,
      local: false,
      books: false,
      movies: false,
      places: false,
      food: false,
      products: false,
    },
    error: null,
    classification: null
  });

  const debounceRef = useRef<NodeJS.Timeout>();
  const searchIdRef = useRef<number>(0);

  const resetResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: {
        products: [],
        entities: [],
        reviews: [],
        recommendations: [],
        users: []
      },
      error: null
    }));
  }, []);

  const setLoadingState = useCallback((key: keyof RealtimeSearchState['loadingStates'], value: boolean) => {
    setState(prev => ({
      ...prev,
      loadingStates: {
        ...prev.loadingStates,
        [key]: value
      }
    }));
  }, []);

  const updateResults = useCallback((updates: Partial<UnifiedSearchResults>) => {
    setState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        ...updates
      }
    }));
  }, []);

  // Classify search query using LLM (Gemini primary, OpenAI fallback)
  const classifyQuery = useCallback(async (searchQuery: string): Promise<SearchClassification> => {
    setLoadingState('classification', true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-search-query', {
        body: { query: searchQuery }
      });

      if (error) throw error;
      
      console.log('🤖 Query classification:', data);
      
      // Handle the updated response format
      return {
        classification: data.classification,
        confidence: data.confidence,
        reasoning: data.reasoning,
        api_used: data.api_used
      };
    } catch (error) {
      console.error('Classification failed:', error);
      return { 
        classification: 'general', 
        confidence: 0.5,
        reasoning: 'Classification service error',
        api_used: 'fallback'
      };
    } finally {
      setLoadingState('classification', false);
    }
  }, [setLoadingState]);

  // Search local database
  const searchLocal = useCallback(async (searchQuery: string, searchId: number) => {
    setLoadingState('local', true);
    try {
      const { data, error } = await supabase.functions.invoke('search-all', {
        body: { 
          query: searchQuery,
          limit: 10,
          type: 'local_only'
        }
      });

      if (searchId !== searchIdRef.current) return; // Ignore if newer search started

      if (error) throw error;

      if (data) {
        updateResults({
          entities: data.entities || [],
          reviews: data.reviews || [],
          recommendations: data.recommendations || [],
          users: data.users || []
        });
      }
    } catch (error) {
      console.error('Local search failed:', error);
    } finally {
      setLoadingState('local', false);
    }
  }, [setLoadingState, updateResults]);

  // Search specific API based on classification
  const searchSpecificAPI = useCallback(async (
    searchQuery: string, 
    classification: string, 
    searchId: number
  ) => {
    const apiMap = {
      book: 'search-books',
      movie: 'search-movies', 
      place: 'search-places',
      food: 'search-food'
    };

    const loadingKey = `${classification}s` as keyof RealtimeSearchState['loadingStates'];
    const apiEndpoint = apiMap[classification as keyof typeof apiMap];

    if (!apiEndpoint) return;

    setLoadingState(loadingKey, true);
    try {
      const { data, error } = await supabase.functions.invoke(apiEndpoint, {
        body: { query: searchQuery }
      });

      if (searchId !== searchIdRef.current) return; // Ignore if newer search started

      if (error) throw error;

      if (data?.results) {
        updateResults({
          products: [...state.results.products, ...data.results]
        });
      }
    } catch (error) {
      console.error(`${classification} search failed:`, error);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [setLoadingState, updateResults, state.results.products]);

  // Search all APIs in parallel based on classification confidence
  const searchAPIs = useCallback(async (
    searchQuery: string, 
    classification: SearchClassification,
    searchId: number
  ) => {
    const { classification: type, confidence } = classification;

    // Always search the primary classified type
    await searchSpecificAPI(searchQuery, type, searchId);

    // If confidence is low, search additional relevant types
    if (confidence < 0.8) {
      const additionalTypes: string[] = [];
      
      if (type === 'general') {
        additionalTypes.push('book', 'movie', 'place');
      } else if (type === 'product') {
        additionalTypes.push('book', 'movie');
      }

      // Search additional types in parallel
      await Promise.all(
        additionalTypes.map(additionalType => 
          searchSpecificAPI(searchQuery, additionalType, searchId)
        )
      );
    }
  }, [searchSpecificAPI]);

  // Main search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      resetResults();
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        classification: null,
        loadingStates: {
          classification: false,
          local: false,
          books: false,
          movies: false,
          places: false,
          food: false,
          products: false,
        }
      }));
      return;
    }

    const searchId = ++searchIdRef.current;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    resetResults();

    try {
      console.log(`🔍 Starting realtime search for: "${searchQuery}"`);

      // Step 1: Classify query and search local DB in parallel
      const [classification] = await Promise.all([
        classifyQuery(searchQuery),
        searchLocal(searchQuery, searchId)
      ]);

      if (searchId !== searchIdRef.current) return; // Ignore if newer search started

      setState(prev => ({ ...prev, classification }));

      // Step 2: Search external APIs based on classification
      await searchAPIs(searchQuery, classification, searchId);

      console.log(`✅ Realtime search completed for: "${searchQuery}"`);

    } catch (error) {
      console.error('Search error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Search failed' 
      }));
    } finally {
      if (searchId === searchIdRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [classifyQuery, searchLocal, searchAPIs, resetResults]);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Calculate overall loading state
  const isAnyLoading = Object.values(state.loadingStates).some(Boolean);

  return {
    results: state.results,
    isLoading: state.isLoading || isAnyLoading,
    loadingStates: state.loadingStates,
    error: state.error,
    classification: state.classification
  };
};
