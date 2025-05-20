
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader, CheckCircle, XCircle, Info } from 'lucide-react';

export const EntityImageMigration = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    migrated: 0,
    failed: 0,
    remaining: 0
  });
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchEntityStats = async () => {
    try {
      // Get total entities with images
      const { count: total } = await supabase
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .not('image_url', 'is', null);

      // Get migrated entities (those with photo_reference or have been processed)
      const { count: migrated } = await supabase
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .not('image_url', 'is', null)
        .or('photo_reference.is.not.null,image_url.like.%entity-images%');

      // Calculate remaining and failed
      const remaining = total - migrated;
      
      setStats({
        total: total || 0,
        migrated: migrated || 0,
        failed: 0, // Will be updated during migration
        remaining: remaining || 0
      });

      // Calculate progress percentage
      const percentage = total ? Math.floor((migrated / total) * 100) : 0;
      setProgress(percentage);
      
    } catch (error) {
      console.error('Error fetching entity stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch entity migration statistics',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchEntityStats();
  }, []);

  const processBatch = async (offset = 0) => {
    try {
      const response = await supabase.functions.invoke('migrate-entity-images', {
        body: { offset }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      setBatchResults(prev => [result, ...prev]);
      
      if (result.errors && result.errors.length > 0) {
        setErrors(prev => [...result.errors, ...prev]);
      }

      // Update stats
      setStats(prev => ({
        ...prev,
        migrated: prev.migrated + result.successful,
        failed: prev.failed + result.failed,
        remaining: prev.remaining - result.processed
      }));

      // Update progress
      const newProgress = stats.total 
        ? Math.floor(((stats.migrated + result.successful) / stats.total) * 100) 
        : 0;
      setProgress(newProgress);

      return result;
    } catch (error) {
      console.error('Error processing batch:', error);
      toast({
        title: 'Batch Processing Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      return null;
    }
  };

  const startMigration = async () => {
    setLoading(true);
    setBatchResults([]);
    setErrors([]);
    
    try {
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const result = await processBatch(offset);
        
        if (!result || !result.hasMore) {
          hasMore = false;
        } else {
          offset += result.processed;
        }
      }
      
      toast({
        title: 'Migration Complete',
        description: `Migrated ${stats.migrated} entities, ${errors.length} errors.`,
        variant: errors.length > 0 ? 'destructive' : 'default'
      });
      
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Migration Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      // Refresh stats
      fetchEntityStats();
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Entity Image Migration</CardTitle>
        <CardDescription>
          Migrate entity images to Supabase Storage for improved reliability and performance
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Migration Progress</div>
          <div className="text-sm text-muted-foreground">{progress}%</div>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm font-medium">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          
          <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
            <div className="text-sm font-medium">Migrated</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.migrated}</div>
          </div>
          
          <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
            <div className="text-sm font-medium">Failed</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
          </div>
          
          <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-sm font-medium">Remaining</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.remaining}</div>
          </div>
        </div>
        
        {errors.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">
              Errors ({errors.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {errors.map((error, index) => (
                <div key={index} className="text-sm bg-red-50 dark:bg-red-900/10 p-2 rounded">
                  <div className="font-medium">Entity ID: {error.id}</div>
                  <div className="text-xs text-red-600 dark:text-red-400">{error.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {batchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">Batch Results</h3>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {batchResults.map((batch, index) => (
                <div key={index} className="text-sm bg-muted/30 p-2 rounded flex items-center justify-between">
                  <div>
                    <span className="font-medium">Batch {index + 1}:</span> {batch.processed} processed
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20">
                      {batch.successful} success
                    </Badge>
                    {batch.failed > 0 && (
                      <Badge variant="outline" className="bg-red-100 dark:bg-red-900/20">
                        {batch.failed} failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={fetchEntityStats}
          disabled={loading}
        >
          Refresh Stats
        </Button>
        
        <Button
          onClick={startMigration}
          disabled={loading || stats.remaining === 0}
        >
          {loading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Migrating...
            </>
          ) : stats.remaining === 0 ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Migration Complete
            </>
          ) : (
            <>
              <Info className="mr-2 h-4 w-4" />
              Start Migration
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

