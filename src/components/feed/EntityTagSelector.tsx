
import React, { useState } from 'react';
import { EntitySearch } from '@/components/recommendations/EntitySearch';
import { Entity } from '@/services/recommendation/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';

interface EntityTagSelectorProps {
  onEntitiesChange: (entities: Entity[]) => void;
  initialEntities?: Entity[];
}

export function EntityTagSelector({ onEntitiesChange, initialEntities = [] }: EntityTagSelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(initialEntities);
  const [activeTab, setActiveTab] = useState<EntityTypeString>('place');
  
  const handleEntitySelect = (entity: Entity) => {
    // Check if entity is already selected
    if (!selectedEntities.some(e => e.id === entity.id)) {
      const newEntities = [...selectedEntities, entity];
      setSelectedEntities(newEntities);
      onEntitiesChange(newEntities);
    }
  };
  
  const handleEntityRemove = (entityId: string) => {
    const newEntities = selectedEntities.filter(entity => entity.id !== entityId);
    setSelectedEntities(newEntities);
    onEntitiesChange(newEntities);
  };
  
  const entityTypes: EntityTypeString[] = ['place', 'food', 'movie', 'book', 'product'];
  
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Tag entities in your post</p>
        
        <Tabs defaultValue="place" className="w-full" onValueChange={(value) => setActiveTab(value as EntityTypeString)}>
          <TabsList className="grid grid-cols-5">
            {entityTypes.map(type => (
              <TabsTrigger key={type} value={type} className="capitalize">
                {type}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {entityTypes.map(type => (
            <TabsContent key={type} value={type} className="pt-2">
              <EntitySearch 
                type={type} 
                onSelect={handleEntitySelect}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {selectedEntities.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Selected entities:</p>
          <div className="flex flex-wrap gap-2">
            {selectedEntities.map(entity => (
              <Badge 
                key={entity.id} 
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span>{entity.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 rounded-full"
                  onClick={() => handleEntityRemove(entity.id)}
                >
                  <X size={10} />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
