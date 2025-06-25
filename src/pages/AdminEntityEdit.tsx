
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import NavBarComponent from '@/components/NavBarComponent';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { Entity, EntityType } from '@/services/recommendation/types';
import { convertToEntity, stringToEntityType, entityTypeToString } from '@/utils/entityTypeUtils';

interface EntityFormData {
  name: string;
  description: string;
  type: EntityType;
  slug: string;
  api_source: string;
  api_ref: string;
  website_url: string;
  venue: string;
  metadata: string; // JSON string for form handling
  popularity_score: number;
}

const AdminEntityEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshEntityImage, isRefreshing } = useEntityImageRefresh();
  
  const [entity, setEntity] = useState<Entity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<EntityFormData>();

  const watchedName = watch('name');

  // Load entity data
  useEffect(() => {
    if (!id) return;
    
    const loadEntity = async () => {
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        const convertedEntity = convertToEntity(data);
        setEntity(convertedEntity);
        
        // Populate form with entity data
        setValue('name', convertedEntity.name || '');
        setValue('description', convertedEntity.description || '');
        setValue('type', convertedEntity.type || EntityType.Product);
        setValue('slug', convertedEntity.slug || '');
        setValue('api_source', convertedEntity.api_source || '');
        setValue('api_ref', convertedEntity.api_ref || '');
        setValue('website_url', convertedEntity.website_url || '');
        setValue('venue', convertedEntity.venue || '');
        setValue('metadata', JSON.stringify(convertedEntity.metadata || {}, null, 2));
        setValue('popularity_score', convertedEntity.popularity_score || 0);
        
      } catch (error) {
        console.error('Error loading entity:', error);
        toast({
          title: 'Error',
          description: 'Failed to load entity data',
          variant: 'destructive'
        });
        navigate('/admin/entities');
      } finally {
        setIsLoading(false);
      }
    };

    loadEntity();
  }, [id, setValue, toast, navigate]);

  // Auto-generate slug from name
  useEffect(() => {
    if (watchedName && isDirty) {
      const slug = watchedName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', slug);
    }
  }, [watchedName, isDirty, setValue]);

  const handleSave = async (data: EntityFormData) => {
    if (!entity) return;
    
    setIsSaving(true);
    try {
      // Parse metadata JSON
      let metadata;
      try {
        metadata = JSON.parse(data.metadata || '{}');
      } catch {
        throw new Error('Invalid JSON in metadata field');
      }

      const updateData = {
        name: data.name,
        description: data.description,
        type: entityTypeToString(data.type), // Convert EntityType to string
        slug: data.slug,
        api_source: data.api_source || null,
        api_ref: data.api_ref || null,
        website_url: data.website_url || null,
        venue: data.venue || null,
        metadata,
        popularity_score: data.popularity_score,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('entities')
        .update(updateData)
        .eq('id', entity.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Entity updated successfully'
      });

      // Reload entity data
      const { data: updatedEntity } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entity.id)
        .single();

      if (updatedEntity) {
        setEntity(convertToEntity(updatedEntity));
      }

    } catch (error: any) {
      console.error('Error updating entity:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update entity',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!entity) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('entities')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Entity marked as deleted successfully'
      });

      navigate('/admin/entities');

    } catch (error: any) {
      console.error('Error deleting entity:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete entity',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleImageRefresh = async () => {
    if (!entity) return;
    
    try {
      await refreshEntityImage(entity.id);
      
      // Reload entity to get updated image URL
      const { data: updatedEntity } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entity.id)
        .single();

      if (updatedEntity) {
        setEntity(convertToEntity(updatedEntity));
      }
    } catch (error) {
      console.error('Error refreshing image:', error);
    }
  };

  const getImageStatus = () => {
    if (!entity?.image_url) return 'No Image';
    if (entity.image_url.includes('entity-images') && entity.image_url.includes('storage')) return 'Local';
    if (entity.image_url.includes('/functions/v1/proxy-')) return 'Proxy';
    return 'External';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Local': return 'default';
      case 'Proxy': return 'secondary';
      case 'External': return 'outline';
      default: return 'destructive';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBarComponent />
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner size="lg" text="Loading entity..." className="min-h-[400px] flex items-center justify-center" />
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background">
        <NavBarComponent />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Entity Not Found</h1>
            <Button asChild>
              <Link to="/admin/entities">Back to Entities</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/admin/entities" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Entity Management
            </Link>
          </Button>
          
          <div className="text-sm text-muted-foreground mb-2">
            Admin Portal → Entity Management → {entity.name} → Edit
          </div>
        </div>

        <form onSubmit={handleSubmit(() => setShowSaveDialog(true))} className="space-y-6">
          {/* Header Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-3">
                    Edit Entity
                    <Badge variant="outline">{entity.type}</Badge>
                    {entity.is_deleted && <Badge variant="destructive">Deleted</Badge>}
                  </CardTitle>
                  <CardDescription>
                    ID: {entity.id} • Created: {new Date(entity.created_at || '').toLocaleDateString()}
                    {entity.updated_at && ` • Updated: ${new Date(entity.updated_at).toLocaleDateString()}`}
                  </CardDescription>
                </div>
                
                {!entity.is_deleted && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/entity/${entity.slug || entity.id}`} target="_blank">
                      <Eye className="h-4 w-4 mr-2" />
                      View Public Page
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Entity Name</label>
                  <Input
                    {...register('name', { required: 'Name is required' })}
                    placeholder="Enter entity name"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">Entity Type</label>
                  <Select
                    value={watch('type')}
                    onValueChange={(value) => setValue('type', value as EntityType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EntityType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  {...register('slug', { required: 'Slug is required' })}
                  placeholder="entity-slug"
                />
                {errors.slug && (
                  <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Image Management
                <Badge variant={getStatusBadgeVariant(getImageStatus())}>
                  {getImageStatus()}
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {entity.image_url && (
                <div className="flex gap-4">
                  <img
                    src={entity.image_url}
                    alt={entity.name}
                    className="w-32 h-32 object-cover rounded-lg border"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-sm font-medium">Image URL</label>
                      <Input
                        value={entity.image_url}
                        readOnly
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleImageRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh Image
                    </Button>
                  </div>
                </div>
              )}
              
              {!entity.image_url && (
                <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <p className="text-muted-foreground">No image available</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleImageRefresh}
                    disabled={isRefreshing}
                    className="mt-2"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Try to Load Image
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Core Fields Section */}
          <Card>
            <CardHeader>
              <CardTitle>Core Fields</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  {...register('description')}
                  placeholder="Enter entity description"
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">API Source</label>
                  <Input
                    {...register('api_source')}
                    placeholder="e.g., google_places, tmdb, omdb"
                    readOnly
                    className="bg-muted"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">API Reference</label>
                  <Input
                    {...register('api_ref')}
                    placeholder="External API reference ID"
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Website URL</label>
                  <Input
                    {...register('website_url')}
                    placeholder="https://example.com"
                    type="url"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Venue</label>
                  <Input
                    {...register('venue')}
                    placeholder="Physical location or venue"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Popularity Score</label>
                <Input
                  {...register('popularity_score', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Fields Section */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Fields</CardTitle>
              <CardDescription>
                Metadata and type-specific information
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div>
                <label className="text-sm font-medium">Metadata (JSON)</label>
                <Textarea
                  {...register('metadata')}
                  placeholder="{}"
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valid JSON format required
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={entity.is_deleted}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {entity.is_deleted ? 'Already Deleted' : 'Delete Entity'}
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/entities')}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={!isDirty || isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Save Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={handleSubmit(handleSave)}
        title="Save Changes?"
        description={`Are you sure you want to update "${entity.name}"? This will modify the entity data.`}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleSoftDelete}
        title="Delete Entity?"
        description={`Are you sure you want to mark "${entity.name}" as deleted? This will hide it from users but preserve all data including reviews and recommendations.`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AdminEntityEdit;
