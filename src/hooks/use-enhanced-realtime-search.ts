
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedSearchResults } from '@/hooks/use-unified-search';
import { searchHashtags } from '@/services/hashtagService';

export interface SearchLoading {
  local: boolean;
  external: boolean;
}

export const useEnhancedRealtimeSearch = (query: string, options?: { mode?: 'quick' | 'deep' }) => {
  const [results, setResults] = useState<UnifiedSearchResults & { categorized: Record<string, any[]>; hashtags?: any[] }>({
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
          hashtags: [],
          categorized: {
            books: [],
            movies: [],
            places: []
          }
        });
        return;
      }

      setIsLoading(true);
      setError(null);
      setLoadingStates({ local: true, external: true });

      try {
        console.log(`🔍 Enhanced search starting for: "${query}"`);
        
        const { data, error: searchError } = await supabase.functions.invoke('unified-search-v2', {
          body: { 
            query,
            limit: 20,
            type: 'all',
            mode: searchMode
          }
        });
        
        if (searchError) {
          console.error('Enhanced search API error:', searchError);
          setError('Search temporarily unavailable. Please try again.');
        } else if (data) {
          console.log(`✅ Enhanced search results (${searchMode} mode):`, data);
          
          // Search hashtags if query starts with #
          let hashtagResults = [];
          if (query.startsWith('#') && query.length > 1) {
            const hashtagQuery = query.substring(1);
            hashtagResults = await searchHashtags(hashtagQuery, 10);
          } else if (query.length >= 2) {
            // Also search hashtags for general queries
            hashtagResults = await searchHashtags(query, 5);
          }

          // Update results with the enhanced categorized data
          setResults({
            users: data?.users || [],
            entities: data?.entities || [],
            reviews: data?.reviews || [],
            recommendations: data?.recommendations || [],
            products: data?.products || [],
            hashtags: hashtagResults,
            categorized: data?.categorized || {
              books: [],
              movies: [],
              places: []
            }
          });

          // Log circuit breaker status if available
          if (data?.circuit_status) {
            console.log('🔧 Circuit breaker status:', data.circuit_status);
          }
        }
        
      } catch (err) {
        console.error('Enhanced search request failed:', err);
        setError('Search service temporarily unavailable. Please try again.');
      } finally {
        setIsLoading(false);
        setLoadingStates({ local: false, external: false });
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
    showAllResults,
    toggleShowAll,
    searchMode
  };
};
