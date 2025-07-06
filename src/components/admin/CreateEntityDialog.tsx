
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { usePersistedForm } from '@/hooks/usePersistedForm';
import { EntityImageUploader } from './EntityImageUploader';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated: () => void;
}

const entityTypes = [
  { value: 'book', label: 'Book' },
  { value: 'movie', label: 'Movie' },
  { value: 'place', label: 'Place' },
  { value: 'product', label: 'Product' },
  { value: 'food', label: 'Food' }
];

const initialFormData = {
  name: '',
  type: '',
  description: '',
  venue: '',
  image_url: '',
  parent_id: ''
};

interface ParentEntity {
  id: string;
  name: string;
  type: string;
}

export const CreateEntityDialog = ({ open, onOpenChange, onEntityCreated }: CreateEntityDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [parentEntities, setParentEntities] = useState<ParentEntity[]>([]);
  const [parentSearchOpen, setParentSearchOpen] = useState(false);
  const [parentSearchValue, setParentSearchValue] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentEntity | null>(null);
  const { toast } = useToast();
  
  // Use persisted form hook
  const {
    formData,
    updateField,
    resetForm,
    clearPersistedData
  } = usePersistedForm('admin-create-entity-form', initialFormData);

  // Search for potential parent entities
  const searchParentEntities = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setParentEntities([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, type')
        .ilike('name', `%${searchTerm}%`)
        .eq('is_deleted', false)
        .limit(10);

      if (error) throw error;
      setParentEntities(data || []);
    } catch (error) {
      console.error('Error searching parent entities:', error);
    }
  };

  const handleParentSelect = (parent: ParentEntity) => {
    setSelectedParent(parent);
    updateField('parent_id', parent.id);
    setParentSearchOpen(false);
    setParentSearchValue('');
  };

  const clearParentSelection = () => {
    setSelectedParent(null);
    updateField('parent_id', '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const currentUser = await supabase.auth.getUser();
      
      if (!currentUser.data.user) {
        throw new Error('User not authenticated');
      }

      // Create the entity object with proper typing
      const entityData: Database['public']['Tables']['entities']['Insert'] = {
        name: formData.name,
        type: formData.type as Database['public']['Enums']['entity_type'],
        description: formData.description || null,
        venue: formData.venue || null,
        image_url: formData.image_url || null,
        parent_id: formData.parent_id || null,
        created_by: currentUser.data.user.id
      };

      const { data, error } = await supabase
        .from('entities')
        .insert(entityData)
        .select()
        .single();

      if (error) throw error;

      const entityType = selectedParent ? 'product' : 'brand';
      const relationshipText = selectedParent ? ` as a product under ${selectedParent.name}` : '';

      toast({
        title: 'Success',
        description: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} "${formData.name}" created successfully${relationshipText}`
      });

      // Clear form and persisted data on successful creation
      resetForm();
      clearPersistedData();
      setSelectedParent(null);

      onEntityCreated();
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to create entity. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Clear form and persisted data on explicit cancel
    resetForm();
    clearPersistedData();
    setSelectedParent(null);
    onOpenChange(false);
  };

  const handleInputChange = (field: keyof typeof initialFormData, value: string) => {
    updateField(field, value);
  };

  React.useEffect(() => {
    if (parentSearchValue) {
      const debounceTimer = setTimeout(() => {
        searchParentEntities(parentSearchValue);
      }, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [parentSearchValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Entity</DialogTitle>
          <DialogDescription>
            Add a new entity to the system. You can create standalone entities or products under parent brands.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parent Entity Selection */}
          <div className="space-y-2">
            <Label>Parent Entity (Optional)</Label>
            <div className="space-y-2">
              {selectedParent ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-2">
                    {selectedParent.name} ({selectedParent.type})
                    <button
                      type="button"
                      onClick={clearParentSelection}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                </div>
              ) : (
                <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={parentSearchOpen}
                      className="justify-between"
                      type="button"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Search for parent entity...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search entities..."
                        value={parentSearchValue}
                        onValueChange={setParentSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {parentSearchValue.length < 2 
                            ? "Type at least 2 characters to search"
                            : "No entities found"
                          }
                        </CommandEmpty>
                        <CommandGroup>
                          {parentEntities.map((entity) => (
                            <CommandItem
                              key={entity.id}
                              onSelect={() => handleParentSelect(entity)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{entity.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedParent 
                  ? "This entity will be created as a product under the selected parent"
                  : "Leave empty to create a standalone entity or brand"
                }
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter entity name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {entityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter description (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue">Venue</Label>
            <Input
              id="venue"
              value={formData.venue}
              onChange={(e) => handleInputChange('venue', e.target.value)}
              placeholder="Enter venue (optional)"
            />
          </div>

          <div className="space-y-2">
            <EntityImageUploader
              value={formData.image_url}
              onChange={(url) => handleInputChange('image_url', url || '')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                `Create ${selectedParent ? 'Product' : 'Entity'}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
