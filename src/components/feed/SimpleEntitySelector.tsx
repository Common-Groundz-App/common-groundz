
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Entity, EntityType } from '@/services/recommendation/types';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { SelectValue, SelectTrigger, SelectContent, Select, SelectItem } from '@/components/ui/select';
import { MapPin, Book, Film, ShoppingBag, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleEntitySelectorProps {
  onEntitiesChange: (entities: Entity[]) => void;
  initialEntities?: Entity[];
  className?: string;
}

export function SimpleEntitySelector({ onEntitiesChange, initialEntities = [], className }: SimpleEntitySelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('place');
  
  const { localResults, externalResults, isLoading, handleSearch, createEntityFromExternal } = useEntitySearch(entityType);

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

  // Handle external result selection
  const handleExternalResultSelect = async (result: any) => {
    // Create an entity from the external result
    const entity = await createEntityFromExternal(result);
    if (entity) {
      handleEntitySelect(entity);
    }
  };

  // Get icon for entity type
  const getEntityTypeIcon = (type: EntityType) => {
    switch(type) {
      case 'place': return <MapPin size={14} />;
      case 'book': return <Book size={14} />;
      case 'movie': return <Film size={14} />;
      case 'product': return <ShoppingBag size={14} />;
      case 'food': return <Coffee size={14} />;
      default: return null;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
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
              <SelectItem value="place" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <MapPin size={14} />
                  <span>Place</span>
                </div>
              </SelectItem>
              <SelectItem value="food" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Coffee size={14} />
                  <span>Food</span>
                </div>
              </SelectItem>
              <SelectItem value="movie" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Film size={14} />
                  <span>Movie</span>
                </div>
              </SelectItem>
              <SelectItem value="book" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Book size={14} />
                  <span>Book</span>
                </div>
              </SelectItem>
              <SelectItem value="product" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} />
                  <span>Product</span>
                </div>
              </SelectItem>
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
                        <div className="flex items-center gap-2">
                          {getEntityTypeIcon((entity as any).type || entityType)}
                          <span className="truncate">{entity.name}</span>
                        </div>
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
                        <div className="flex items-center gap-2">
                          {getEntityTypeIcon(entityType)}
                          <span className="truncate">{result.name}</span>
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
