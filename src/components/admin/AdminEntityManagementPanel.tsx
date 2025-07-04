
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  RotateCcw, 
  Shield, 
  AlertTriangle, 
  Plus,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAdminEntities } from '@/hooks/admin/useAdminEntities';
import { useAdminEntityOperations } from '@/hooks/admin/useAdminEntityOperations';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Link } from 'react-router-dom';
import { AdminEntityCreationDialog } from './AdminEntityCreationDialog';
import { AdminEntity, DatabaseEntityType } from '@/types/admin';

export const AdminEntityManagementPanel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const { entities, isLoading, refetch } = useAdminEntities({ 
    searchQuery, 
    filterType: filterType === 'all' ? undefined : filterType,
    includeDeleted: showDeleted 
  });
  const { softDeleteEntity, restoreEntity, isProcessing } = useAdminEntityOperations();

  const handleSoftDelete = async (entityId: string, entityName: string) => {
    const result = await softDeleteEntity(entityId, entityName);
    if (result.success) {
      refetch();
    }
  };

  const handleRestore = async (entityId: string, entityName: string) => {
    const result = await restoreEntity(entityId, entityName);
    if (result.success) {
      refetch();
    }
  };

  const handleEntityCreated = () => {
    refetch(); // Refresh the entities list after creation
  };

  // Use database entity types for filtering
  const entityTypes: DatabaseEntityType[] = ['movie', 'book', 'food', 'product', 'place'];

  // Filter entities based on search query, type, and deleted status
  const filteredEntities = entities.filter((entity: AdminEntity) => {
    const matchesSearch = !searchQuery || 
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;
    
    const matchesType = filterType === 'all' || entity.type === filterType;
    const matchesDeleted = showDeleted ? entity.is_deleted : !entity.is_deleted;
    
    return matchesSearch && matchesType && matchesDeleted;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Entity Management
          </CardTitle>
          <CardDescription>
            Manage entities, verify information, and handle content moderation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading entities...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Entity Management ({filteredEntities.length})
              </CardTitle>
              <CardDescription>
                Manage entities, verify information, and handle content moderation
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Entity
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {entityTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showDeleted ? "default" : "outline"}
              onClick={() => setShowDeleted(!showDeleted)}
              className="gap-2"
            >
              {showDeleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
            </Button>
          </div>

          {/* Entities List */}
          <div className="space-y-4">
            {filteredEntities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No entities found matching your criteria</p>
              </div>
            ) : (
              filteredEntities.map((entity: AdminEntity) => (
                <div
                  key={entity.id}
                  className={`flex items-center justify-between p-4 border rounded-lg bg-card ${
                    entity.is_deleted ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Entity Image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <ImageWithFallback
                        src={entity.image_url}
                        alt={entity.name}
                        className="w-full h-full object-cover"
                        entityType={entity.type}
                      />
                    </div>
                    
                    {/* Entity Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{entity.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {entity.type}
                        </Badge>
                        {entity.is_verified && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Verified
                          </Badge>
                        )}
                        {entity.is_deleted && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Deleted
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created {formatRelativeDate(entity.created_at!)}</span>
                        {entity.updated_at !== entity.created_at && (
                          <span>Updated {formatRelativeDate(entity.updated_at!)}</span>
                        )}
                        {entity.api_source && (
                          <Badge variant="outline" className="text-xs">
                            {entity.api_source}
                          </Badge>
                        )}
                      </div>
                      
                      {entity.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {entity.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/entities/${entity.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    
                    {entity.is_deleted ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleRestore(entity.id, entity.name)}
                        disabled={isProcessing[entity.id]}
                        className="gap-2"
                      >
                        {isProcessing[entity.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleSoftDelete(entity.id, entity.name)}
                        disabled={isProcessing[entity.id]}
                        className="gap-2"
                      >
                        {isProcessing[entity.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entity Creation Dialog */}
      <AdminEntityCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onEntityCreated={handleEntityCreated}
      />
    </>
  );
};
