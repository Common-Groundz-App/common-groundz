
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SearchResult = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
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
    const searchUsers = async () => {
      if (!query || query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .ilike('username', `%${query}%`)
          .limit(10);

        if (error) {
          throw error;
        }

        setResults(data as SearchResult[]);
      } catch (err) {
        console.error('Error searching users:', err);
        setError('Failed to search users. Please try again.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { 
    results, 
    isLoading, 
    error, 
    defaultUsers, 
    loadingDefaultUsers 
  };
}
