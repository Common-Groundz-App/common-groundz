
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Entity, EntityType } from '@/services/recommendation/types';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { SelectValue, SelectTrigger, SelectContent, Select, SelectItem } from '@/components/ui/select';

interface SimpleEntitySelectorProps {
  onEntitiesChange: (entities: Entity[]) => void;
  initialEntities?: Entity[];
}

export function SimpleEntitySelector({ onEntitiesChange, initialEntities = [] }: SimpleEntitySelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('place');
  
  const { localResults, externalResults, isLoading, handleSearch } = useEntitySearch(entityType);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length >= 2) {
      handleSearch(query);
    }
  };
  
  // Handle entity selection
  const handleEntitySelect = (entity: Entity) => {
    if (!selectedEntities.some(e => e.id === entity.id)) {
      const newEntities = [...selectedEntities, entity];
      setSelectedEntities(newEntities);
      onEntitiesChange(newEntities);
      setSearchQuery('');
    }
  };

  // Combine local and external results
  const results = [...localResults, ...externalResults];

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
        
        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="border rounded-md max-h-40 overflow-y-auto">
            {isLoading ? (
              <div className="p-2 text-sm text-center">Loading...</div>
            ) : results.length > 0 ? (
              <div className="divide-y">
                {results.map((entity) => (
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
            ) : (
              <div className="p-2 text-sm text-center text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
