import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ContactInfoEditor } from './ContactInfoEditor';
import { BusinessHoursEditor } from './BusinessHoursEditor';
import { ParentEntitySelector } from './ParentEntitySelector';
import { Entity } from '@/services/recommendation/types';
import { setEntityParent } from '@/services/entityHierarchyService';
import { SimpleMediaUploadModal } from '@/components/entity-v4/SimpleMediaUploadModal';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { MediaItem } from '@/types/media';
import { uploadEntityMediaBatch } from '@/services/entityMediaService';
import { Plus } from 'lucide-react';

const entityTypes = [
  'movie', 'book', 'food', 'product', 'place', 'activity', 'music', 'art', 'tv', 'drink', 'travel'
];

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated: () => void;
}

export const CreateEntityDialog: React.FC<CreateEntityDialogProps> = ({
  open,
  onOpenChange,
  onEntityCreated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    image_url: '',
    website_url: '',
    venue: '',
  });
  
  const [businessHours, setBusinessHours] = useState({});
  const [contactInfo, setContactInfo] = useState({});
  const [selectedParent, setSelectedParent] = useState<Entity | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      image_url: '',
      website_url: '',
      venue: '',
    });
    setBusinessHours({});
    setContactInfo({});
    setSelectedParent(null);
    setUploadedMedia([]);
    setShowMediaUploadModal(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const metadata = {
        business_hours: businessHours,
        contact: contactInfo
      };

      // Generate slug based on parent context
      const baseSlug = formData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const hierarchicalSlug = selectedParent 
        ? `${selectedParent.slug || selectedParent.id}-${baseSlug}`
        : baseSlug;

      const { data: newEntity, error } = await supabase
        .from('entities')
        .insert({
          name: formData.name.trim(),
          type: formData.type as any,
          description: formData.description.trim() || null,
          image_url: formData.image_url.trim() || null,
          website_url: formData.website_url.trim() || null,
          venue: formData.venue.trim() || null,
          metadata,
          created_by: user?.id || null,
          slug: hierarchicalSlug,
          parent_id: selectedParent?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Upload media if any
      if (newEntity && uploadedMedia.length > 0) {
        if (!user?.id) {
          console.error('No authenticated user for media upload');
        } else {
          try {
            const uploadedPhotos = await uploadEntityMediaBatch(
              uploadedMedia,
              newEntity.id,
              user.id,
              (progress, total) => {
                console.log(`Uploading media: ${progress}/${total}`);
              }
            );

            // Set first media item as primary image
            if (uploadedPhotos.length > 0 && uploadedMedia[0]) {
              await supabase
                .from('entities')
                .update({ image_url: uploadedMedia[0].url })
                .eq('id', newEntity.id);
            }
          } catch (mediaError) {
            console.error('Error uploading media:', mediaError);
            toast({
              title: 'Warning',
              description: 'Entity created, but some media failed to upload.',
              variant: 'default'
            });
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Entity created successfully',
      });

      resetForm();
      onOpenChange(false);
      onEntityCreated();
    } catch (error) {
      console.error('Error creating entity:', error);
      toast({
        title: 'Error',
        description: `Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Entity</DialogTitle>
          <DialogDescription>
            Add a new entity with business hours and contact information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="hours">Business Hours</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Entity name"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => handleInputChange('type', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Entity description"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Entity Media</Label>
              
              {uploadedMedia.length > 0 && (
                <CompactMediaGrid
                  media={uploadedMedia}
                  onRemove={(mediaToRemove) => {
                    setUploadedMedia(prev => prev.filter(m => m.url !== mediaToRemove.url));
                  }}
                  maxVisible={4}
                  className="mb-4"
                />
              )}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMediaUploadModal(true)}
                disabled={loading || uploadedMedia.length >= 4}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {uploadedMedia.length === 0 ? 'Add Photos & Videos' : `Add More Media (${uploadedMedia.length}/4)`}
              </Button>
              
              {uploadedMedia.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add up to 4 photos or videos for this entity
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                value={formData.website_url}
                onChange={(e) => handleInputChange('website_url', e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => handleInputChange('venue', e.target.value)}
                placeholder="Venue or location"
                disabled={loading}
              />
            </div>

            <ParentEntitySelector
              selectedParent={selectedParent}
              onParentChange={setSelectedParent}
              className="pt-4 border-t"
            />
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <ContactInfoEditor
              value={contactInfo}
              onChange={setContactInfo}
              disabled={loading}
            />
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <BusinessHoursEditor
              value={businessHours}
              onChange={setBusinessHours}
              disabled={loading}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Entity'}
          </Button>
        </div>
      </DialogContent>
      
      <SimpleMediaUploadModal
        isOpen={showMediaUploadModal}
        onClose={() => setShowMediaUploadModal(false)}
        onSave={(mediaItems) => {
          setUploadedMedia(prev => [...prev, ...mediaItems]);
          setShowMediaUploadModal(false);
        }}
      />
    </Dialog>
  );
};