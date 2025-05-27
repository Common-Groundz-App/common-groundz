
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

interface CategorizedResults {
  books: ProductSearchResult[];
  movies: ProductSearchResult[];
  places: ProductSearchResult[];
  food: ProductSearchResult[];
  products: ProductSearchResult[];
}

interface RealtimeSearchState {
  results: UnifiedSearchResults & { categorized: CategorizedResults };
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

// Local fallback classification for when LLM APIs are down
const classifyQueryLocally = (query: string): SearchClassification => {
  const lowerQuery = query.toLowerCase();
  
  // Book indicators
  if (lowerQuery.includes('book') || lowerQuery.includes('novel') || lowerQuery.includes('author') ||
      lowerQuery.includes('song of ice and fire') || lowerQuery.includes('game of thrones') ||
      lowerQuery.includes('monk who sold') || lowerQuery.includes('ferrari')) {
    return { 
      classification: 'book', 
      confidence: 0.8, 
      reasoning: 'Local keyword matching detected book-related terms',
      api_used: 'fallback' 
    };
  }
  
  // Movie indicators
  if (lowerQuery.includes('movie') || lowerQuery.includes('film') || lowerQuery.includes('cinema')) {
    return { 
      classification: 'movie', 
      confidence: 0.8, 
      reasoning: 'Local keyword matching detected movie-related terms',
      api_used: 'fallback' 
    };
  }
  
  // Place indicators
  if (lowerQuery.includes('restaurant') || lowerQuery.includes('cafe') || lowerQuery.includes('hotel')) {
    return { 
      classification: 'place', 
      confidence: 0.8, 
      reasoning: 'Local keyword matching detected place-related terms',
      api_used: 'fallback' 
    };
  }
  
  return { 
    classification: 'general', 
    confidence: 0.5, 
    reasoning: 'No specific category detected locally',
    api_used: 'fallback' 
  };
};

export const useRealtimeUnifiedSearch = (query: string) => {
  const [state, setState] = useState<RealtimeSearchState>({
    results: {
      products: [],
      entities: [],
      reviews: [],
      recommendations: [],
      users: [],
      categorized: {
        books: [],
        movies: [],
        places: [],
        food: [],
        products: []
      }
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
        users: [],
        categorized: {
          books: [],
          movies: [],
          places: [],
          food: [],
          products: []
        }
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

  const updateCategorizedResults = useCallback((category: keyof CategorizedResults, newResults: ProductSearchResult[]) => {
    setState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        categorized: {
          ...prev.results.categorized,
          [category]: newResults
        },
        products: [...prev.results.products, ...newResults]
      }
    }));
  }, []);

  const updateLocalResults = useCallback((updates: Partial<UnifiedSearchResults>) => {
    setState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        ...updates
      }
    }));
  }, []);

  // Classify search query with local fallback
  const classifyQuery = useCallback(async (searchQuery: string): Promise<SearchClassification> => {
    setLoadingState('classification', true);
    try {
      console.log(`🤖 Classifying query: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke('classify-search-query', {
        body: { query: searchQuery }
      });

      if (error) {
        console.warn('LLM classification failed, using local fallback:', error);
        return classifyQueryLocally(searchQuery);
      }
      
      console.log('🎯 LLM classification result:', data);
      
      return {
        classification: data.classification,
        confidence: data.confidence,
        reasoning: data.reasoning,
        api_used: data.api_used
      };
    } catch (error) {
      console.warn('Classification service error, using local fallback:', error);
      return classifyQueryLocally(searchQuery);
    } finally {
      setLoadingState('classification', false);
    }
  }, [setLoadingState]);

  // Search local database
  const searchLocal = useCallback(async (searchQuery: string, searchId: number) => {
    setLoadingState('local', true);
    try {
      console.log(`🏠 Searching local database for: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke('search-all', {
        body: { 
          query: searchQuery,
          limit: 10,
          type: 'local_only'
        }
      });

      if (searchId !== searchIdRef.current) return;

      if (error) throw error;

      if (data) {
        console.log(`✅ Local search found: ${data.entities?.length || 0} entities, ${data.users?.length || 0} users`);
        updateLocalResults({
          entities: data.entities || [],
          reviews: data.reviews || [],
          recommendations: data.recommendations || [],
          users: data.users || []
        });
      }
    } catch (error) {
      console.error('❌ Local search failed:', error);
    } finally {
      setLoadingState('local', false);
    }
  }, [setLoadingState, updateLocalResults]);

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
      console.log(`🔍 Searching ${classification}s for: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke(apiEndpoint, {
        body: { query: searchQuery }
      });

      if (searchId !== searchIdRef.current) return;

      if (error) throw error;

      if (data?.results && Array.isArray(data.results)) {
        console.log(`✅ Found ${data.results.length} ${classification} results`);
        updateCategorizedResults(
          `${classification}s` as keyof CategorizedResults, 
          data.results
        );
      }
    } catch (error) {
      console.error(`❌ ${classification} search failed:`, error);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [setLoadingState, updateCategorizedResults]);

  // Search all APIs in parallel based on classification confidence
  const searchAPIs = useCallback(async (
    searchQuery: string, 
    classification: SearchClassification,
    searchId: number
  ) => {
    const { classification: type, confidence } = classification;

    console.log(`🎯 Primary search type: ${type} (confidence: ${Math.round(confidence * 100)}%)`);

    // Always search the primary classified type
    await searchSpecificAPI(searchQuery, type, searchId);

    // If confidence is low, search additional relevant types
    if (confidence < 0.8) {
      console.log(`🔄 Low confidence, searching additional types...`);
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
      console.log(`🚀 Starting realtime search for: "${searchQuery}" (ID: ${searchId})`);

      // Step 1: Classify query and search local DB in parallel
      const [classification] = await Promise.all([
        classifyQuery(searchQuery),
        searchLocal(searchQuery, searchId)
      ]);

      if (searchId !== searchIdRef.current) return;

      setState(prev => ({ ...prev, classification }));
      console.log(`🏷️ Classification: ${classification.classification} (${classification.api_used})`);

      // Step 2: Search external APIs based on classification
      await searchAPIs(searchQuery, classification, searchId);

      console.log(`✅ Search completed for: "${searchQuery}"`);

    } catch (error) {
      console.error('💥 Search error:', error);
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
