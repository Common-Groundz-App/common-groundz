
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LocalSuggestion {
  id: string;
  type: 'user' | 'entity' | 'product';
  name: string;
  image_url?: string | null;
  description?: string | null;
  metadata?: any;
}

export function useLocalSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<LocalSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch top users (limit 3)
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .ilike('username', `%${query}%`)
          .limit(3);

        if (usersError) {
          throw usersError;
        }

        // Fetch top entities (limit 3)
        const { data: entities, error: entitiesError } = await supabase
          .from('entities')
          .select('id, name, type, image_url, description')
          .or(`name.ilike.%${query}%, venue.ilike.%${query}%`)
          .eq('is_deleted', false)
          .limit(3);

        if (entitiesError) {
          throw entitiesError;
        }

        // Fetch cached products (limit 3)
        const { data: cachedQueries, error: queriesError } = await supabase
          .from('cached_queries')
          .select('id')
          .ilike('query', `%${query}%`)
          .order('last_fetched', { ascending: false })
          .limit(3);

        if (queriesError) {
          throw queriesError;
        }

        let products: any[] = [];

        if (cachedQueries && cachedQueries.length > 0) {
          const queryIds = cachedQueries.map(q => q.id);
          const { data: cachedProducts, error: productsError } = await supabase
            .from('cached_products')
            .select('*')
            .in('query_id', queryIds)
            .limit(3);

          if (!productsError && cachedProducts) {
            products = cachedProducts;
          }
        }

        // Combine all results
        const combinedResults: LocalSuggestion[] = [
          ...users.map(user => ({
            id: user.id,
            type: 'user' as const,
            name: user.username || 'Unknown User',
            image_url: user.avatar_url,
            description: user.bio
          })),
          ...entities.map(entity => ({
            id: entity.id,
            type: 'entity' as const,
            name: entity.name,
            image_url: entity.image_url,
            description: entity.description
          })),
          ...products.map(product => ({
            id: product.id,
            type: 'product' as const,
            name: product.name,
            image_url: product.image_url,
            description: product.description,
            metadata: product.metadata
          }))
        ];

        setSuggestions(combinedResults);
      } catch (err) {
        console.error('Error fetching local suggestions:', err);
        setError('Failed to get suggestions');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return {
    suggestions,
    isLoading,
    error
  };
}
