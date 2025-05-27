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

interface EnhancedSearchState {
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
  showAllResults: {
    books: boolean;
    movies: boolean;
    places: boolean;
    food: boolean;
    entities: boolean;
    users: boolean;
  };
}

// Enhanced local fallback classification
const classifyQueryLocally = (query: string): SearchClassification => {
  const lowerQuery = query.toLowerCase();
  
  // Book indicators with better patterns
  const bookPatterns = [
    /\b(book|novel|author|read|chapter|library|paperback|hardcover|ebook)\b/,
    /\b(song of ice and fire|game of thrones|harry potter|lord of the rings)\b/,
    /\b(monk who sold|ferrari)\b/,
    /\b(book series|trilogy|saga)\b/
  ];
  
  // Movie indicators
  const moviePatterns = [
    /\b(movie|film|cinema|director|actor|watch|streaming|netflix)\b/
  ];
  
  // Place indicators
  const placePatterns = [
    /\b(restaurant|cafe|hotel|place|location|visit|near me|address)\b/
  ];
  
  // Food indicators
  const foodPatterns = [
    /\b(recipe|cook|dish|meal|food|cuisine|ingredient)\b/
  ];
  
  if (bookPatterns.some(pattern => pattern.test(lowerQuery))) {
    return { 
      classification: 'book', 
      confidence: 0.85, 
      reasoning: 'Local keyword matching detected book-related terms',
      api_used: 'fallback' 
    };
  }
  
  if (moviePatterns.some(pattern => pattern.test(lowerQuery))) {
    return { 
      classification: 'movie', 
      confidence: 0.85, 
      reasoning: 'Local keyword matching detected movie-related terms',
      api_used: 'fallback' 
    };
  }
  
  if (placePatterns.some(pattern => pattern.test(lowerQuery))) {
    return { 
      classification: 'place', 
      confidence: 0.85, 
      reasoning: 'Local keyword matching detected place-related terms',
      api_used: 'fallback' 
    };
  }
  
  if (foodPatterns.some(pattern => pattern.test(lowerQuery))) {
    return { 
      classification: 'food', 
      confidence: 0.85, 
      reasoning: 'Local keyword matching detected food-related terms',
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
      classification: false,
      local: false,
      books: false,
      movies: false,
      places: false,
      food: false,
      products: false,
    },
    error: null,
    classification: null,
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

  // Classify search query with enhanced local fallback
  const classifyQuery = useCallback(async (searchQuery: string): Promise<SearchClassification> => {
    setLoadingState('classification', true);
    try {
      console.log(`🤖 Classifying query: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke('classify-search-query', {
        body: { query: searchQuery }
      });

      if (error) {
        console.warn('LLM classification failed, using enhanced local fallback:', error);
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
      console.warn('Classification service error, using enhanced local fallback:', error);
      return classifyQueryLocally(searchQuery);
    } finally {
      setLoadingState('classification', false);
    }
  }, [setLoadingState]);

  // Search specific API (keeping existing logic)
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

    const loadingKey = `${classification}s` as keyof EnhancedSearchState['loadingStates'];
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

  // Search all APIs (keeping existing logic)
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
      console.log(`🚀 Starting enhanced search for: "${searchQuery}" (ID: ${searchId})`);

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

      console.log(`✅ Enhanced search completed for: "${searchQuery}"`);

    } catch (error) {
      console.error('💥 Enhanced search error:', error);
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
    classification: state.classification,
    showAllResults: state.showAllResults,
    toggleShowAll
  };
};
