
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedSearchResults } from '@/hooks/use-unified-search';

export interface SearchLoading {
  local: boolean;
  classification: boolean;
  books: boolean;
  movies: boolean;
  places: boolean;
  food: boolean;
}

export interface Classification {
  classification: string;
  confidence: number;
  reasoning?: string;
}

export const useRealtimeUnifiedSearch = (query: string, options?: { mode?: 'quick' | 'deep' }) => {
  const [results, setResults] = useState<UnifiedSearchResults & { categorized: Record<string, any[]> }>({
    users: [],
    entities: [],
    reviews: [],
    recommendations: [],
    products: [],
    categorized: {
      books: [],
      movies: [],
      places: [],
      food: []
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<SearchLoading>({
    local: false,
    classification: false,
    books: false,
    movies: false,
    places: false,
    food: false
  });
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [showAllResults, setShowAllResults] = useState({
    users: false,
    entities: false,
    books: false,
    movies: false,
    places: false,
    food: false
  });
  
  // Default to quick mode if not specified
  const searchMode = options?.mode || 'quick';

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!query || query.trim().length < 2) {
        setResults({
          users: [],
          entities: [],
          reviews: [],
          recommendations: [],
          products: [],
          categorized: {
            books: [],
            movies: [],
            places: [],
            food: []
          }
        });
        setClassification(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setLoadingStates(prev => ({ ...prev, local: true }));

      try {
        // Get query classification to understand what kind of search it is
        setLoadingStates(prev => ({ ...prev, classification: true }));
        try {
          const { data: classData, error: classError } = await supabase.functions.invoke('classify-search-query', {
            body: { query }
          });
          
          if (classError) {
            console.error('Error classifying query:', classError);
          } else if (classData) {
            setClassification(classData);
            console.log('📊 Query classification:', classData);
          }
        } catch (classErr) {
          console.error('Classification error:', classErr);
        } finally {
          setLoadingStates(prev => ({ ...prev, classification: false }));
        }

        // Perform main search
        const { data, error: searchError } = await supabase.functions.invoke('search-all', {
          body: { 
            query,
            limit: 20,
            type: 'all',
            mode: searchMode
          }
        });
        
        if (searchError) {
          throw new Error(`Search failed: ${searchError.message}`);
        }

        console.log(`🔍 Search results (${searchMode} mode):`, data);
        
        // Organize results into categories
        const categorizedResults = {
          books: [],
          movies: [],
          places: [],
          food: []
        };

        // Categorize external products based on their types
        if (data?.products) {
          data.products.forEach((product: any) => {
            const productType = product.type || 'product';
            if (productType === 'book' || product.api_source === 'openlibrary' || product.api_source === 'google_books') {
              categorizedResults.books.push(product);
            } else if (productType === 'movie' || product.api_source === 'omdb' || product.api_source === 'tmdb') {
              categorizedResults.movies.push(product);
            } else if (productType === 'place' || product.api_source === 'google_places') {
              categorizedResults.places.push(product);
            } else if (productType === 'food') {
              categorizedResults.food.push(product);
            }
          });
        }

        // Update results with categorized data
        setResults({
          users: data?.users || [],
          entities: data?.entities || [],
          reviews: data?.reviews || [],
          recommendations: data?.recommendations || [],
          products: data?.products || [],
          categorized: categorizedResults
        });
        
        // Update error if any
        if (data?.errors?.length) {
          setError(data.errors[0]);
        }
        
      } catch (err) {
        console.error('Error performing search:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
        setLoadingStates(prev => ({ ...prev, local: false }));
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, searchMode]);

  return { 
    results, 
    isLoading, 
    loadingStates, 
    error, 
    classification,
    showAllResults,
    toggleShowAll,
    searchMode
  };
};
