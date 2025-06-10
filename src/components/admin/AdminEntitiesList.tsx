
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Building2, 
  Brain, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Filter
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { fetchAdminEntities, generateEntityAISummary, type AdminEntity } from '@/services/adminService';
import { useToast } from '@/hooks/use-toast';

const AdminEntitiesList = () => {
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<AdminEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (typeFilter === 'all') {
      setFilteredEntities(entities);
    } else {
      setFilteredEntities(entities.filter(entity => entity.type === typeFilter));
    }
  }, [entities, typeFilter]);

  const loadEntities = async () => {
    try {
      const data = await fetchAdminEntities();
      setEntities(data);
    } catch (error) {
      console.error('Error loading entities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load entities',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async (entityId: string) => {
    setGeneratingIds(prev => new Set(prev).add(entityId));
    
    try {
      const success = await generateEntityAISummary(entityId);
      
      if (success) {
        toast({
          title: 'Entity Summary Generation Started',
          description: 'The entity AI summary is being generated. This may take a few moments.',
        });
        
        // Refresh the entities list after a short delay
        setTimeout(loadEntities, 2000);
      } else {
        throw new Error('Generation failed');
      }
    } catch (error) {
      console.error('Error generating entity summary:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate entity AI summary. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setGeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityId);
        return newSet;
      });
    }
  };

  const getEntityTypeColor = (type: string) => {
    const colors = {
      food: 'bg-green-100 text-green-800',
      product: 'bg-blue-100 text-blue-800',
      movie: 'bg-purple-100 text-purple-800',
      book: 'bg-orange-100 text-orange-800',
      place: 'bg-teal-100 text-teal-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const entityTypes = [...new Set(entities.map(e => e.type))].sort();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading entities...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium">No Entities Found</h3>
        <p className="text-sm text-muted-foreground">
          No entities with dynamic reviews found in the system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <span className="font-medium">
            {filteredEntities.length} of {entities.length} Entities
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
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
          </div>
          
          <Button onClick={loadEntities} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Entity Summary</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntities.map((entity) => (
              <TableRow key={entity.id}>
                <TableCell className="space-y-1">
                  <div className="font-medium truncate max-w-[200px]">
                    {entity.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.id.slice(0, 8)}...
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getEntityTypeColor(entity.type)}
                  >
                    {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline">
                    {entity.review_count} review{entity.review_count !== 1 ? 's' : ''}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="space-y-1">
                    {entity.has_entity_summary ? (
                      <div className="space-y-1">
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Generated
                        </Badge>
                        {entity.last_summary_generated && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(entity.last_summary_generated).toLocaleDateString()}
                          </div>
                        )}
                        {entity.summary_model_used && (
                          <div className="text-xs text-muted-foreground">
                            {entity.summary_model_used}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        None
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Button
                    onClick={() => handleGenerateSummary(entity.id)}
                    disabled={generatingIds.has(entity.id)}
                    size="sm"
                    variant={entity.has_entity_summary ? "outline" : "default"}
                    className="gap-1"
                  >
                    {generatingIds.has(entity.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Brain className="h-3 w-3" />
                    )}
                    {entity.has_entity_summary ? 'Regenerate' : 'Generate'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminEntitiesList;
