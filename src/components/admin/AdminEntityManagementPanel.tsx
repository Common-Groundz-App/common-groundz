
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Search, 
  Database, 
  Image, 
  Trash2, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Edit,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { convertToEntities, convertToEntity } from '@/utils/entityTypeUtils';

export const AdminEntityManagementPanel = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const { toast } = useToast();
  const { refreshEntityImage, isRefreshing } = useEntityImageRefresh();

  const searchEntities = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Search Required',
        description: 'Please enter a search term',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setEntities(convertToEntities(data || []));
      
      if (data?.length === 0) {
        toast({
          title: 'No Results',
          description: 'No entities found matching your search',
        });
      }
    } catch (error: any) {
      console.error('Error searching entities:', error);
      toast({
        title: 'Search Error',
        description: error.message || 'Failed to search entities',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getImageStatus = (imageUrl?: string) => {
    if (!imageUrl) return 'none';
    if (imageUrl.includes('entity-images') && imageUrl.includes('storage')) return 'local';
    if (imageUrl.includes('/functions/v1/proxy-')) return 'proxy';
    return 'external';
  };

  const getStatusBadge = (entity: Entity) => {
    if (entity.is_deleted) {
      return <Badge variant="destructive">Deleted</Badge>;
    }
    
    const imageStatus = getImageStatus(entity.image_url);
    const statusConfig = {
      local: { variant: 'default' as const, label: 'Local' },
      proxy: { variant: 'secondary' as const, label: 'Proxy' },
      external: { variant: 'outline' as const, label: 'External' },
      none: { variant: 'destructive' as const, label: 'No Image' }
    };
    
    const config = statusConfig[imageStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleImageRefresh = async (entityId: string) => {
    try {
      await refreshEntityImage(entityId);
      
      // Refresh the entity in our local state
      const { data: updatedEntity } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (updatedEntity) {
        setEntities(prev => prev.map(entity => 
          entity.id === entityId ? convertToEntity(updatedEntity) : entity
        ));
      }
    } catch (error) {
      console.error('Error refreshing entity image:', error);
    }
  };

  const loadProblematicEntities = async () => {
    setIsLoading(true);
    try {
      // Load entities with image issues or missing data
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .or(`image_url.is.null,description.is.null,api_source.is.null`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setEntities(convertToEntities(data || []));
      
      toast({
        title: 'Loaded Entities',
        description: `Found ${data?.length || 0} entities that may need attention`
      });
    } catch (error: any) {
      console.error('Error loading problematic entities:', error);
      toast({
        title: 'Load Error',
        description: error.message || 'Failed to load entities',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Entity Management
        </CardTitle>
        <CardDescription>
          Search, edit, and manage entities with image refresh and soft delete capabilities
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search Entities</TabsTrigger>
            <TabsTrigger value="issues">Problematic Entities</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search entities by name, description, or slug"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchEntities()}
                className="flex-1"
              />
              <Button 
                onClick={searchEntities}
                disabled={isLoading}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="issues" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Entities missing images, descriptions, or API sources
              </p>
              <Button 
                onClick={loadProblematicEntities}
                disabled={isLoading}
                variant="outline"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Load Issues
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {entities.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {entities.length} Entity{entities.length !== 1 ? 'ies' : 'y'} Found
              </h3>
            </div>
            
            <div className="space-y-3">
              {entities.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50"
                >
                  {/* Entity Image */}
                  <div className="flex-shrink-0">
                    {entity.image_url ? (
                      <img
                        src={entity.image_url}
                        alt={entity.name}
                        className="w-16 h-16 object-cover rounded border"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Entity Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{entity.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {entity.type}
                      </Badge>
                      {getStatusBadge(entity)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {entity.description || 'No description'}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>ID: {entity.id.slice(0, 8)}...</span>
                      {entity.api_source && (
                        <span>Source: {entity.api_source}</span>
                      )}
                      <span>
                        Created: {new Date(entity.created_at || '').toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link to={`/admin/entities/${entity.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleImageRefresh(entity.id)}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    
                    {!entity.is_deleted && (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                      >
                        <Link to={`/entity/${entity.slug || entity.id}`} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading entities...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
