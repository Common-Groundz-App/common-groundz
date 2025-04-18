
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EntitySearch from '@/components/recommendations/EntitySearch';
import UrlEntityCreator from './UrlEntityCreator';
import { Entity } from '@/services/recommendationService';

interface EntityCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entity: Entity) => void;
  entityType: 'movie' | 'book' | 'place' | 'product' | 'food';
}

export default function EntityCreationModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  entityType 
}: EntityCreationModalProps) {
  const [activeTab, setActiveTab] = useState('search');
  
  const handleEntitySelected = (entity: Entity) => {
    onSelect(entity);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find or Create {entityType.charAt(0).toUpperCase() + entityType.slice(1)}</DialogTitle>
          <DialogDescription>
            Search for an existing {entityType} or create a new one from a URL
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="search">Search Existing</TabsTrigger>
            <TabsTrigger value="url">Create from URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="pt-4">
            <EntitySearch 
              type={entityType} 
              onSelect={handleEntitySelected}
            />
          </TabsContent>
          
          <TabsContent value="url" className="pt-4">
            <UrlEntityCreator 
              onEntityCreated={handleEntitySelected}
            />
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
