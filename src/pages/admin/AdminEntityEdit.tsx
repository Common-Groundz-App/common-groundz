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
import { ArrowLeft, Save, Trash2, Shield, AlertCircle, AlertTriangle, RotateCcw, History, RefreshCw, Image, FileText, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NavBarComponent from '@/components/NavBarComponent';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Database } from '@/integrations/supabase/types';
import { useAdminEntityOperations } from '@/hooks/admin/useAdminEntityOperations';
import { BusinessHoursEditor } from '@/components/admin/BusinessHoursEditor';
import { ContactInfoEditor } from '@/components/admin/ContactInfoEditor';
import { EntityTypeSpecificFields } from '@/components/admin/EntityTypeSpecificFields';
import { ParentEntitySelector } from '@/components/admin/ParentEntitySelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { getParentEntity, setEntityParent } from '@/services/entityHierarchyService';
import { Entity } from '@/services/recommendation/types';

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
  const [businessHours, setBusinessHours] = useState<any>({});
  const [contactInfo, setContactInfo] = useState<any>({});
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [refreshingDescription, setRefreshingDescription] = useState(false);
  const [refreshingContact, setRefreshingContact] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Entity | null>(null);

  const { refreshEntityImage, isRefreshing: isRefreshingImage } = useEntityImageRefresh();

  useEffect(() => {
    if (!user || !session) {
      console.log('AdminEntityEdit: No authenticated user, redirecting to admin');
      navigate('/admin');
      return;
    }

    if (id) {
      fetchEntity();
      fetchAdminActions();
      fetchCurrentParent();
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
      
      // Extract business hours and contact info from metadata
      const metadata = (data.metadata as any) || {};
      setBusinessHours(metadata.business_hours || {});
      setContactInfo(metadata.contact || {});
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

  const fetchCurrentParent = async () => {
    if (!id) return;
    
    try {
      const parent = await getParentEntity(id);
      setSelectedParent(parent);
    } catch (error) {
      console.error('Error fetching parent entity:', error);
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
      
      // Merge business hours and contact info into metadata
      const updatedMetadata = {
        ...(entity.metadata as any || {}),
        business_hours: businessHours,
        contact: contactInfo
      };
      
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
          metadata: updatedMetadata,
          category_id: entity.category_id || null,
          popularity_score: entity.popularity_score || null,
          photo_reference: entity.photo_reference?.trim() || null,
          is_claimed: entity.is_claimed || false,
          // Include type-specific fields
          authors: entity.authors,
          isbn: entity.isbn,
          languages: entity.languages,
          publication_year: entity.publication_year,
          cast_crew: entity.cast_crew,
          ingredients: entity.ingredients,
          nutritional_info: entity.nutritional_info,
          specifications: entity.specifications,
          price_info: entity.price_info,
          external_ratings: entity.external_ratings,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) {
        console.error('handleSave error:', error);
        throw error;
      }

      console.log('handleSave: Successfully saved entity');
      
      // Handle parent entity update if it changed
      if (selectedParent || entity.parent_id) {
        const newParentId = selectedParent?.id || null;
        if (newParentId !== entity.parent_id) {
          await setEntityParent(entity.id, newParentId);
          console.log('handleSave: Updated parent entity relationship');
        }
      }
      
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

  const handleFixMetadata = async () => {
    if (!entity || !session) return;

    const hasAdminPermission = await checkAdminPermission();
    if (!hasAdminPermission) {
      return;
    }

    setRefreshingMetadata(true);
    try {
      console.log('handleFixMetadata: Refreshing metadata for entity:', entity.id);

      const { data, error } = await supabase.functions.invoke('refresh-entity-metadata', {
        body: { entityId: entity.id }
      });

      if (error) {
        console.error('Error calling refresh-entity-metadata function:', error);
        throw error;
      }

      if (data?.success) {
        // Update the entity with the refreshed metadata
        setEntity({
          ...entity,
          metadata: data.metadata
        });
        setMetadataText(JSON.stringify(data.metadata, null, 2));

        toast({
          title: 'Success',
          description: data.message || 'Metadata refreshed successfully',
        });

        fetchAdminActions(); // Refresh audit trail
      } else {
        throw new Error(data?.error || 'Failed to refresh metadata');
      }
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      toast({
        title: 'Error',
        description: `Failed to refresh metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setRefreshingMetadata(false);
    }
  };

  const handleFixDescription = async () => {
    if (!entity || !session) return;

    const hasAdminPermission = await checkAdminPermission();
    if (!hasAdminPermission) {
      return;
    }

    setRefreshingDescription(true);
    try {
      console.log('handleFixDescription: Refreshing description and about details for entity:', entity.id);

      const { data, error } = await supabase.functions.invoke('refresh-google-places-entity', {
        body: { 
          entityId: entity.id,
          placeId: (entity.metadata as any)?.place_id
        }
      });

      if (error) {
        console.error('Error calling refresh-google-places-entity function:', error);
        throw error;
      }

      if (data?.success) {
        // Refresh the entity data from database
        await fetchEntity();

        toast({
          title: 'Success',
          description: 'Description and about details refreshed successfully',
        });

        fetchAdminActions(); // Refresh audit trail
      } else {
        throw new Error(data?.error || 'Failed to refresh description');
      }
    } catch (error) {
      console.error('Error refreshing description:', error);
      toast({
        title: 'Error',
        description: `Failed to refresh description: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setRefreshingDescription(false);
    }
  };

  const handleRefreshImages = async () => {
    if (!entity) return;

    const hasAdminPermission = await checkAdminPermission();
    if (!hasAdminPermission) {
      return;
    }

    try {
      console.log('handleRefreshImages: Refreshing images for entity:', entity.id);

      const result = await refreshEntityImage(entity.id);
      
      if (result) {
        // Refresh the entity data from database
        await fetchEntity();

        toast({
          title: 'Success',
          description: 'Images refreshed successfully',
        });

        fetchAdminActions(); // Refresh audit trail
      }
    } catch (error) {
      console.error('Error refreshing images:', error);
      toast({
        title: 'Error',
        description: `Failed to refresh images: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  const handleFixContactInformation = async () => {
    if (!entity || !session) return;

    const hasAdminPermission = await checkAdminPermission();
    if (!hasAdminPermission) {
      return;
    }

    setRefreshingContact(true);
    try {
      console.log('handleFixContactInformation: Refreshing contact information for entity:', entity.id);

      // Use the same refresh function but focus on contact information
      const { data, error } = await supabase.functions.invoke('refresh-google-places-entity', {
        body: { 
          entityId: entity.id,
          placeId: entity.api_ref || (entity.metadata as any)?.place_id
        }
      });

      if (error) {
        console.error('Error calling refresh-google-places-entity function:', error);
        throw error;
      }

      if (data?.success) {
        // Refresh the entity data from database
        await fetchEntity();

        toast({
          title: 'Success',
          description: 'Contact information refreshed successfully',
        });

        fetchAdminActions(); // Refresh audit trail
      } else {
        throw new Error(data?.error || 'Failed to refresh contact information');
      }
    } catch (error) {
      console.error('Error refreshing contact information:', error);
      toast({
        title: 'Error',
        description: `Failed to refresh contact information: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setRefreshingContact(false);
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

            <Tabs defaultValue="basic" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="hours">Hours</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
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
                      {selectedParent && (
                        <p className="text-xs text-muted-foreground">
                          Full URL path: <code>/entity/{selectedParent.slug || selectedParent.id}/{entity.slug || 'new-slug'}</code>
                        </p>
                      )}
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

                     <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                       <div className="space-y-0.5">
                         <Label className="text-base font-medium">Claimed by Brand?</Label>
                         <p className="text-sm text-muted-foreground">
                           Mark if this entity has been verified by the brand owner
                         </p>
                       </div>
                       <div className="flex items-center gap-2">
                         <Switch
                           checked={entity.is_claimed || false}
                           onCheckedChange={(checked) => handleInputChange('is_claimed', checked)}
                           disabled={entity.is_deleted}
                           className="data-[state=checked]:bg-green-600"
                         />
                         <span className={`text-sm font-medium ${entity.is_claimed ? 'text-green-600' : 'text-muted-foreground'}`}>
                           {entity.is_claimed ? 'Claimed' : 'Unclaimed'}
                         </span>
                       </div>
                      </div>

                      {/* Parent Entity Selector */}
                      <div className="pt-4 border-t">
                        <ParentEntitySelector
                          currentEntity={entity ? {
                            ...entity,
                            type: entity.type as any,
                            metadata: (entity.metadata as any) || {},
                            external_ratings: (entity.external_ratings as any) || null,
                            price_info: (entity.price_info as any) || null,
                            specifications: (entity.specifications as any) || null,
                            cast_crew: (entity.cast_crew as any) || null,
                            nutritional_info: (entity.nutritional_info as any) || null
                          } as Entity : undefined}
                          selectedParent={selectedParent}
                          onParentChange={setSelectedParent}
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
              </TabsContent>

              <TabsContent value="contact" className="space-y-6">
                <ContactInfoEditor
                  value={contactInfo}
                  onChange={setContactInfo}
                  disabled={entity.is_deleted}
                />
              </TabsContent>

              <TabsContent value="hours" className="space-y-6">
                <BusinessHoursEditor
                  value={businessHours}
                  onChange={setBusinessHours}
                  disabled={entity.is_deleted}
                />
              </TabsContent>

              <TabsContent value="details" className="space-y-6">
                <EntityTypeSpecificFields
                  entity={entity}
                  onChange={handleInputChange}
                  disabled={entity.is_deleted}
                />
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="metadata">Metadata (JSON)</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleFixMetadata}
                          disabled={entity.is_deleted || refreshingMetadata}
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshingMetadata ? 'animate-spin' : ''}`} />
                          {refreshingMetadata ? 'Refreshing...' : 'Fix Metadata'}
                        </Button>
                      </div>
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
                        Must be valid JSON format. Click "Fix Metadata" to refresh from external APIs.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Refresh Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Refresh Actions</CardTitle>
                    <CardDescription>
                      Refresh entity data from external APIs and sources
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={handleFixMetadata}
                        disabled={entity.is_deleted || refreshingMetadata}
                        className="gap-2 h-auto py-3 flex-col items-start text-left"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <RefreshCw className={`h-4 w-4 ${refreshingMetadata ? 'animate-spin' : ''}`} />
                          <span className="font-medium">Fix Metadata</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {refreshingMetadata ? 'Refreshing metadata from APIs...' : 'Refresh technical metadata and API data'}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleFixDescription}
                        disabled={entity.is_deleted || refreshingDescription}
                        className="gap-2 h-auto py-3 flex-col items-start text-left"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <FileText className={`h-4 w-4 ${refreshingDescription ? 'animate-spin' : ''}`} />
                          <span className="font-medium">Fix Description</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {refreshingDescription ? 'Refreshing description...' : 'Refresh description and about details'}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleRefreshImages}
                        disabled={entity.is_deleted || isRefreshingImage}
                        className="gap-2 h-auto py-3 flex-col items-start text-left"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Image className={`h-4 w-4 ${isRefreshingImage ? 'animate-spin' : ''}`} />
                          <span className="font-medium">Refresh Images</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {isRefreshingImage ? 'Refreshing images...' : 'Update entity images from external sources'}
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleFixContactInformation}
                        disabled={entity.is_deleted || refreshingContact}
                        className="gap-2 h-auto py-3 flex-col items-start text-left"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Phone className={`h-4 w-4 ${refreshingContact ? 'animate-spin' : ''}`} />
                          <span className="font-medium">Fix Contact Info</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {refreshingContact ? 'Refreshing contact info...' : 'Update phone, website, and hours'}
                        </span>
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium mb-1">💡 Pro tip:</p>
                      <p>Use these actions after editing metadata to automatically update entity information from external APIs. Each action targets specific data types for efficient updates.</p>
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
              </TabsContent>

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
            </Tabs>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEntityEdit;
