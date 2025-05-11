
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Entity, EntityType } from '@/services/recommendation/types';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { SelectValue, SelectTrigger, SelectContent, Select, SelectItem } from '@/components/ui/select';
import { Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/contexts/LocationContext';

interface SimpleEntitySelectorProps {
  onEntitiesChange: (entities: Entity[]) => void;
  initialEntities?: Entity[];
}

export function SimpleEntitySelector({ onEntitiesChange, initialEntities = [] }: SimpleEntitySelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('place');
  
  const { localResults, externalResults, isLoading, handleSearch, createEntityFromExternal } = useEntitySearch(entityType);
  const { 
    position, 
    locationEnabled, 
    enableLocation, 
    disableLocation,
    isLoading: geoLoading,
    permissionStatus
  } = useLocation();

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length >= 2) {
      handleSearch(query, locationEnabled, position);
    }
  };
  
  // Perform search when location status changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      handleSearch(searchQuery, locationEnabled, position);
    }
  }, [position, locationEnabled, searchQuery]);
  
  // Handle entity selection
  const handleEntitySelect = (entity: Entity) => {
    if (!selectedEntities.some(e => e.id === entity.id)) {
      const newEntities = [...selectedEntities, entity];
      setSelectedEntities(newEntities);
      onEntitiesChange(newEntities);
      setSearchQuery('');
    }
  };

  // Handle external result selection
  const handleExternalResultSelect = async (result: any) => {
    // Create an entity from the external result
    const entity = await createEntityFromExternal(result);
    if (entity) {
      handleEntitySelect(entity);
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

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Tag a place, product, or media</h4>
      
      <div className="space-y-2">
        <div className="flex gap-2">
          <Select 
            value={entityType}
            onValueChange={(value) => setEntityType(value as EntityType)}
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
              className="w-full"
            />
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
        {searchQuery.length >= 2 && (
          <div className="border rounded-md max-h-40 overflow-y-auto">
            {isLoading || geoLoading ? (
              <div className="p-2 text-sm text-center">Loading...</div>
            ) : (
              <>
                {/* Local Results Section */}
                {localResults.length > 0 && (
                  <div className="divide-y">
                    {localResults.map((entity) => (
                      <Button
                        key={entity.id}
                        type="button"
                        variant="ghost"
                        className="w-full justify-start text-left h-auto py-2 px-3"
                        onClick={() => handleEntitySelect(entity)}
                      >
                        <span className="truncate">{entity.name}</span>
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* External Results Section */}
                {externalResults.length > 0 && (
                  <div className="divide-y">
                    {externalResults.map((result, index) => (
                      <Button
                        key={`external-${index}-${result.name}`}
                        type="button"
                        variant="ghost"
                        className="w-full justify-start text-left h-auto py-2 px-3"
                        onClick={() => handleExternalResultSelect(result)}
                      >
                        <div className="w-full flex flex-col items-start">
                          <span className="truncate">{result.name}</span>
                          {result.metadata?.distance !== undefined && locationEnabled && (
                            <span className="text-xs text-brand-orange">
                              {Math.round(result.metadata.distance * 10) / 10} km away
                            </span>
                          )}
                        </div>
                      </Button>
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
