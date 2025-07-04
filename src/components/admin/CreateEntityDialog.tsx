
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { usePersistedForm } from '@/hooks/usePersistedForm';
import { EntityImageUploader } from './EntityImageUploader';

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
  image_url: ''
};

export const CreateEntityDialog = ({ open, onOpenChange, onEntityCreated }: CreateEntityDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Use persisted form hook
  const {
    formData,
    updateField,
    resetForm,
    clearPersistedData
  } = usePersistedForm('admin-create-entity-form', initialFormData);

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
        created_by: currentUser.data.user.id
      };

      const { data, error } = await supabase
        .from('entities')
        .insert(entityData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Entity "${formData.name}" created successfully`
      });

      // Clear form and persisted data on successful creation
      resetForm();
      clearPersistedData();

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
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string) => {
    updateField(field, value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Entity</DialogTitle>
          <DialogDescription>
            Add a new entity to the system. Fill out the basic information below.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
                'Create Entity'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
