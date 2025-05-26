import { useState, useEffect } from 'react';
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
}

export interface ReviewSearchResult {
  id: string;
  title: string;
  content: string;
  rating: number;
  entity_name: string;
  username: string;
  avatar_url: string | null;
  entities?: {
    name: string;
  };
}

export interface RecommendationSearchResult {
  id: string;
  title: string;
  content: string;
  rating: number;
  entity_name: string;
  username: string;
  avatar_url: string | null;
  category: string;
  entities?: {
    name: string;
  };
}

export interface SearchResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface UnifiedSearchResults {
  products: ProductSearchResult[];
  entities: EntitySearchResult[];
  reviews: ReviewSearchResult[];
  recommendations: RecommendationSearchResult[];
  users: SearchResult[];
}

// Helper function to classify search queries
const classifyQuery = (query: string): 'book' | 'movie' | 'place' | 'food' | 'product' | 'general' => {
  const lowerQuery = query.toLowerCase();
  
  // Book indicators
  if (lowerQuery.includes('book') || lowerQuery.includes('novel') || lowerQuery.includes('author') || 
      lowerQuery.includes('paperback') || lowerQuery.includes('hardcover') || lowerQuery.includes('ebook') ||
      lowerQuery.includes('read') || lowerQuery.includes('chapter') || lowerQuery.includes('library')) {
    return 'book';
  }
  
  // Movie indicators
  if (lowerQuery.includes('movie') || lowerQuery.includes('film') || lowerQuery.includes('cinema') ||
      lowerQuery.includes('director') || lowerQuery.includes('actor') || lowerQuery.includes('watch') ||
      lowerQuery.includes('netflix') || lowerQuery.includes('streaming')) {
    return 'movie';
  }
  
  // Place indicators
  if (lowerQuery.includes('restaurant') || lowerQuery.includes('cafe') || lowerQuery.includes('hotel') ||
      lowerQuery.includes('place') || lowerQuery.includes('location') || lowerQuery.includes('visit') ||
      lowerQuery.includes('near me') || lowerQuery.includes('address')) {
    return 'place';
  }
  
  // Food indicators
  if (lowerQuery.includes('recipe') || lowerQuery.includes('cook') || lowerQuery.includes('dish') ||
      lowerQuery.includes('meal') || lowerQuery.includes('food') || lowerQuery.includes('cuisine')) {
    return 'food';
  }
  
  // Product indicators (brands, shopping terms)
  if (lowerQuery.includes('buy') || lowerQuery.includes('shop') || lowerQuery.includes('price') ||
      lowerQuery.includes('amazon') || lowerQuery.includes('store') || lowerQuery.includes('brand') ||
      lowerQuery.includes('product')) {
    return 'product';
  }
  
  return 'general';
};

export const useUnifiedSearch = (query: string, options?: { skipProductSearch?: boolean }) => {
  const [results, setResults] = useState<UnifiedSearchResults>({
    products: [],
    entities: [],
    reviews: [],
    recommendations: [],
    users: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performSearch = async () => {
      if (!query || query.trim().length < 2) {
        setResults({
          products: [],
          entities: [],
          reviews: [],
          recommendations: [],
          users: []
        });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchType = classifyQuery(query);
        console.log(`🔍 Classified query "${query}" as: ${searchType}`);

        let searchResults: UnifiedSearchResults = {
          products: [],
          entities: [],
          reviews: [],
          recommendations: [],
          users: []
        };

        // Route to specific API based on classification
        if (searchType === 'book') {
          console.log('📚 Searching books specifically...');
          try {
            const { data: bookData } = await supabase.functions.invoke('search-books', {
              body: { query }
            });
            if (bookData?.results) {
              searchResults.products = bookData.results;
            }
          } catch (bookError) {
            console.error('Book search failed, falling back to general search:', bookError);
          }
        } else if (searchType === 'movie') {
          console.log('🎬 Searching movies specifically...');
          try {
            const { data: movieData } = await supabase.functions.invoke('search-movies', {
              body: { query }
            });
            if (movieData?.results) {
              searchResults.products = movieData.results;
            }
          } catch (movieError) {
            console.error('Movie search failed, falling back to general search:', movieError);
          }
        } else if (searchType === 'place') {
          console.log('📍 Searching places specifically...');
          try {
            const { data: placeData } = await supabase.functions.invoke('search-places', {
              body: { query }
            });
            if (placeData?.results) {
              searchResults.products = placeData.results;
            }
          } catch (placeError) {
            console.error('Place search failed, falling back to general search:', placeError);
          }
        } else if (searchType === 'food') {
          console.log('🍳 Searching food/recipes specifically...');
          try {
            const { data: foodData } = await supabase.functions.invoke('search-food', {
              body: { query }
            });
            if (foodData?.results) {
              searchResults.products = foodData.results;
            }
          } catch (foodError) {
            console.error('Food search failed, falling back to general search:', foodError);
          }
        }

        // If no results from specific API or it's a general/product query, try the unified search
        if (searchResults.products.length === 0 && !options?.skipProductSearch) {
          console.log('🔄 No specific results found, trying unified search...');
          const { data, error: searchError } = await supabase.functions.invoke('search-all', {
            body: { 
              query,
              limit: 20,
              type: 'all'
            }
          });
          
          if (searchError) {
            throw new Error(`Search failed: ${searchError.message}`);
          }
          
          searchResults = {
            products: data?.products || [],
            entities: data?.entities || [],
            reviews: data?.reviews || [],
            recommendations: data?.recommendations || [],
            users: data?.users || []
          };
        }

        console.log(`✅ Search completed. Found: ${searchResults.products.length} products, ${searchResults.entities.length} entities`);
        setResults(searchResults);
        
      } catch (err) {
        console.error('Error performing search:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setResults({
          products: [],
          entities: [],
          reviews: [],
          recommendations: [],
          users: []
        });
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, options?.skipProductSearch]);

  return { results, isLoading, error };
};
