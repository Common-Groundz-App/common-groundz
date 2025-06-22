import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, RefreshCw, Activity, Image, Clock, Download, Zap } from 'lucide-react';
import { imageHealthService } from '@/services/imageHealthService';
import { imageMigrationService } from '@/services/imageMigrationService';
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
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [isRunningMigration, setIsRunningMigration] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const { refreshEntityImage } = useEntityImageRefresh();
  const { toast } = useToast();

  // Helper function to safely format the last checked date
  const formatLastChecked = (lastChecked?: Date): string => {
    if (!lastChecked) {
      return 'Never';
    }
    try {
      return lastChecked.toLocaleDateString() + ' ' + lastChecked.toLocaleTimeString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Helper function to format the session date
  const formatSessionDate = (date?: Date): string => {
    if (!date) {
      return 'Never';
    }
    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffHours === 0) {
        return `${diffMinutes} minutes ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else {
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Load health statistics and migration data
  useEffect(() => {
    loadHealthData();
    loadMigrationData();
  }, []);

  const loadMigrationData = async () => {
    try {
      const latestSession = await imageMigrationService.getLatestMigrationSession();
      setMigrationStats(latestSession);
    } catch (error) {
      console.error('Error loading migration data:', error);
    }
  };

  const loadHealthData = async () => {
    setIsLoadingData(true);
    try {
      // Get stats from persistent storage
      const stats = await imageHealthService.getHealthStats();
      setHealthStats(stats);

      // Get recent failures with entity details from database
      const recentFailures = await imageHealthService.getRecentHealthChecks(20);
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
      // Set empty state if there's an error
      setHealthStats({
        totalChecked: 0,
        healthyImages: 0,
        brokenImages: 0,
        recentFailures: [],
        errorBreakdown: {}
      });
      setBrokenEntities([]);
    } finally {
      setIsLoadingData(false);
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

  const runHealthCheckWithMigration = async () => {
    setIsRunningHealthCheck(true);
    try {
      const result = await imageHealthService.runHealthCheckCycle(true);
      
      toast({
        title: 'Health check with migration completed',
        description: `Checked ${result.checked} images, found ${result.broken} broken images, attempted ${result.migrated || 0} migrations.`
      });
      
      // Reload data to show updated results
      await loadHealthData();
      await loadMigrationData();
    } catch (error) {
      console.error('Health check with migration failed:', error);
      toast({
        title: 'Health check with migration failed',
        description: 'An error occurred during the health check with migration.',
        variant: 'destructive'
      });
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const runFullMigration = async () => {
    setIsRunningMigration(true);
    try {
      const result = await imageMigrationService.runAutomatedMigration();
      
      toast({
        title: 'Image migration completed',
        description: `Processed ${result.totalEntities} entities: ${result.migrated} migrated, ${result.failed} failed, ${result.skipped} skipped.`
      });
      
      // Reload data to show updated results
      await loadHealthData();
      await loadMigrationData();
    } catch (error) {
      console.error('Migration failed:', error);
      toast({
        title: 'Migration failed',
        description: 'An error occurred during the migration process.',
        variant: 'destructive'
      });
    } finally {
      setIsRunningMigration(false);
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
          Image Health & Migration System
        </CardTitle>
        <CardDescription>
          Monitor image health and migrate external images to local storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Migration Statistics */}
        {migrationStats && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Latest Migration Session
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{migrationStats.total_entities}</div>
                <div className="text-sm text-muted-foreground">Total Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{migrationStats.migrated_count}</div>
                <div className="text-sm text-muted-foreground">Migrated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{migrationStats.failed_count}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{migrationStats.skipped_count}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Started:</span>
              <span>{formatSessionDate(new Date(migrationStats.started_at))}</span>
              <Badge variant={migrationStats.status === 'completed' ? 'default' : migrationStats.status === 'running' ? 'secondary' : 'destructive'}>
                {migrationStats.status}
              </Badge>
            </div>
          </div>
        )}

        {/* Last Health Check Info */}
        {healthStats && healthStats.lastSessionDate && (
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Last health check:</span>
              <span>{formatSessionDate(healthStats.lastSessionDate)}</span>
            </div>
          </div>
        )}

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
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={runHealthCheck}
            disabled={isRunningHealthCheck || isRunningMigration}
            className="flex items-center gap-2"
          >
            <Activity className={`h-4 w-4 ${isRunningHealthCheck ? 'animate-spin' : ''}`} />
            {isRunningHealthCheck ? 'Checking...' : 'Run Health Check'}
          </Button>
          
          <Button 
            onClick={runHealthCheckWithMigration}
            disabled={isRunningHealthCheck || isRunningMigration}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Zap className={`h-4 w-4 ${isRunningHealthCheck ? 'animate-spin' : ''}`} />
            {isRunningHealthCheck ? 'Checking & Migrating...' : 'Health Check + Auto-Migrate'}
          </Button>
          
          <Button 
            onClick={runFullMigration}
            disabled={isRunningHealthCheck || isRunningMigration}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className={`h-4 w-4 ${isRunningMigration ? 'animate-spin' : ''}`} />
            {isRunningMigration ? 'Migrating All...' : 'Migrate All External Images'}
          </Button>
          
          <Button variant="outline" onClick={() => { loadHealthData(); loadMigrationData(); }} disabled={isLoadingData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        <Separator />

        {/* Migration Alert */}
        {healthStats && healthStats.brokenImages > 0 && (
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription>
              <strong>Automated Migration Available:</strong> You have {healthStats.brokenImages} broken external images. 
              Use "Migrate All External Images" to automatically download and store them locally, 
              eliminating dependency on external APIs.
            </AlertDescription>
          </Alert>
        )}

        {/* Show loading state */}
        {isLoadingData && (
          <div className="text-center p-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading health data...</p>
          </div>
        )}

        {/* Show no data state only when not loading and no health stats */}
        {!isLoadingData && (!healthStats || healthStats.totalChecked === 0) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No health check data available. Click "Run New Health Check" to scan all entity images.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Breakdown */}
        {!isLoadingData && healthStats && Object.keys(healthStats.errorBreakdown).length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Error Breakdown</h4>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(healthStats.errorBreakdown).map(([errorType, count]) => (
                <Badge key={errorType} variant="outline">
                  {errorType}: {String(count)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Broken Images List */}
        {!isLoadingData && healthStats && healthStats.totalChecked > 0 && (
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
        )}

        {brokenEntities.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              These entities have broken or inaccessible images. Use the migration system above to automatically 
              download and store these images locally, or manually refresh individual entities.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
