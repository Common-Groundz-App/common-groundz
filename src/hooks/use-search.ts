
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './use-debounce';

interface SearchResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${debouncedQuery}%`)
          .order('username')
          .limit(10);

        if (error) {
          console.error('Error searching users:', error);
          return;
        }

        setResults(data || []);
      } catch (err) {
        console.error('Error in search:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  return { results, isLoading };
}
