
import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CreateEntityDialog } from "@/components/admin/CreateEntityDialog";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Edit, ArrowUpDown, ImagePlus, Calendar, Building2, Package, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Entity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  created_at: string;
  parent_id?: string | null;
}

export const AdminEntityManagementPanel = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, type, image_url, created_at, parent_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load entities',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleEntityCreated = () => {
    fetchEntities();
  };

  const handleSort = (field: 'name' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Helper functions for parent-child relationships
  const getChildCount = (parentId: string): number => {
    return entities.filter(entity => entity.parent_id === parentId).length;
  };

  const parentEntityIds = entities
    .filter(entity => entities.some(child => child.parent_id === entity.id))
    .map(entity => entity.id);

  const filteredEntities = search
    ? entities.filter(entity =>
        entity.name.toLowerCase().includes(search.toLowerCase()) ||
        entity.type.toLowerCase().includes(search.toLowerCase())
      )
    : entities;

  const sortedEntities = [...filteredEntities].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else {
      aValue = new Date(a.created_at).getTime();
      bValue = new Date(b.created_at).getTime();
    }
    
    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entity Management</h1>
        <Button onClick={() => setOpenCreateDialog(true)}>
          Create Entity
        </Button>
      </div>

      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search entities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('name')}
                    className="h-auto p-0 font-semibold"
                  >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Image</th>
                <th className="text-left p-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('created_at')}
                    className="h-auto p-0 font-semibold"
                  >
                    Created At
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    Loading entities...
                  </td>
                </tr>
              ) : sortedEntities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    No entities found.
                  </td>
                </tr>
              ) : (
                sortedEntities.map(entity => {
                  const hasParent = !!entity.parent_id;
                  const isParent = parentEntityIds.includes(entity.id);
                  
                  return (
                    <tr key={entity.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {hasParent && <div className="w-4 border-l border-b border-gray-300 h-3 ml-2" />}
                          <div className="flex items-center gap-2">
                            {isParent ? (
                              <Building2 className="h-4 w-4 text-blue-500" />
                            ) : hasParent ? (
                              <Package className="h-4 w-4 text-green-500" />
                            ) : (
                              <div className="w-4" />
                            )}
                            <div>
                              <div className="font-medium">{entity.name}</div>
                              {hasParent && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3" />
                                  Product under parent brand
                                </div>
                              )}
                              {isParent && (
                                <div className="text-xs text-blue-600 flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {getChildCount(entity.id)} products
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge 
                          variant={isParent ? "default" : hasParent ? "secondary" : "outline"}
                        >
                          {entity.type}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {entity.image_url ? (
                          <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100">
                            <img
                              src={entity.image_url}
                              alt={entity.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-16 h-16 rounded-md bg-gray-100 text-gray-400">
                            <ImagePlus className="h-6 w-6" />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 opacity-70" />
                          <span>{new Date(entity.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/admin/entity/${entity.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateEntityDialog
        open={openCreateDialog}
        onOpenChange={setOpenCreateDialog}
        onEntityCreated={handleEntityCreated}
      />
    </div>
  );
};
