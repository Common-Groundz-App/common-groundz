
import React, { useState, useEffect } from 'react';
import { Entity, EntityType } from '@/services/recommendation/types';
import { Search, Book, Film, MapPin, ShoppingBag, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntitySearch } from '@/hooks/use-entity-search';

interface EntitySearchProps {
  type: EntityType;
  onSelect: (entity: Entity) => void;
}

export function EntitySearch({ type, onSelect }: EntitySearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  const {
    localResults,
    externalResults,
    isLoading,
    handleSearch,
    createEntityFromExternal
  } = useEntitySearch(type);

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

  // Handle select from existing entity
  const handleSelectEntity = (entity: Entity) => {
    onSelect(entity);
    setShowResults(false);
    setSearchQuery('');
  };

  // Handle select from external search result
  const handleSelectExternal = async (result: any) => {
    const entity = await createEntityFromExternal(result);
    if (entity) {
      onSelect(entity);
      setShowResults(false);
      setSearchQuery('');
    }
  };

  // Search when query changes
  const triggerSearch = () => {
    handleSearch(searchQuery);
    setShowResults(true);
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
            className="pr-8"
          />
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            {getEntityIcon()}
          </div>
        </div>
        <Button type="button" onClick={triggerSearch} disabled={!searchQuery.trim()}>
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
              {localResults.length === 0 && externalResults.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No results found
                </div>
              )}
              
              {localResults.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                    Previous Recommendations
                  </div>
                  {localResults.map((entity) => (
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
                      {result.description && (
                        <div className="text-xs text-gray-600 truncate">{result.description}</div>
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
