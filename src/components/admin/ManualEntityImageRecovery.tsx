import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { refreshEntityImage } from '@/services/recommendation/entityOperations';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, InfoIcon, CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Entity = {
  id: string;
  name: string;
  api_ref: string;
  api_source: string;
  image_url: string | null;
  venue: string | null;
  metadata: any;
  type: string;
};

type RecoveryStatus = {
  [key: string]: {
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  };
};

export const ManualEntityImageRecovery = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'success' | 'error'>('all');

  useEffect(() => {
    if (user) {
      fetchEntities();
    }
  }, [user]);

  useEffect(() => {
    filterEntities();
  }, [entities, searchTerm, filter]);

  const fetchEntities = async () => {
    setIsLoading(true);
    try {
      // Fetch entities without image_url that are Google Places entities
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('api_source', 'google_places')
        .is('image_url', null)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching entities:', error);
        toast({
          title: 'Error',
          description: 'Failed to load entities',
          variant: 'destructive',
        });
        return;
      }

      setEntities(data as Entity[]);
      setFilteredEntities(data as Entity[]);
    } catch (err) {
      console.error('Exception in fetchEntities:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading entities',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterEntities = () => {
    let results = [...entities];
    
    // Apply search term filter
    if (searchTerm.trim() !== '') {
      results = results.filter(entity => 
        entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entity.venue && entity.venue.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Apply status filter
    if (filter === 'success') {
      results = results.filter(entity => 
        recoveryStatus[entity.id]?.status === 'success'
      );
    } else if (filter === 'error') {
      results = results.filter(entity => 
        recoveryStatus[entity.id]?.status === 'error'
      );
    } else if (filter === 'pending') {
      results = results.filter(entity => 
        !recoveryStatus[entity.id] || recoveryStatus[entity.id]?.status === 'idle'
      );
    }
    
    setFilteredEntities(results);
  };

  const handleRecoverImage = async (entityId: string, entityName: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to perform this operation',
        variant: 'destructive',
      });
      return;
    }

    // Update status to loading
    setRecoveryStatus(prev => ({
      ...prev,
      [entityId]: { status: 'loading' }
    }));

    try {
      console.log(`Starting image recovery for entity: ${entityName} (${entityId})`);
      
      const success = await refreshEntityImage(entityId);
      
      if (success) {
        console.log(`✅ Successfully recovered image for: ${entityName}`);
        setRecoveryStatus(prev => ({
          ...prev,
          [entityId]: { 
            status: 'success',
            message: 'Image recovered successfully' 
          }
        }));
        
        // Remove this entity from the list as it now has an image
        setEntities(prev => prev.filter(e => e.id !== entityId));
        
        toast({
          title: 'Image Recovered',
          description: `Successfully recovered image for ${entityName}`,
          variant: 'default',
        });
      } else {
        console.log(`❌ Failed to recover image for: ${entityName}`);
        setRecoveryStatus(prev => ({
          ...prev,
          [entityId]: { 
            status: 'error',
            message: 'Failed to recover image' 
          }
        }));
        
        toast({
          title: 'Recovery Failed',
          description: `Could not recover image for ${entityName}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(`Error recovering image for entity ${entityId}:`, error);
      setRecoveryStatus(prev => ({
        ...prev,
        [entityId]: { 
          status: 'error', 
          message: `Error: ${(error as Error).message}` 
        }
      }));
      
      toast({
        title: 'Error',
        description: `An error occurred: ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  const renderStatusBadge = (entityId: string) => {
    const status = recoveryStatus[entityId];
    
    if (!status || status.status === 'idle') {
      return <Badge variant="outline">Pending</Badge>;
    }
    
    if (status.status === 'loading') {
      return <Badge className="bg-blue-500">Processing...</Badge>;
    }
    
    if (status.status === 'success') {
      return <Badge className="bg-green-500">Success</Badge>;
    }
    
    if (status.status === 'error') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    
    return null;
  };

  const renderAuthWarning = () => {
    if (!user) {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to perform recovery operations. Please log in and try again.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Manual Entity Image Recovery</CardTitle>
        <CardDescription>
          Manually recover images for Google Places entities one by one
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderAuthWarning()}
        
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How Manual Recovery Works</AlertTitle>
          <AlertDescription>
            <p>This tool allows you to recover Google Places images one at a time:</p>
            <ol className="list-decimal ml-5 mt-2">
              <li>Each entity is listed below with its details</li>
              <li>Click the "Recover Image" button next to an entity</li>
              <li>The system will attempt to fetch and store a fresh image</li>
              <li>Successfully recovered entities will be removed from the list</li>
            </ol>
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-1/2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or venue..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              All
            </Button>
            <Button 
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
              size="sm"
            >
              Pending
            </Button>
            <Button 
              variant={filter === 'success' ? 'default' : 'outline'}
              onClick={() => setFilter('success')}
              size="sm"
            >
              Success
            </Button>
            <Button 
              variant={filter === 'error' ? 'default' : 'outline'}
              onClick={() => setFilter('error')}
              size="sm"
            >
              Failed
            </Button>
          </div>
          
          <Button 
            onClick={fetchEntities} 
            disabled={isLoading}
            size="sm"
            className="w-full md:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Refresh List'
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading entities...</span>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">No entities found matching your criteria</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Name</TableHead>
                  <TableHead className="hidden md:table-cell">Venue/Address</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="w-[150px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">
                      {entity.name}
                      <div className="text-xs text-muted-foreground">
                        Type: {entity.type}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {entity.venue || (
                        entity.metadata?.formatted_address || 
                        <span className="text-muted-foreground italic">No address available</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {renderStatusBadge(entity.id)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recoveryStatus[entity.id]?.status === 'loading'}
                        onClick={() => handleRecoverImage(entity.id, entity.name)}
                      >
                        {recoveryStatus[entity.id]?.status === 'loading' ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Processing
                          </>
                        ) : recoveryStatus[entity.id]?.status === 'success' ? (
                          <>
                            <CheckCircle2 className="mr-2 h-3 w-3" />
                            Recovered
                          </>
                        ) : recoveryStatus[entity.id]?.status === 'error' ? (
                          <>
                            <XCircle className="mr-2 h-3 w-3" />
                            Try Again
                          </>
                        ) : (
                          'Recover Image'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredEntities.length > 0 && (
          <div className="text-sm text-muted-foreground text-right">
            Showing {filteredEntities.length} of {entities.length} entities
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t p-4 text-sm text-muted-foreground">
        <div>
          Note: Successfully recovered images are saved to Supabase Storage and will be removed from this list.
        </div>
      </CardFooter>
    </Card>
  );
};
