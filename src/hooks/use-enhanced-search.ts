
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductSearchResult {
  name: string;
  venue: string;
  description: string | null;
  image_url: string;
  api_source: string;
  api_ref: string;
  metadata: {
    price?: string;
    rating?: number;
    seller?: string;
    purchase_url?: string;
    [key: string]: any;
  };
}

export interface EntitySearchResult {
  id: string;
  name: string;
  type: string;
  venue: string | null;
  image_url: string | null;
  description: string | null;
  slug: string | null;
  category_id?: string | null;
}

export interface UserSearchResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface CategorizedResults {
  books: ProductSearchResult[];
  movies: ProductSearchResult[];
  places: ProductSearchResult[];
  food: ProductSearchResult[];
  products: ProductSearchResult[];
}

interface UnifiedSearchResults {
  products: ProductSearchResult[];
  entities: EntitySearchResult[];
  reviews: any[];
  recommendations: any[];
  users: UserSearchResult[];
  categorized: CategorizedResults;
}

interface EnhancedSearchState {
  results: UnifiedSearchResults;
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

const preprocessQuery = (query: string): string[] => {
  const normalizedQuery = query.toLowerCase().trim();
  const variations = [normalizedQuery];
  
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

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const searchLocal = useCallback(async (searchQuery: string, searchId: number) => {
    console.log(`🏠 Starting local search for: "${searchQuery}"`);
    setLoadingState('local', true);
    
    try {
      const queryVariations = preprocessQuery(searchQuery);
      console.log(`🔍 Search variations:`, queryVariations);
      
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
      
      const uniqueEntities = Array.from(
        new Map(allEntities.map(entity => [entity.id, entity])).values()
      ).sort((a, b) => {
        const aExact = queryVariations.some(v => a.name.toLowerCase().includes(v));
        const bExact = queryVariations.some(v => b.name.toLowerCase().includes(v));
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

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

      console.log(`✅ Local search completed: ${uniqueEntities.length} entities, ${uniqueUsers.length} users`);
      updateLocalResults({
        entities: uniqueEntities,
        reviews: [],
        recommendations: [],
        users: uniqueUsers
      });
    } catch (error) {
      console.error('❌ Local search failed:', error);
      if (searchId === searchIdRef.current) {
        console.warn('Local search failed, but continuing with other searches');
      }
    } finally {
      setLoadingState('local', false);
    }
  }, [setLoadingState, updateLocalResults]);

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

    console.log(`🔍 Starting ${apiType} search for: "${searchQuery}"`);
    setLoadingState(loadingKey, true);
    
    try {
      const { data, error } = await supabase.functions.invoke(apiEndpoint, {
        body: { query: searchQuery }
      });

      if (searchId !== searchIdRef.current) return;

      if (error) {
        console.error(`❌ ${apiType} API error:`, error);
        return;
      }

      if (data?.results && Array.isArray(data.results)) {
        console.log(`✅ Found ${data.results.length} ${apiType} results`);
        updateCategorizedResults(
          `${apiType}s` as keyof CategorizedResults, 
          data.results
        );
      } else {
        console.log(`⚠️ ${apiType} API returned no results or unexpected format`);
      }
    } catch (error) {
      console.error(`❌ ${apiType} search failed:`, error);
      // Continue without setting global error
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [setLoadingState, updateCategorizedResults]);

  const searchAllAPIs = useCallback(async (
    searchQuery: string,
    searchId: number
  ) => {
    console.log(`🚀 Starting parallel API search for: "${searchQuery}"`);

    const searchPromises = [
      searchSpecificAPI(searchQuery, 'book', searchId),
      searchSpecificAPI(searchQuery, 'movie', searchId),
      searchSpecificAPI(searchQuery, 'place', searchId),
      searchSpecificAPI(searchQuery, 'food', searchId)
    ];

    await Promise.allSettled(searchPromises);
    console.log(`🏁 All API searches completed for: "${searchQuery}"`);
  }, [searchSpecificAPI]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 1) {
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
    console.log(`🚀 Starting enhanced search for: "${searchQuery}" (ID: ${searchId})`);
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    resetResults();

    try {
      // Search local DB and all external APIs in parallel - continue even if some fail
      await Promise.allSettled([
        searchLocal(searchQuery, searchId),
        searchAllAPIs(searchQuery, searchId)
      ]);

      console.log(`✅ Enhanced search completed for: "${searchQuery}"`);

    } catch (error) {
      console.error('💥 Search error:', error);
      if (searchId === searchIdRef.current) {
        setError('Some search sources are temporarily unavailable');
      }
    } finally {
      if (searchId === searchIdRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [searchLocal, searchAllAPIs, resetResults, setError]);

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
