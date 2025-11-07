import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Entity } from '@/services/recommendation/types';
import { useUniversalEntitySearch } from '@/hooks/use-universal-entity-search';
import { X, Search, Loader2 } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';
import { Badge } from '@/components/ui/badge';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';

// Use the correct Entity type from useEntitySearch
interface SearchEntity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  type: EntityTypeString;
  venue?: string;
  api_source?: string;
  api_ref?: string;
  metadata?: any;
  slug?: string;
}

interface ParentEntitySelectorProps {
  currentEntity?: Entity;
  selectedParent?: Entity | null;
  onParentChange: (parent: Entity | null) => void;
  className?: string;
}

export function ParentEntitySelector({ 
  currentEntity, 
  selectedParent, 
  onParentChange, 
  className = '' 
}: ParentEntitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const { localResults, isLoading, handleSearch } = useUniversalEntitySearch();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.length >= 2) {
      handleSearch(value);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  // Filter out current entity and potential circular references
  const filteredResults = localResults.filter(entity => {
    // Don't show the current entity
    if (currentEntity && entity.id === currentEntity.id) {
      return false;
    }
    
    // TODO: Add more sophisticated circular reference checking
    // For now, just prevent direct self-selection
    return true;
  });

  const handleEntitySelect = (entity: SearchEntity) => {
    // Convert the search entity to match the expected Entity type
    const convertedEntity: Entity = {
      ...entity,
      type: mapStringToEntityType(entity.type),
      api_ref: entity.api_ref || null,
      api_source: entity.api_source || null,
      metadata: entity.metadata || {},
      venue: entity.venue || null,
      website_url: null,
      slug: entity.slug || null, // Preserve the parent's slug
      category_id: null,
      popularity_score: null,
      photo_reference: null,
      created_at: null,
      updated_at: null,
      authors: null,
      publication_year: null,
      isbn: null,
      languages: null,
      external_ratings: null,
      price_info: null,
      specifications: null,
      cast_crew: null,
      ingredients: null,
      nutritional_info: null,
      last_enriched_at: null,
      enrichment_source: null,
      data_quality_score: null
    };
    onParentChange(convertedEntity);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleClearParent = () => {
    onParentChange(null);
    setSearchQuery('');
  };


  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Part of</label>
        <p className="text-xs text-muted-foreground">
          Select the brand, collection, or group this is part of.
        </p>
        
        {/* Current parent display */}
        {selectedParent && (
          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
            <ImageWithFallback
              src={selectedParent.image_url || ''}
              alt={selectedParent.name}
              className="w-8 h-8 rounded object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedParent.name}</p>
              <Badge variant="outline" className="text-xs">
                {getEntityTypeLabel(selectedParent.type)}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearParent}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          </div>
        )}


        {/* Search input */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search existing items..."
              className="pl-10"
              onFocus={() => {
                if (searchQuery.length >= 2) {
                  setShowResults(true);
                }
              }}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && (
            <div
              ref={resultsRef}
              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              {filteredResults.length > 0 ? (
                <div className="p-1">
                  {filteredResults.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      onClick={() => handleEntitySelect(entity)}
                      className="w-full flex items-center gap-3 p-2 text-left hover:bg-accent rounded-sm transition-colors"
                    >
                      <ImageWithFallback
                        src={entity.image_url || ''}
                        alt={entity.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{entity.name}</p>
                        {entity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entity.description}
                          </p>
                        )}
                        <Badge variant="outline" className="text-xs mt-1">
                          {getEntityTypeLabel(entity.type)}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 && !isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No entities found for "{searchQuery}"
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}