
import React, { useState, useEffect } from 'react';
import { Entity, EntityType } from '@/services/recommendation/types';
import { supabase } from '@/integrations/supabase/client';
import { Search, Book, Film, MapPin, ShoppingBag, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface EntitySearchProps {
  type: EntityType;
  onSelect: (entity: Entity) => void;
}

interface ExternalSearchResult {
  name: string;
  venue: string | null;
  description: string | null;
  image_url: string | null;
  api_source: string;
  api_ref: string;
  metadata: any;
}

export function EntitySearch({ type, onSelect }: EntitySearchProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Get the appropriate icon based on entity type
  const getEntityIcon = () => {
    switch (type) {
      case 'book':
        return <Book className="h-4 w-4" />;
      case 'movie':
        return <Film className="h-4 w-4" />;
      case 'place':
        return <MapPin className="h-4 w-4" />;
      case 'product':
        return <ShoppingBag className="h-4 w-4" />;
      case 'food':
        return <Coffee className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  // Search local entities first
  const searchLocalEntities = async () => {
    if (!query.trim()) return [];
    
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', type)
        .eq('is_deleted', false)
        .ilike('name', `%${query}%`)
        .order('name');
      
      if (error) throw error;
      return data as Entity[];
    } catch (error) {
      console.error('Error searching local entities:', error);
      return [];
    }
  };

  // Search external API based on entity type
  const searchExternalAPI = async (): Promise<ExternalSearchResult[]> => {
    if (!query.trim()) return [];
    
    try {
      let functionName = '';
      
      switch (type) {
        case 'place':
          functionName = 'search-places';
          break;
        case 'movie':
          functionName = 'search-movies';
          break;
        default:
          return []; // No external API for other types yet
      }
      
      if (!functionName) return [];
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { query }
      });
      
      if (error) throw error;
      return data.results || [];
    } catch (error) {
      console.error(`Error searching external API for ${type}:`, error);
      return [];
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      // Search local entities
      const localResults = await searchLocalEntities();
      setResults(localResults);
      
      // Search external API
      const externalResults = await searchExternalAPI();
      setExternalResults(externalResults);
    } catch (error) {
      console.error('Error during search:', error);
      toast({
        title: 'Search failed',
        description: 'Failed to search for entities. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle select from existing entity
  const handleSelectEntity = (entity: Entity) => {
    onSelect(entity);
    setShowResults(false);
    setQuery('');
  };

  // Handle select from external search result
  const handleSelectExternal = async (result: ExternalSearchResult) => {
    try {
      // Create a new entity from the external result
      const { data, error } = await supabase
        .from('entities')
        .insert({
          name: result.name,
          type: type,
          venue: result.venue,
          description: result.description,
          image_url: result.image_url,
          api_source: result.api_source,
          api_ref: result.api_ref,
          metadata: result.metadata,
          is_deleted: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      onSelect(data as Entity);
      setShowResults(false);
      setQuery('');
    } catch (error) {
      console.error('Error creating entity from external result:', error);
      toast({
        title: 'Failed to save',
        description: 'Could not create entity from external result.',
        variant: 'destructive'
      });
    }
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowResults(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={`Search for ${type}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pr-8"
          />
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            {getEntityIcon()}
          </div>
        </div>
        <Button type="button" onClick={handleSearch} disabled={!query.trim()}>
          Search
        </Button>
      </div>

      {showResults && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {results.length === 0 && externalResults.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No results found
                </div>
              )}
              
              {results.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                    Previous Recommendations
                  </div>
                  {results.map((entity) => (
                    <div
                      key={entity.id}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => handleSelectEntity(entity)}
                    >
                      <div className="font-medium">{entity.name}</div>
                      {entity.venue && (
                        <div className="text-xs text-gray-500">{entity.venue}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
              
              {externalResults.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                    External Results
                  </div>
                  {externalResults.map((result, idx) => (
                    <div
                      key={`${result.api_source}-${result.api_ref || idx}`}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => handleSelectExternal(result)}
                    >
                      <div className="font-medium">{result.name}</div>
                      {result.venue && (
                        <div className="text-xs text-gray-500">{result.venue}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EntitySearch;
