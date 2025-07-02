
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NavBarComponent from '@/components/NavBarComponent';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface Entity {
  id: string;
  name: string;
  type: string;
  slug?: string;
  description?: string;
  image_url?: string;
  website_url?: string;
  venue?: string;
  api_source?: string;
  api_ref?: string;
  metadata?: Record<string, any>;
  is_deleted: boolean;
  category_id?: string;
  popularity_score?: number;
  photo_reference?: string;
  created_at: string;
  updated_at: string;
}

const entityTypes = [
  'movie', 'book', 'food', 'product', 'place', 'activity', 'music', 'art', 'tv', 'drink', 'travel'
];

const AdminEntityEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [metadataText, setMetadataText] = useState('');

  useEffect(() => {
    if (id) {
      fetchEntity();
    }
  }, [id]);

  const fetchEntity = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setEntity(data);
      setMetadataText(data.metadata ? JSON.stringify(data.metadata, null, 2) : '{}');
    } catch (error) {
      console.error('Error fetching entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch entity details',
        variant: 'destructive'
      });
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Entity, value: any) => {
    if (!entity) return;
    
    setEntity({
      ...entity,
      [field]: value
    });
  };

  const handleMetadataChange = (value: string) => {
    setMetadataText(value);
    try {
      const parsed = JSON.parse(value);
      handleInputChange('metadata', parsed);
    } catch (error) {
      // Invalid JSON, don't update entity.metadata yet
    }
  };

  const validateForm = () => {
    if (!entity?.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Entity name is required',
        variant: 'destructive'
      });
      return false;
    }

    if (!entity?.type) {
      toast({
        title: 'Validation Error',
        description: 'Entity type is required',
        variant: 'destructive'
      });
      return false;
    }

    // Validate JSON metadata
    try {
      JSON.parse(metadataText);
    } catch (error) {
      toast({
        title: 'Validation Error',
        description: 'Metadata must be valid JSON',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!entity || !validateForm()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('entities')
        .update({
          name: entity.name.trim(),
          type: entity.type,
          slug: entity.slug?.trim() || null,
          description: entity.description?.trim() || null,
          image_url: entity.image_url?.trim() || null,
          website_url: entity.website_url?.trim() || null,
          venue: entity.venue?.trim() || null,
          api_source: entity.api_source?.trim() || null,
          api_ref: entity.api_ref?.trim() || null,
          metadata: entity.metadata,
          is_deleted: entity.is_deleted,
          category_id: entity.category_id || null,
          popularity_score: entity.popularity_score || null,
          photo_reference: entity.photo_reference?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Entity updated successfully',
      });

      setShowSaveConfirm(false);
    } catch (error) {
      console.error('Error updating entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to update entity',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!entity) return;

    setSaving(true);
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
        description: 'Entity soft deleted successfully',
      });

      setShowDeleteConfirm(false);
      navigate('/admin');
    } catch (error) {
      console.error('Error soft deleting entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to soft delete entity',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="xl:ml-64">
          <NavBarComponent />
        </div>
        
        <div className="flex">
          <div className="hidden xl:block">
            <AdminSidebar activeTab="entity-management" onTabChange={() => {}} />
          </div>
          
          <div className="flex-1 xl:ml-64 min-w-0">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading entity...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background">
        <div className="xl:ml-64">
          <NavBarComponent />
        </div>
        
        <div className="flex">
          <div className="hidden xl:block">
            <AdminSidebar activeTab="entity-management" onTabChange={() => {}} />
          </div>
          
          <div className="flex-1 xl:ml-64 min-w-0">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Entity not found</p>
                  <Button asChild className="mt-4">
                    <Link to="/admin">Return to Admin</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="xl:ml-64">
        <NavBarComponent />
      </div>
      
      <div className="flex">
        <div className="hidden xl:block">
          <AdminSidebar activeTab="entity-management" onTabChange={() => {}} />
        </div>
        
        <div className="flex-1 xl:ml-64 min-w-0">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-6">
              <Button asChild variant="ghost" className="mb-4">
                <Link to="/admin" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Admin
                </Link>
              </Button>
              
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">Edit Entity</h1>
              </div>
              <p className="text-muted-foreground">
                Update entity information and settings
              </p>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Core entity details and identification
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={entity.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Entity name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="type">Type *</Label>
                      <Select value={entity.type} onValueChange={(value) => handleInputChange('type', value)}>
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
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={entity.slug || ''}
                      onChange={(e) => handleInputChange('slug', e.target.value)}
                      placeholder="URL-friendly identifier"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={entity.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Entity description"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Media & Links */}
              <Card>
                <CardHeader>
                  <CardTitle>Media & Links</CardTitle>
                  <CardDescription>
                    Images and external references
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      value={entity.image_url || ''}
                      onChange={(e) => handleInputChange('image_url', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    {entity.image_url && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                        <div className="w-32 h-32 rounded-md overflow-hidden bg-muted">
                          <ImageWithFallback
                            src={entity.image_url}
                            alt={entity.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website_url">Website URL</Label>
                      <Input
                        id="website_url"
                        value={entity.website_url || ''}
                        onChange={(e) => handleInputChange('website_url', e.target.value)}
                        placeholder="https://example.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="venue">Venue</Label>
                      <Input
                        id="venue"
                        value={entity.venue || ''}
                        onChange={(e) => handleInputChange('venue', e.target.value)}
                        placeholder="Physical location or venue"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API & Technical */}
              <Card>
                <CardHeader>
                  <CardTitle>API & Technical Data</CardTitle>
                  <CardDescription>
                    External API references and technical information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="api_source">API Source</Label>
                      <Input
                        id="api_source"
                        value={entity.api_source || ''}
                        onChange={(e) => handleInputChange('api_source', e.target.value)}
                        placeholder="google_places, omdb, etc."
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="api_ref">API Reference</Label>
                      <Input
                        id="api_ref"
                        value={entity.api_ref || ''}
                        onChange={(e) => handleInputChange('api_ref', e.target.value)}
                        placeholder="External API ID or reference"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photo_reference">Photo Reference</Label>
                    <Input
                      id="photo_reference"
                      value={entity.photo_reference || ''}
                      onChange={(e) => handleInputChange('photo_reference', e.target.value)}
                      placeholder="Google Places photo reference"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metadata">Metadata (JSON)</Label>
                    <Textarea
                      id="metadata"
                      value={metadataText}
                      onChange={(e) => handleMetadataChange(e.target.value)}
                      placeholder='{"key": "value"}'
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be valid JSON format
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>
                    Entity status and configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_deleted">Soft Delete</Label>
                      <p className="text-sm text-muted-foreground">
                        Mark this entity as deleted (hidden from public view)
                      </p>
                    </div>
                    <Switch
                      id="is_deleted"
                      checked={entity.is_deleted}
                      onCheckedChange={(checked) => handleInputChange('is_deleted', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button asChild variant="outline">
                  <Link to="/admin">Cancel</Link>
                </Button>
                
                <div className="flex gap-2">
                  <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" disabled={saving}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Soft Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Confirm Soft Delete
                        </DialogTitle>
                        <DialogDescription>
                          This will mark the entity "{entity.name}" as deleted. It will be hidden from public view but can be restored later.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleSoftDelete} disabled={saving}>
                          {saving ? 'Deleting...' : 'Soft Delete'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
                    <DialogTrigger asChild>
                      <Button disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Changes</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to save the changes to "{entity.name}"?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEntityEdit;
