
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, RefreshCw, Activity, Image } from 'lucide-react';
import { imageHealthService } from '@/services/imageHealthService';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EntityWithImageIssue {
  id: string;
  name: string;
  image_url: string;
  error_type?: string;
  consecutive_failures: number;
  last_checked?: Date;
}

export const AdminImageHealthPanel = () => {
  const [healthStats, setHealthStats] = useState<any>(null);
  const [brokenEntities, setBrokenEntities] = useState<EntityWithImageIssue[]>([]);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const { refreshEntityImage } = useEntityImageRefresh();
  const { toast } = useToast();

  // Helper function to safely format the last checked date
  const formatLastChecked = (lastChecked?: Date): string => {
    if (!lastChecked) {
      return 'Never';
    }
    try {
      return lastChecked.toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Load health statistics and recent failures
  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      // Get stats from health service
      const stats = imageHealthService.getHealthStats();
      setHealthStats(stats);

      // Get recent failures with entity details
      const recentFailures = imageHealthService.getRecentHealthChecks(20);
      const brokenImageData: EntityWithImageIssue[] = [];

      for (const failure of recentFailures.filter(f => !f.isHealthy)) {
        // Get entity details
        const { data: entity } = await supabase
          .from('entities')
          .select('id, name, image_url')
          .eq('id', failure.entityId)
          .single();

        if (entity) {
          brokenImageData.push({
            id: entity.id,
            name: entity.name,
            image_url: entity.image_url,
            error_type: failure.errorType,
            consecutive_failures: failure.consecutiveFailures,
            last_checked: failure.lastChecked
          });
        }
      }

      setBrokenEntities(brokenImageData);
    } catch (error) {
      console.error('Error loading health data:', error);
    }
  };

  const runHealthCheck = async () => {
    setIsRunningHealthCheck(true);
    try {
      const result = await imageHealthService.runHealthCheckCycle();
      
      toast({
        title: 'Health check completed',
        description: `Checked ${result.checked} images, found ${result.broken} broken images.`
      });
      
      // Reload data to show updated results
      await loadHealthData();
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: 'Health check failed',
        description: 'An error occurred during the health check.',
        variant: 'destructive'
      });
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const refreshEntityImageManually = async (entityId: string, entityName: string) => {
    setIsRefreshing(entityId);
    try {
      const result = await refreshEntityImage(entityId);
      
      if (result) {
        toast({
          title: 'Image refreshed',
          description: `Successfully refreshed image for "${entityName}".`
        });
        // Reload data to update the list
        await loadHealthData();
      } else {
        toast({
          title: 'Refresh failed',
          description: `Failed to refresh image for "${entityName}".`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Manual refresh error:', error);
      toast({
        title: 'Refresh error',
        description: `Error refreshing "${entityName}": ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(null);
    }
  };

  const getErrorBadgeVariant = (errorType?: string) => {
    switch (errorType) {
      case '404': return 'destructive';
      case '403': return 'secondary';
      case 'timeout': return 'outline';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Image Health Monitoring
        </CardTitle>
        <CardDescription>
          Monitor and manage image health across all entities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Statistics */}
        {healthStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-2xl font-bold text-primary">{healthStats.totalChecked}</div>
              <div className="text-sm text-muted-foreground">Total Checked</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{healthStats.healthyImages}</div>
              <div className="text-sm text-muted-foreground">Healthy Images</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{healthStats.brokenImages}</div>
              <div className="text-sm text-muted-foreground">Broken Images</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {healthStats.totalChecked > 0 ? Math.round((healthStats.healthyImages / healthStats.totalChecked) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Health Rate</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={runHealthCheck}
            disabled={isRunningHealthCheck}
            className="flex items-center gap-2"
          >
            <Activity className={`h-4 w-4 ${isRunningHealthCheck ? 'animate-spin' : ''}`} />
            {isRunningHealthCheck ? 'Checking...' : 'Run Health Check'}
          </Button>
          <Button variant="outline" onClick={loadHealthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        <Separator />

        {/* Error Breakdown */}
        {healthStats && Object.keys(healthStats.errorBreakdown).length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Error Breakdown</h4>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(healthStats.errorBreakdown).map(([errorType, count]) => (
                <Badge key={errorType} variant="outline">
                  {errorType}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Broken Images List */}
        <div>
          <h4 className="font-medium mb-3">Entities with Image Issues ({brokenEntities.length})</h4>
          
          {brokenEntities.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No entities with image issues found. All images appear to be healthy!
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {brokenEntities.map((entity) => (
                <div key={entity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entity.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      ID: {entity.id}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span>Failures: {entity.consecutive_failures}</span>
                      <span className="ml-3">
                        Last checked: {formatLastChecked(entity.last_checked)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {entity.error_type && (
                      <Badge variant={getErrorBadgeVariant(entity.error_type)}>
                        {entity.error_type}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshEntityImageManually(entity.id, entity.name)}
                      disabled={isRefreshing === entity.id}
                    >
                      {isRefreshing === entity.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {brokenEntities.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              These entities have broken or inaccessible images. The daily refresh job will automatically 
              attempt to fix these issues, or you can manually refresh individual entities above.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
