import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Search, Merge, TrendingUp, Database, Clock } from 'lucide-react';
import { useAdminModeration } from '@/hooks/admin/useAdminModeration';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const AdminQualityControlPanel = () => {
  const { metrics, isLoading, refetch } = useAdminModeration();
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [duplicatesFound, setDuplicatesFound] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDuplicateScan = async () => {
    try {
      setScanningDuplicates(true);
      
      const { data, error } = await supabase.rpc('detect_potential_duplicates', {
        similarity_threshold: 0.8
      });

      if (error) {
        console.error('Error scanning for duplicates:', error);
        toast({
          title: "Error",
          description: "Failed to scan for duplicates",
          variant: "destructive",
        });
        return;
      }

      setDuplicatesFound(data);
      toast({
        title: "Scan Complete",
        description: `Found ${data} potential duplicate pairs`,
      });

      refetch();
    } catch (error) {
      console.error('Error in duplicate scan:', error);
      toast({
        title: "Error",
        description: "Failed to scan for duplicates",
        variant: "destructive",
      });
    } finally {
      setScanningDuplicates(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Quality Control
          </CardTitle>
          <CardDescription>Database quality and duplicate management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse">Loading quality control data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Quality Control Overview
          </CardTitle>
          <CardDescription>Database quality metrics and duplicate detection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-blue-600">{metrics.pendingDuplicatesCount}</div>
                <Merge className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs text-muted-foreground">Pending Duplicates</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.contentQualityScore.toFixed(1)}
                </div>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-xs text-muted-foreground">Quality Score</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-orange-600">{metrics.pendingFlagsCount}</div>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-xs text-muted-foreground">Quality Issues</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(metrics.avgUserReputation)}
                </div>
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xs text-muted-foreground">Avg Reputation</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Control Tabs */}
      <Tabs defaultValue="duplicates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="duplicates">Duplicate Detection</TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="cleanup">Cleanup Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Entity Detection</CardTitle>
              <CardDescription>
                Automatically detect and manage potential duplicate entities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium">Automatic Duplicate Scan</div>
                  <div className="text-sm text-muted-foreground">
                    Scan all entities for potential duplicates based on name similarity
                  </div>
                </div>
                <Button
                  onClick={handleDuplicateScan}
                  disabled={scanningDuplicates}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  {scanningDuplicates ? 'Scanning...' : 'Scan for Duplicates'}
                </Button>
              </div>

              {duplicatesFound !== null && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{duplicatesFound} duplicates found</Badge>
                    <span className="text-sm text-muted-foreground">
                      Review them in the Moderation Panel
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Detection Settings</div>
                  <div className="text-xs text-muted-foreground">
                    Similarity threshold: 80%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Methods: Name matching, content analysis
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Current Status</div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.pendingDuplicatesCount} pending review
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last scan: Available on demand
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Metrics</CardTitle>
              <CardDescription>
                Database and content quality monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="text-sm font-medium">Content Quality</div>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.contentQualityScore.toFixed(1)}/5.0
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Average content quality score
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="text-sm font-medium">User Engagement</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(metrics.avgUserReputation)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Average user reputation
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="text-sm font-medium">Moderation Load</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.pendingFlagsCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Pending moderation items
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Cleanup Tools</CardTitle>
              <CardDescription>
                Administrative tools for database maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Reputation Recalculation</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Recalculate user reputation scores based on current activity
                  </div>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Image Health Check</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Scan for broken images and update references
                  </div>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Data Integrity Check</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Verify referential integrity and fix orphaned records
                  </div>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};