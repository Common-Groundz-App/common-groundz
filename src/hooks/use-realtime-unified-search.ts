
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedSearchResults } from '@/hooks/use-unified-search';

export interface SearchLoading {
  local: boolean;
  classification: boolean;
  books: boolean;
  movies: boolean;
  places: boolean;
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
      places: []
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<SearchLoading>({
    local: false,
    classification: false,
    books: false,
    movies: false,
    places: false
  });
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [showAllResults, setShowAllResults] = useState({
    users: false,
    entities: false,
    books: false,
    movies: false,
    places: false
  });
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  
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
      // Show dropdown for any query with 1+ characters
      if (!query || query.trim().length < 1) {
        setResults({
          users: [],
          entities: [],
          reviews: [],
          recommendations: [],
          products: [],
          categorized: {
            books: [],
            movies: [],
            places: []
          }
        });
        setClassification(null);
        setApiErrors([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setApiErrors([]);
      setLoadingStates(prev => ({ ...prev, local: true }));

      try {
        // Get query classification (non-blocking)
        setLoadingStates(prev => ({ ...prev, classification: true }));
        try {
          const { data: classData, error: classError } = await supabase.functions.invoke('classify-search-query', {
            body: { query }
          });
          
          if (!classError && classData) {
            setClassification(classData);
            console.log('📊 Query classification:', classData);
          }
        } catch (classErr) {
          console.error('Classification error (non-blocking):', classErr);
        } finally {
          setLoadingStates(prev => ({ ...prev, classification: false }));
        }

        // Perform main search with graceful error handling
        try {
          const { data, error: searchError } = await supabase.functions.invoke('search-all', {
            body: { 
              query,
              limit: 20,
              type: 'all',
              mode: searchMode
            }
          });
          
          if (searchError) {
            console.error('Search API error:', searchError);
            setApiErrors(prev => [...prev, 'Main search temporarily unavailable']);
          } else if (data) {
            console.log(`🔍 Search results (${searchMode} mode):`, data);
            
            // Use categorized results from the backend with fallbacks
            const categorizedResults = data?.categorized || {
              books: [],
              movies: [],
              places: []
            };

            // Update results with properly categorized data
            setResults({
              users: data?.users || [],
              entities: data?.entities || [],
              reviews: data?.reviews || [],
              recommendations: data?.recommendations || [],
              products: data?.products || [],
              categorized: categorizedResults
            });
            
            // Collect any API errors from the backend
            if (data?.errors?.length) {
              setApiErrors(prev => [...prev, ...data.errors]);
            }
          }
        } catch (searchErr) {
          console.error('Search request failed:', searchErr);
          setApiErrors(prev => [...prev, 'Search service temporarily unavailable']);
        }
        
      } catch (err) {
        console.error('Error performing search:', err);
        setError('Search temporarily unavailable. Please try again.');
      } finally {
        setIsLoading(false);
        setLoadingStates(prev => ({ ...prev, local: false }));
      }
    };

    // Reduced debounce for faster response
    const debounceTimer = setTimeout(performSearch, 200);
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
    searchMode,
    apiErrors
  };
};
