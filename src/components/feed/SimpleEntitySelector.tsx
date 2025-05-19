import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Entity } from '@/services/recommendation/types';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { SelectValue, SelectTrigger, SelectContent, Select, SelectItem } from '@/components/ui/select';
import { Navigation, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/contexts/LocationContext';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { EntityAdapter } from '@/components/profile/circles/types';

interface SimpleEntitySelectorProps {
  onEntitiesChange: (entities: EntityAdapter[]) => void;
  initialEntities?: EntityAdapter[];
}

export function SimpleEntitySelector({ onEntitiesChange, initialEntities = [] }: SimpleEntitySelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<EntityAdapter[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityType, setEntityType] = useState<EntityTypeString>('place');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const { localResults, externalResults, isLoading, handleSearch, createEntityFromExternal } = useEntitySearch(entityType);
  const { 
    position, 
    locationEnabled, 
    enableLocation, 
    disableLocation,
    isLoading: geoLoading,
    permissionStatus,
    formatDistance
  } = useLocation();

  // Handle click outside to close results dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Keyboard event handler for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery && showResults) {
          e.preventDefault();
          clearSearch();
        } else if (showResults) {
          setShowResults(false);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchQuery, showResults]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length >= 2) {
      setShowResults(true);
      handleSearch(query, locationEnabled, position);
    } else {
      setShowResults(false);
    }
  };
  
  // Clear search input and hide results
  const clearSearch = () => {
    setSearchQuery('');
    setShowResults(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Perform search when location status changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      handleSearch(searchQuery, locationEnabled, position);
    }
  }, [position, locationEnabled, searchQuery]);
  
  // Handle entity selection
  const handleEntitySelect = (entity: EntityAdapter) => {
    if (!selectedEntities.some(e => e.id === entity.id)) {
      const newEntities = [...selectedEntities, entity];
      setSelectedEntities(newEntities);
      onEntitiesChange(newEntities);
      setSearchQuery('');
      setShowResults(false);
    }
  };

  // Handle external result selection with improved error handling
  const handleExternalResultSelect = async (result: any) => {
    try {
      // Create an entity from the external result (or find existing)
      const entity = await createEntityFromExternal(result);
      if (entity) {
        handleEntitySelect(entity as EntityAdapter);
      } else {
        console.error('Failed to create or retrieve entity');
      }
    } catch (error) {
      console.error('Error selecting external result:', error);
      // Show toast error message
      toast({
        title: 'Error',
        description: 'Could not select this item. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  // Toggle location-based search
  const toggleLocationSearch = () => {
    if (locationEnabled) {
      disableLocation();
    } else {
      enableLocation();
    }
  };
  
  // Get button text based on location state
  const getLocationButtonText = () => {
    if (geoLoading) return "Getting location...";
    if (permissionStatus === 'denied') return "Location access denied";
    if (locationEnabled && position) return "Near me";
    return "Use my location";
  };

  // Get image URL for entity or result based on type
  const getImageUrl = (item: any) => {
    if (item.image_url) return item.image_url;
    
    // For place/food results from Google, check for photos in metadata
    if ((entityType === 'place' || entityType === 'food') && 
        item.metadata?.photos && 
        item.metadata.photos.length > 0) {
      // In a real app, you'd proxy this through a Supabase function
      // return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photoreference=${
      //   item.metadata.photos[0].photo_reference
      // }&key=YOUR_API_KEY`;
      
      // For now, use a placeholder for places
      return "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
    }
    
    // Type-specific placeholder images
    switch (entityType) {
      case 'movie':
        return "https://images.unsplash.com/photo-1542204165-65bf26472b9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'book':
        return "https://images.unsplash.com/photo-1544947950-fa07a98d237f?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'product':
        return "https://images.unsplash.com/photo-1546868871-7041f2a55e12?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      default:
        return "https://images.unsplash.com/photo-1495195134817-aeb325a55b65?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
    }
  };

  // Check if we should show distance for a result
  const shouldShowDistance = (item: any) => {
    // Only show distance if location is enabled AND distance exists in metadata
    return locationEnabled && item.metadata?.distance !== undefined;
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Tag a place, product, or media</h4>
      
      <div className="space-y-2">
        <div className="flex gap-2">
          <Select 
            value={entityType}
            onValueChange={(value) => setEntityType(value as EntityTypeString)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="place">Place</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="movie">Movie</SelectItem>
              <SelectItem value="book">Book</SelectItem>
              <SelectItem value="product">Product</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1">
            <Input
              placeholder={`Search for a ${entityType}...`}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pr-8"
              ref={inputRef}
              aria-label={`Search for ${entityType}`}
              aria-expanded={showResults}
              aria-controls="simple-entity-search-results"
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : searchQuery.trim() ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="h-6 w-6 p-0"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        
        {/* Location toggle for place/food entities */}
        {(entityType === 'place' || entityType === 'food') && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant={locationEnabled ? "secondary" : "outline"}
              size="sm"
              className="flex items-center gap-1 text-xs h-7"
              onClick={toggleLocationSearch}
              disabled={geoLoading || permissionStatus === 'denied'}
            >
              <Navigation className={`h-3.5 w-3.5 ${geoLoading ? 'animate-pulse' : ''}`} />
              {getLocationButtonText()}
            </Button>
            
            {locationEnabled && position && (
              <Badge variant="outline" className="text-xs bg-accent/30 border-none">
                Using your location
              </Badge>
            )}
          </div>
        )}
        
        {/* Search Results */}
        {searchQuery.length >= 2 && showResults && (
          <div 
            id="simple-entity-search-results"
            ref={resultsRef}
            className="border rounded-md max-h-40 overflow-y-auto"
            role="listbox"
          >
            {isLoading || geoLoading ? (
              <div className="p-2 text-sm text-center">Loading...</div>
            ) : (
              <>
                {/* Local Results Section */}
                {localResults.length > 0 && (
                  <div className="divide-y">
                    {localResults.map((entity) => (
                      <div
                        key={entity.id}
                        className="flex items-center hover:bg-accent/30 cursor-pointer p-2"
                        onClick={() => handleEntitySelect(entity)}
                        role="option"
                        aria-selected="false"
                      >
                        {/* Entity Image */}
                        <div className="flex-shrink-0 mr-2">
                          <ImageWithFallback
                            src={getImageUrl(entity)}
                            alt={entity.name}
                            className="w-8 h-8 object-cover rounded"
                            fallbackSrc={getImageUrl({})}
                          />
                        </div>
                        
                        {/* Entity Details */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{entity.name}</div>
                          {shouldShowDistance(entity) && (
                            <div className="text-xs text-brand-orange">
                              {formatDistance(entity.metadata.distance)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* External Results Section */}
                {externalResults.length > 0 && (
                  <div className="divide-y">
                    {externalResults.map((result, index) => (
                      <div
                        key={`external-${index}-${result.name}`}
                        className="flex items-center hover:bg-accent/30 cursor-pointer p-2"
                        onClick={() => handleExternalResultSelect(result)}
                        role="option"
                        aria-selected="false"
                      >
                        {/* Result Image */}
                        <div className="flex-shrink-0 mr-2">
                          <ImageWithFallback
                            src={getImageUrl(result)}
                            alt={result.name}
                            className="w-8 h-8 object-cover rounded"
                            fallbackSrc={getImageUrl({})}
                          />
                        </div>
                        
                        {/* Result Details */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{result.name}</div>
                          {shouldShowDistance(result) && (
                            <div className="text-xs text-brand-orange">
                              {formatDistance(result.metadata.distance)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No Results Message */}
                {localResults.length === 0 && externalResults.length === 0 && (
                  <div className="p-2 text-sm text-center text-muted-foreground">
                    No results found
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
