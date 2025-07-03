
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  RefreshCw, 
  Search, 
  Filter, 
  Download, 
  Edit, 
  Eye, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Upload,
  MoreHorizontal,
  RotateCcw,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Link } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';

// Use the exact type from Supabase
type DatabaseEntity = Database['public']['Tables']['entities']['Row'];

interface EntityStats {
  totalEntities: number;
  deletedEntities: number;
  localStorageImages: number;
  proxyImages: number;
  externalImages: number;
  recentRefreshes: number;
}

const getImageStatus = (imageUrl?: string | null) => {
  if (!imageUrl) return { status: 'none', color: 'bg-gray-500', label: 'No Image' };
  
  // Check for actual local storage URLs (not proxy URLs)
  if (imageUrl.includes('entity-images') && 
      (imageUrl.includes('storage.googleapis.com') || imageUrl.includes('supabase.co/storage')) &&
      !imageUrl.includes('/functions/v1/proxy-')) {
    return { status: 'local', color: 'bg-green-500', label: 'Local Storage' };
  }
  
  // Check for proxy URLs
  if (imageUrl.includes('/functions/v1/proxy-') || imageUrl.includes('supabase.co/functions/v1/proxy-')) {
    return { status: 'proxy', color: 'bg-yellow-500', label: 'Proxy URL (Needs Migration)' };
  }
  
  return { status: 'external', color: 'bg-red-500', label: 'External URL' };
};

export const AdminEntityManagementPanel = () => {
  const [entities, setEntities] = useState<DatabaseEntity[]>([]);
  const [stats, setStats] = useState<EntityStats>({
    totalEntities: 0,
    deletedEntities: 0,
    localStorageImages: 0,
    proxyImages: 0,
    externalImages: 0,
    recentRefreshes: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [refreshingEntities, setRefreshingEntities] = useState<Set<string>>(new Set());
  const [bulkRefreshProgress, setBulkRefreshProgress] = useState(0);
  const [showBulkProgress, setShowBulkProgress] = useState(false);
  const [editingEntity, setEditingEntity] = useState<DatabaseEntity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  const { toast } = useToast();
  const { refreshEntityImage, isRefreshing } = useEntityImageRefresh();

  useEffect(() => {
    fetchEntities();
  }, [showDeleted]);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', showDeleted)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntities(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch entities',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async (entitiesList: DatabaseEntity[]) => {
    const activeEntities = entitiesList.filter(e => !e.is_deleted);
    const deletedEntities = entitiesList.filter(e => e.is_deleted);
    
    const stats = activeEntities.reduce((acc, entity) => {
      acc.totalEntities++;
      
      const imageStatus = getImageStatus(entity.image_url);
      switch (imageStatus.status) {
        case 'local':
          acc.localStorageImages++;
          break;
        case 'proxy':
          acc.proxyImages++;
          break;
        case 'external':
          acc.externalImages++;
          break;
      }
      
      return acc;
    }, {
      totalEntities: 0,
      deletedEntities: deletedEntities.length,
      localStorageImages: 0,
      proxyImages: 0,
      externalImages: 0,
      recentRefreshes: 0 // TODO: Calculate from recent activity
    });

    setStats(stats);
  };

  const handleRestoreEntity = async (entity: DatabaseEntity) => {
    try {
      const { error } = await supabase
        .from('entities')
        .update({
          is_deleted: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Entity "${entity.name}" restored successfully`,
      });

      // Remove from local state
      setEntities(prev => prev.filter(e => e.id !== entity.id));
    } catch (error) {
      console.error('Error restoring entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore entity. Please check your permissions.',
        variant: 'destructive'
      });
    }
  };

  const handleRefreshImage = async (entity: DatabaseEntity) => {
    setRefreshingEntities(prev => new Set(prev).add(entity.id));
    
    try {
      const placeId = entity.metadata && typeof entity.metadata === 'object' ? (entity.metadata as any)?.place_id : null;
      const photoReference = entity.metadata && typeof entity.metadata === 'object' ? (entity.metadata as any)?.photo_reference : null;
      
      const newImageUrl = await refreshEntityImage(entity.id, placeId, photoReference);
      
      if (newImageUrl && newImageUrl !== entity.image_url) {
        // Update the entity in our local state
        setEntities(prev => prev.map(e => 
          e.id === entity.id ? { ...e, image_url: newImageUrl } : e
        ));
        
        toast({
          title: 'Success',
          description: `Image refreshed for ${entity.name}`,
        });
        
        // Recalculate stats
        const updatedEntities = entities.map(e => 
          e.id === entity.id ? { ...e, image_url: newImageUrl } : e
        );
        calculateStats(updatedEntities);
      }
      // If newImageUrl is null, the error was already shown by the hook
    } catch (error) {
      console.error('Error refreshing image:', error);
      // Error toast is already shown by the hook
    } finally {
      setRefreshingEntities(prev => {
        const newSet = new Set(prev);
        newSet.delete(entity.id);
        return newSet;
      });
    }
  };

  const handleBulkRefresh = async () => {
    if (selectedEntities.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select entities to refresh',
        variant: 'destructive'
      });
      return;
    }

    setShowBulkProgress(true);
    setBulkRefreshProgress(0);
    
    const selectedEntityList = entities.filter(e => selectedEntities.has(e.id));
    let completed = 0;
    
    for (const entity of selectedEntityList) {
      await handleRefreshImage(entity);
      completed++;
      setBulkRefreshProgress((completed / selectedEntityList.length) * 100);
    }
    
    setShowBulkProgress(false);
    setSelectedEntities(new Set());
    
    toast({
      title: 'Bulk Refresh Complete',
      description: `Refreshed ${completed} entities`,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEntities(new Set(filteredEntities.map(e => e.id)));
    } else {
      setSelectedEntities(new Set());
    }
  };

  const handleSelectEntity = (entityId: string, checked: boolean) => {
    const newSelected = new Set(selectedEntities);
    if (checked) {
      newSelected.add(entityId);
    } else {
      newSelected.delete(entityId);
    }
    setSelectedEntities(newSelected);
  };

  // Filter entities based on search and filters
  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entity.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || entity.type === typeFilter;
    
    const imageStatus = getImageStatus(entity.image_url);
    const matchesStatus = statusFilter === 'all' || imageStatus.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEntities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntities = filteredEntities.slice(startIndex, startIndex + itemsPerPage);

  // Get unique entity types for filter
  const entityTypes = Array.from(new Set(entities.map(e => e.type)));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Entity Management Dashboard
          </CardTitle>
          <CardDescription>
            Manage all entities and their image storage status
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.totalEntities}</div>
            <div className="text-sm text-muted-foreground">Active Entities</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.deletedEntities}</div>
            <div className="text-sm text-muted-foreground">Deleted Entities</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.localStorageImages}</div>
            <div className="text-sm text-muted-foreground">Local Storage</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.proxyImages}</div>
            <div className="text-sm text-muted-foreground">Proxy URLs</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.externalImages}</div>
            <div className="text-sm text-muted-foreground">External URLs</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.recentRefreshes}</div>
            <div className="text-sm text-muted-foreground">Recent Refreshes</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-deleted"
                  checked={showDeleted}
                  onCheckedChange={setShowDeleted}
                />
                <Label htmlFor="show-deleted" className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Show Deleted Entities
                </Label>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {entityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Image Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="local">Local Storage</SelectItem>
                  <SelectItem value="proxy">Proxy URLs</SelectItem>
                  <SelectItem value="external">External URLs</SelectItem>
                  <SelectItem value="none">No Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              {!showDeleted && (
                <Button
                  onClick={handleBulkRefresh}
                  disabled={selectedEntities.size === 0 || isRefreshing}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Selected ({selectedEntities.size})
                </Button>
              )}
              
              <Button onClick={fetchEntities} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Progress */}
      {showBulkProgress && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bulk Refresh Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(bulkRefreshProgress)}%</span>
              </div>
              <Progress value={bulkRefreshProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!showDeleted && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedEntities.size === filteredEntities.length && filteredEntities.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntities.map((entity) => {
                const imageStatus = getImageStatus(entity.image_url);
                const isRefreshing = refreshingEntities.has(entity.id);
                
                return (
                  <TableRow key={entity.id} className={entity.is_deleted ? 'opacity-60' : ''}>
                    {!showDeleted && (
                      <TableCell>
                        <Checkbox
                          checked={selectedEntities.has(entity.id)}
                          onCheckedChange={(checked) => handleSelectEntity(entity.id, checked as boolean)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted">
                        {entity.image_url ? (
                          <ImageWithFallback
                            src={entity.image_url}
                            alt={entity.name}
                            className="w-full h-full object-cover"
                            suppressConsoleErrors
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No Image</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {entity.name}
                          {entity.is_deleted && (
                            <Badge variant="destructive" className="text-xs">
                              Deleted
                            </Badge>
                          )}
                        </div>
                        {entity.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-48">
                            {entity.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`${imageStatus.color} text-white`}
                        title={imageStatus.status === 'proxy' ? 'This is a proxy URL that needs to be migrated to local storage' : ''}
                      >
                        {imageStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(entity.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {showDeleted ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleRestoreEntity(entity)}
                            title="Restore this entity"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefreshImage(entity)}
                            disabled={isRefreshing}
                            title={
                              imageStatus.status === 'local' 
                                ? 'Image already in local storage' 
                                : imageStatus.status === 'proxy'
                                ? 'Migrate proxy URL to local storage'
                                : 'Download external image to local storage'
                            }
                          >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/admin/entities/${entity.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{entity.name}</DialogTitle>
                              <DialogDescription>Entity Details</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Type</label>
                                  <div className="text-sm text-muted-foreground">{entity.type}</div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <div className="text-sm text-muted-foreground">
                                    {entity.is_deleted ? 'Soft Deleted' : 'Active'}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Created</label>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(entity.created_at).toLocaleString()}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Updated</label>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(entity.updated_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              
                              {entity.image_url && (
                                <div>
                                  <label className="text-sm font-medium">Image URL</label>
                                  <div className="text-sm text-muted-foreground break-all bg-muted p-2 rounded">
                                    {entity.image_url}
                                  </div>
                                  <div className="mt-1">
                                    <Badge 
                                      variant="outline" 
                                      className={`${imageStatus.color} text-white`}
                                    >
                                      {imageStatus.label}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                              
                              {entity.description && (
                                <div>
                                  <label className="text-sm font-medium">Description</label>
                                  <div className="text-sm text-muted-foreground">{entity.description}</div>
                                </div>
                              )}
                              
                              {entity.metadata && (
                                <div>
                                  <label className="text-sm font-medium">Metadata</label>
                                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(entity.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {entity.image_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={entity.image_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredEntities.length)} of {filteredEntities.length} entities
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
