import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Loader2, Search } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { EntityAdapter } from '@/components/profile/circles/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ParentEntitySelectorProps {
  selectedParentId: string | null;
  onParentChange: (parentEntity: EntityAdapter | null) => void;
  currentEntityId?: string;
  currentEntityType?: string;
  disabled?: boolean;
}

export function ParentEntitySelector({ 
  selectedParentId, 
  onParentChange, 
  currentEntityId,
  currentEntityType,
  disabled = false 
}: ParentEntitySelectorProps) {
  const [selectedParent, setSelectedParent] = useState<EntityAdapter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntityAdapter[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load selected parent entity on mount
  useEffect(() => {
    if (selectedParentId && !selectedParent) {
      fetchParentEntity(selectedParentId);
    }
  }, [selectedParentId]);

  // Fetch the current parent entity details
  const fetchParentEntity = async (parentId: string) => {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', parentId)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedParent(data as EntityAdapter);
      }
    } catch (error) {
      console.error('Error fetching parent entity:', error);
    }
  };

  // Search entities in database
  const searchEntities = async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;
      
      // Filter out the current entity to prevent self-selection
      const filteredResults = (data || []).filter(entity => 
        currentEntityId ? entity.id !== currentEntityId : true
      );
      
      setSearchResults(filteredResults as EntityAdapter[]);
    } catch (error) {
      console.error('Error searching entities:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length >= 1) {
      setShowResults(true);
      searchEntities(query);
    } else {
      setShowResults(false);
      setSearchResults([]);
    }
  };
  
  // Clear search input and hide results
  const clearSearch = () => {
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle entity selection
  const handleEntitySelect = (entity: EntityAdapter) => {
    // Prevent selecting the current entity as its own parent
    if (currentEntityId && entity.id === currentEntityId) {
      toast({
        title: 'Invalid Selection',
        description: 'An entity cannot be its own parent',
        variant: 'destructive'
      });
      return;
    }

    setSelectedParent(entity);
    onParentChange(entity);
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
  };

  // Remove selected parent
  const removeParent = () => {
    setSelectedParent(null);
    onParentChange(null);
  };

  // Get image URL for entity
  const getImageUrl = (item: EntityAdapter) => {
    if (item.image_url) {
      return item.image_url;
    }
    
    // Type-specific placeholder images
    switch (item.type) {
      case 'movie':
        return "https://images.unsplash.com/photo-1489599510961-b3f9db2a06be?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'book':
        return "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'product':
        return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'food':
        return "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      case 'place':
        return "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
      default:
        return "https://images.unsplash.com/photo-1495195134817-aeb325a55b65?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&q=80";
    }
  };

  return (
    <div className="space-y-2">
      <Label>Parent Entity</Label>
      <p className="text-sm text-muted-foreground">
        Select a parent entity to create a hierarchical relationship
      </p>
      
      {/* Selected Parent Display */}
      {selectedParent && (
        <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
          <div className="flex items-center space-x-3">
            <ImageWithFallback
              src={getImageUrl(selectedParent)}
              alt={selectedParent.name}
              className="w-8 h-8 object-cover rounded"
              fallbackSrc={getImageUrl(selectedParent)}
              entityType={selectedParent.type}
            />
            <div>
              <p className="font-medium">{selectedParent.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{selectedParent.type}</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={removeParent}
            disabled={disabled}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Search Interface */}
      {!selectedParent && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              placeholder="Search for a parent entity..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pr-8"
              ref={inputRef}
              disabled={disabled}
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
                  disabled={disabled}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {/* Search Results */}
          {searchQuery.length >= 1 && showResults && (
            <div 
              ref={resultsRef}
              className="border rounded-md max-h-40 overflow-y-auto w-full bg-background"
            >
              {isLoading ? (
                <div className="p-2 text-sm text-center">Loading...</div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y">
                  {searchResults.map((entity) => (
                    <div
                      key={entity.id}
                      className="flex items-center hover:bg-accent/30 cursor-pointer p-2"
                      onClick={() => handleEntitySelect(entity)}
                    >
                      <div className="flex-shrink-0 mr-2">
                        <ImageWithFallback
                          src={getImageUrl(entity)}
                          alt={entity.name}
                          className="w-8 h-8 object-cover rounded"
                          fallbackSrc={getImageUrl(entity)}
                          entityType={entity.type}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" title={entity.name}>
                          {entity.name}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {entity.type}
                        </div>
                      </div>
                    </div>
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
      )}
    </div>
  );
}