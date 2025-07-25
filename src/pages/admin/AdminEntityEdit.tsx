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
import { ArrowLeft, Save, Trash2, Shield, AlertCircle, AlertTriangle, RotateCcw, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NavBarComponent from '@/components/NavBarComponent';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Database } from '@/integrations/supabase/types';
import { useAdminEntityOperations } from '@/hooks/admin/useAdminEntityOperations';

// Use the exact type from Supabase
type DatabaseEntity = Database['public']['Tables']['entities']['Row'];

const entityTypes = [
  'movie', 'book', 'food', 'product', 'place', 'activity', 'music', 'art', 'tv', 'drink', 'travel'
];

const AdminEntityEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { softDeleteEntity, restoreEntity, isProcessing } = useAdminEntityOperations();
  
  const [entity, setEntity] = useState<DatabaseEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [metadataText, setMetadataText] = useState('');
  const [adminActions, setAdminActions] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !session) {
      console.log('AdminEntityEdit: No authenticated user, redirecting to admin');
      navigate('/admin');
      return;
    }

    if (id) {
      fetchEntity();
      fetchAdminActions();
    }
  }, [id, user, session]);

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

  const fetchAdminActions = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('*')
        .eq('target_id', id)
        .eq('target_type', 'entity')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAdminActions(data || []);
    } catch (error) {
      console.error('Error fetching admin actions:', error);
    }
  };

  const checkAdminPermission = async () => {
    if (!user || !session) {
      console.log('checkAdminPermission: No user or session available');
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in as an admin to perform this action.',
        variant: 'destructive'
      });
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('check_admin_permission');
      if (error) {
        console.error('Admin permission check error:', error);
        toast({
          title: 'Permission Check Failed',
          description: `Error checking admin permissions: ${error.message}`,
          variant: 'destructive'
        });
        return false;
      }
      return data;
    } catch (error) {
      console.error('Error checking admin permission:', error);
      toast({
        title: 'Permission Error',
        description: 'Failed to verify admin permissions. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  };

  const handleInputChange = (field: keyof DatabaseEntity, value: any) => {
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

    const hasAdminPermission = await checkAdminPermission();
    if (!hasAdminPermission) {
      return;
    }

    setSaving(true);
    try {
      console.log('handleSave: Attempting to save entity:', entity.id);
      
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
          category_id: entity.category_id || null,
          popularity_score: entity.popularity_score || null,
          photo_reference: entity.photo_reference?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) {
        console.error('handleSave error:', error);
        throw error;
      }

      console.log('handleSave: Successfully saved entity');
      toast({
        title: 'Success',
        description: 'Entity updated successfully',
      });

      setShowSaveConfirm(false);
      fetchAdminActions(); // Refresh audit trail
    } catch (error) {
      console.error('Error updating entity:', error);
      toast({
        title: 'Error',
        description: `Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!entity) return;

    console.log('handleSoftDelete: Using admin edge function for entity:', entity.id);
    
    const result = await softDeleteEntity(entity.id, entity.name);
    
    if (result.success) {
      setShowDeleteConfirm(false);
      setEntity({ ...entity, is_deleted: true });
      fetchAdminActions(); // Refresh audit trail
    }
  };

  const handleRestore = async () => {
    if (!entity) return;

    console.log('handleRestore: Using admin edge function for entity:', entity.id);
    
    const result = await restoreEntity(entity.id, entity.name);
    
    if (result.success) {
      setShowRestoreConfirm(false);
      setEntity({ ...entity, is_deleted: false });
      fetchAdminActions(); // Refresh audit trail
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

  if (!user || !session) {
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Authentication Required
                  </CardTitle>
                  <CardDescription>
                    You must be logged in as an admin to edit entities.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Please ensure you are properly authenticated before accessing admin features.
                  </p>
                  <Button asChild>
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
                <div className="flex-1">
                  <h1 className="text-3xl font-bold">Edit Entity</h1>
                  {entity.is_deleted && (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive font-medium">This entity is soft deleted</span>
                    </div>
                  )}
                </div>
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
                        disabled={entity.is_deleted}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="type">Type *</Label>
                      <Select 
                        value={entity.type} 
                        onValueChange={(value) => handleInputChange('type', value)}
                        disabled={entity.is_deleted}
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
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={entity.slug || ''}
                      onChange={(e) => handleInputChange('slug', e.target.value)}
                      placeholder="URL-friendly identifier"
                      disabled={entity.is_deleted}
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
                      disabled={entity.is_deleted}
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
                      disabled={entity.is_deleted}
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
                        disabled={entity.is_deleted}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="venue">Venue</Label>
                      <Input
                        id="venue"
                        value={entity.venue || ''}
                        onChange={(e) => handleInputChange('venue', e.target.value)}
                        placeholder="Physical location or venue"
                        disabled={entity.is_deleted}
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
                        disabled={entity.is_deleted}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="api_ref">API Reference</Label>
                      <Input
                        id="api_ref"
                        value={entity.api_ref || ''}
                        onChange={(e) => handleInputChange('api_ref', e.target.value)}
                        placeholder="External API ID or reference"
                        disabled={entity.is_deleted}
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
                      disabled={entity.is_deleted}
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
                      disabled={entity.is_deleted}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be valid JSON format
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Entity Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Entity Status</CardTitle>
                  <CardDescription>
                    Current entity status and lifecycle management
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Current Status</Label>
                      <p className="text-sm text-muted-foreground">
                        This entity is currently {entity.is_deleted ? 'soft deleted' : 'active'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entity.is_deleted}
                        disabled={true}
                        className="data-[state=checked]:bg-destructive"
                      />
                      <span className={`text-sm font-medium ${entity.is_deleted ? 'text-destructive' : 'text-green-600'}`}>
                        {entity.is_deleted ? 'Deleted' : 'Active'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audit Trail */}
              {adminActions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Admin Actions History
                    </CardTitle>
                    <CardDescription>
                      Recent administrative actions performed on this entity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {adminActions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{action.action_type.replace('_', ' ').toUpperCase()}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(action.created_at).toLocaleString()}
                            </p>
                            {action.details && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Previous state: {action.details.previous_state}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button asChild variant="outline">
                  <Link to="/admin">Cancel</Link>
                </Button>
                
                <div className="flex gap-2">
                  {entity.is_deleted ? (
                    <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
                      <DialogTrigger asChild>
                        <Button variant="default" disabled={isProcessing[entity.id]}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore Entity
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-green-600" />
                            Confirm Entity Restore
                          </DialogTitle>
                          <DialogDescription>
                            This will restore the entity "{entity.name}" and make it visible again. The entity will be active and accessible to users.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button variant="outline" onClick={() => setShowRestoreConfirm(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleRestore} disabled={isProcessing[entity.id]}>
                            {isProcessing[entity.id] ? 'Restoring...' : 'Restore Entity'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <>
                      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                        <DialogTrigger asChild>
                          <Button variant="destructive" disabled={isProcessing[entity.id]}>
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
                              This will mark the entity "{entity.name}" as deleted. It will be hidden from public view but can be restored later. This action is logged in the audit trail.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleSoftDelete} disabled={isProcessing[entity.id]}>
                              {isProcessing[entity.id] ? 'Deleting...' : 'Soft Delete'}
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
                    </>
                  )}
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
