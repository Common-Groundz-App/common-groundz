
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Entity, RecommendationCategory } from '@/services/recommendation/types';

export type SearchResult = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export type EntitySearchResult = {
  id: string;
  name: string;
  type: string;
  venue: string | null;
  image_url: string | null;
  description: string | null;
  slug: string | null;
}

export type ReviewSearchResult = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  description: string | null;
  rating: number;
  entity_id: string | null;
  entities?: {
    id: string;
    name: string;
    slug: string | null;
    type: string;
    venue: string | null;
  } | null;
}

export type RecommendationSearchResult = {
  id: string;
  title: string;
  description: string | null;
  category: RecommendationCategory;
  rating: number;
  entity_id: string | null;
  entities?: {
    id: string;
    name: string;
    slug: string | null;
    type: string;
    venue: string | null;
  } | null;
}

export type ProductSearchResult = {
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
    purchase_url: string;
    [key: string]: any;
  }
}

export interface UnifiedSearchResults {
  users: SearchResult[];
  entities: EntitySearchResult[];
  reviews: ReviewSearchResult[];
  recommendations: RecommendationSearchResult[];
  products: ProductSearchResult[];
  errors?: string[] | null;
}

export function useUnifiedSearch(query: string, options: { skipProductSearch?: boolean } = {}) {
  const [results, setResults] = useState<UnifiedSearchResults>({
    users: [],
    entities: [],
    reviews: [],
    recommendations: [],
    products: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultUsers, setDefaultUsers] = useState<SearchResult[]>([]);
  const [loadingDefaultUsers, setLoadingDefaultUsers] = useState(false);

  // Fetch default users when the hook is initialized
  useEffect(() => {
    const fetchDefaultUsers = async () => {
      setLoadingDefaultUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .limit(10);

        if (error) {
          console.error('Error fetching default users:', error);
          return;
        }

        setDefaultUsers(data as SearchResult[]);
      } catch (err) {
        console.error('Error fetching default users:', err);
      } finally {
        setLoadingDefaultUsers(false);
      }
    };

    fetchDefaultUsers();
  }, []);

  useEffect(() => {
    const searchAll = async () => {
      if (!query || query.trim().length < 2) {
        setResults({
          users: [],
          entities: [],
          reviews: [],
          recommendations: [],
          products: []
        });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // If skipProductSearch is true, we'll add "local_only" to the request type
        // This ensures we only get results from the database, not from external APIs
        const { data, error } = await supabase.functions.invoke('search-all', {
          body: { 
            query: query, 
            limit: 5,
            // Only set type to local_only if skipProductSearch is true
            type: options.skipProductSearch ? "local_only" : "all"
          }
        });

        if (error) {
          throw error;
        }

        setResults(data as UnifiedSearchResults);
      } catch (err) {
        console.error('Error searching:', err);
        setError('Failed to search. Please try again.');
        setResults({
          users: [],
          entities: [],
          reviews: [],
          recommendations: [],
          products: []
        });
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      searchAll();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, options.skipProductSearch]);

  return { 
    results, 
    isLoading, 
    error, 
    defaultUsers, 
    loadingDefaultUsers,
    hasResults: results.users.length > 0 || 
                results.entities.length > 0 || 
                results.reviews.length > 0 || 
                results.recommendations.length > 0 ||
                results.products.length > 0
  };
}
