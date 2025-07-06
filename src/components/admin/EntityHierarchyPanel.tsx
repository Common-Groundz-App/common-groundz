
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Package, 
  Building2, 
  ArrowUpRight,
  Users,
  Loader2
} from 'lucide-react';
import { getEntityWithChildren, setEntityParent } from '@/services/entityHierarchyService';
import { EntityWithChildren } from '@/services/entityHierarchyService';

interface EntityHierarchy {
  parent: EntityWithChildren;
  childrenCount: number;
  isExpanded: boolean;
}

export const EntityHierarchyPanel: React.FC = () => {
  const [hierarchies, setHierarchies] = useState<EntityHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [availableParents, setAvailableParents] = useState<any[]>([]);
  const [isManaging, setIsManaging] = useState(false);
  const { toast } = useToast();

  const fetchHierarchies = async () => {
    try {
      setIsLoading(true);
      
      // Get all parent entities (entities that have children)
      const { data: parentEntities, error } = await supabase
        .from('entities')
        .select(`
          id,
          name,
          type,
          image_url,
          description,
          created_at,
          parent_id
        `)
        .eq('is_deleted', false)
        .not('parent_id', 'is', null);

      if (error) throw error;

      // Get unique parent IDs
      const parentIds = [...new Set(parentEntities?.map(entity => entity.parent_id))].filter(Boolean);
      
      if (parentIds.length === 0) {
        setHierarchies([]);
        return;
      }

      // Fetch parent entities with their children
      const hierarchyPromises = parentIds.map(async (parentId) => {
        if (!parentId) return null;
        
        const parentWithChildren = await getEntityWithChildren(parentId);
        if (!parentWithChildren) return null;

        return {
          parent: parentWithChildren,
          childrenCount: parentWithChildren.children?.length || 0,
          isExpanded: false
        };
      });

      const results = await Promise.all(hierarchyPromises);
      const validHierarchies = results.filter((h): h is EntityHierarchy => h !== null);
      
      setHierarchies(validHierarchies);
    } catch (error) {
      console.error('Error fetching hierarchies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load entity hierarchies',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableParents = async () => {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, type')
        .eq('is_deleted', false)
        .is('parent_id', null)
        .order('name');

      if (error) throw error;
      setAvailableParents(data || []);
    } catch (error) {
      console.error('Error fetching available parents:', error);
    }
  };

  const toggleHierarchyExpansion = (index: number) => {
    setHierarchies(prev => prev.map((h, i) => 
      i === index ? { ...h, isExpanded: !h.isExpanded } : h
    ));
  };

  const handleSetParent = async (childId: string, newParentId: string | null) => {
    try {
      setIsManaging(true);
      await setEntityParent(childId, newParentId);
      
      toast({
        title: 'Success',
        description: 'Entity parent relationship updated successfully'
      });
      
      // Refresh hierarchies
      await fetchHierarchies();
    } catch (error) {
      console.error('Error updating parent relationship:', error);
      toast({
        title: 'Error',
        description: 'Failed to update parent relationship',
        variant: 'destructive'
      });
    } finally {
      setIsManaging(false);
    }
  };

  const filteredHierarchies = hierarchies.filter(hierarchy =>
    hierarchy.parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hierarchy.parent.children?.some(child => 
      child.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  useEffect(() => {
    fetchHierarchies();
    fetchAvailableParents();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entity Hierarchies
          </CardTitle>
          <CardDescription>
            Manage parent-child relationships between entities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Entity Hierarchies
            </CardTitle>
            <CardDescription>
              Manage parent-child relationships between entities
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Manage Relationships
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Manage Entity Relationships</DialogTitle>
                <DialogDescription>
                  Select an entity and assign it to a parent brand or make it standalone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Entity</label>
                  <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an entity to manage" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* This would be populated with all entities */}
                      <SelectItem value="placeholder">Select an entity...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parent Entity</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose parent (leave empty for standalone)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Parent (Standalone)</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name} ({parent.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                  <Button size="sm" disabled={isManaging}>
                    {isManaging ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Relationship'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brands and products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>

        {filteredHierarchies.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Entity Hierarchies</h3>
            <p className="text-muted-foreground mb-4">
              Create parent-child relationships by assigning products to brands.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Hierarchy
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHierarchies.map((hierarchy, index) => (
              <div key={hierarchy.parent.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHierarchyExpansion(index)}
                      className="p-0 h-auto"
                    >
                      {hierarchy.isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{hierarchy.parent.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {hierarchy.parent.type}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {hierarchy.childrenCount} products
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>

                {hierarchy.isExpanded && hierarchy.parent.children && (
                  <div className="mt-4 ml-7 space-y-2">
                    {hierarchy.parent.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="font-medium">{child.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {child.type}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
