
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

interface CategorizedResults {
  books: ProductSearchResult[];
  movies: ProductSearchResult[];
  places: ProductSearchResult[];
  food: ProductSearchResult[];
  products: ProductSearchResult[];
}

interface EnhancedSearchState {
  results: UnifiedSearchResults & { categorized: CategorizedResults };
  isLoading: boolean;
  loadingStates: {
    local: boolean;
    books: boolean;
    movies: boolean;
    places: boolean;
    food: boolean;
    products: boolean;
  };
  error: string | null;
  showAllResults: {
    books: boolean;
    movies: boolean;
    places: boolean;
    food: boolean;
    entities: boolean;
    users: boolean;
  };
}

// Enhanced query preprocessing
const preprocessQuery = (query: string): string[] => {
  const normalizedQuery = query.toLowerCase().trim();
  const variations = [normalizedQuery];
  
  // Add common variations
  if (normalizedQuery.startsWith('the ')) {
    variations.push(normalizedQuery.substring(4));
    variations.push('a ' + normalizedQuery.substring(4));
  }
  if (normalizedQuery.startsWith('a ')) {
    variations.push(normalizedQuery.substring(2));
    variations.push('the ' + normalizedQuery.substring(2));
  }
  if (!normalizedQuery.startsWith('the ') && !normalizedQuery.startsWith('a ')) {
    variations.push('the ' + normalizedQuery);
    variations.push('a ' + normalizedQuery);
  }
  
  return variations;
};

export const useEnhancedSearch = (query: string) => {
  const [state, setState] = useState<EnhancedSearchState>({
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
      local: false,
      books: false,
      movies: false,
      places: false,
      food: false,
      products: false,
    },
    error: null,
    showAllResults: {
      books: false,
      movies: false,
      places: false,
      food: false,
      entities: false,
      users: false,
    }
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

  const setLoadingState = useCallback((key: keyof EnhancedSearchState['loadingStates'], value: boolean) => {
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

  const toggleShowAll = useCallback((category: keyof EnhancedSearchState['showAllResults']) => {
    setState(prev => ({
      ...prev,
      showAllResults: {
        ...prev.showAllResults,
        [category]: !prev.showAllResults[category]
      }
    }));
  }, []);

  // Enhanced local search with fuzzy matching
  const searchLocal = useCallback(async (searchQuery: string, searchId: number) => {
    setLoadingState('local', true);
    try {
      console.log(`🏠 Enhanced local search for: "${searchQuery}"`);
      
      const queryVariations = preprocessQuery(searchQuery);
      console.log(`🔍 Search variations:`, queryVariations);
      
      // Search entities with multiple variations and fuzzy matching
      const entitySearchPromises = queryVariations.map(variation => 
        supabase
          .from('entities')
          .select('*')
          .or(`name.ilike.%${variation}%, description.ilike.%${variation}%, venue.ilike.%${variation}%`)
          .eq('is_deleted', false)
          .limit(10)
      );
      
      const entityResults = await Promise.all(entitySearchPromises);
      const allEntities = entityResults.flatMap(result => result.data || []);
      
      // Remove duplicates and rank by relevance
      const uniqueEntities = Array.from(
        new Map(allEntities.map(entity => [entity.id, entity])).values()
      ).sort((a, b) => {
        // Prioritize exact matches in name
        const aExact = queryVariations.some(v => a.name.toLowerCase().includes(v));
        const bExact = queryVariations.some(v => b.name.toLowerCase().includes(v));
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

      // Search users with fuzzy matching
      const userSearchPromises = queryVariations.map(variation =>
        supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .or(`username.ilike.%${variation}%, bio.ilike.%${variation}%`)
          .limit(5)
      );
      
      const userResults = await Promise.all(userSearchPromises);
      const allUsers = userResults.flatMap(result => result.data || []);
      const uniqueUsers = Array.from(
        new Map(allUsers.map(user => [user.id, user])).values()
      );

      if (searchId !== searchIdRef.current) return;

      console.log(`✅ Enhanced local search found: ${uniqueEntities.length} entities, ${uniqueUsers.length} users`);
      updateLocalResults({
        entities: uniqueEntities,
        reviews: [], // Keep existing review search logic
        recommendations: [], // Keep existing recommendation search logic
        users: uniqueUsers
      });
    } catch (error) {
      console.error('❌ Enhanced local search failed:', error);
    } finally {
      setLoadingState('local', false);
    }
  }, [setLoadingState, updateLocalResults]);

  // Search specific API
  const searchSpecificAPI = useCallback(async (
    searchQuery: string, 
    apiType: string, 
    searchId: number
  ) => {
    const apiMap = {
      book: 'search-books',
      movie: 'search-movies', 
      place: 'search-places',
      food: 'search-food'
    };

    const loadingKey = `${apiType}s` as keyof EnhancedSearchState['loadingStates'];
    const apiEndpoint = apiMap[apiType as keyof typeof apiMap];

    if (!apiEndpoint) return;

    setLoadingState(loadingKey, true);
    try {
      console.log(`🔍 Searching ${apiType}s for: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke(apiEndpoint, {
        body: { query: searchQuery }
      });

      if (searchId !== searchIdRef.current) return;

      if (error) throw error;

      if (data?.results && Array.isArray(data.results)) {
        console.log(`✅ Found ${data.results.length} ${apiType} results`);
        updateCategorizedResults(
          `${apiType}s` as keyof CategorizedResults, 
          data.results
        );
      }
    } catch (error) {
      console.error(`❌ ${apiType} search failed:`, error);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [setLoadingState, updateCategorizedResults]);

  // Search all external APIs in parallel
  const searchAllAPIs = useCallback(async (
    searchQuery: string,
    searchId: number
  ) => {
    console.log(`🚀 Searching all external APIs for: "${searchQuery}"`);

    // Search all API types in parallel
    const searchPromises = [
      searchSpecificAPI(searchQuery, 'book', searchId),
      searchSpecificAPI(searchQuery, 'movie', searchId),
      searchSpecificAPI(searchQuery, 'place', searchId),
      searchSpecificAPI(searchQuery, 'food', searchId)
    ];

    await Promise.all(searchPromises);
  }, [searchSpecificAPI]);

  // Main search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      resetResults();
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        loadingStates: {
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
      console.log(`🚀 Starting parallel search for: "${searchQuery}" (ID: ${searchId})`);

      // Search local DB and all external APIs in parallel
      await Promise.all([
        searchLocal(searchQuery, searchId),
        searchAllAPIs(searchQuery, searchId)
      ]);

      console.log(`✅ Parallel search completed for: "${searchQuery}"`);

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
  }, [searchLocal, searchAllAPIs, resetResults]);

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
    showAllResults: state.showAllResults,
    toggleShowAll
  };
};
