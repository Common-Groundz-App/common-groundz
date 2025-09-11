import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Flag, Users, TrendingUp, Shield, Clock } from 'lucide-react';
import { useAdminModeration } from '@/hooks/admin/useAdminModeration';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeDate } from '@/utils/dateUtils';

interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  flag_type: string;
  reason: string;
  description: string;
  status: string;
  priority_score: number;
  created_at: string;
  flagger_user_id: string;
}

export const AdminModerationPanel = () => {
  const { metrics, isLoading, refetch } = useAdminModeration();
  const [contentFlags, setContentFlags] = useState<ContentFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const { toast } = useToast();

  const fetchContentFlags = async () => {
    try {
      setFlagsLoading(true);
      const { data, error } = await supabase
        .from('content_flags')
        .select('*')
        .eq('status', 'pending')
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching content flags:', error);
        return;
      }

      setContentFlags(data || []);
    } catch (error) {
      console.error('Error in fetchContentFlags:', error);
    } finally {
      setFlagsLoading(false);
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    try {
      const { error } = await supabase
        .from('content_flags')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', flagId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to resolve flag",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Flag resolved successfully",
      });

      fetchContentFlags();
      refetch();
    } catch (error) {
      console.error('Error resolving flag:', error);
    }
  };

  const handleDismissFlag = async (flagId: string) => {
    try {
      const { error } = await supabase
        .from('content_flags')
        .update({
          status: 'dismissed',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', flagId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to dismiss flag",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Flag dismissed successfully",
      });

      fetchContentFlags();
      refetch();
    } catch (error) {
      console.error('Error dismissing flag:', error);
    }
  };

  useEffect(() => {
    fetchContentFlags();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Moderation Panel
          </CardTitle>
          <CardDescription>Community moderation and quality control</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse">Loading moderation data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Moderation Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Moderation Overview
          </CardTitle>
          <CardDescription>Community moderation and quality control metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-orange-600">{metrics.pendingFlagsCount}</div>
                <Flag className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-xs text-muted-foreground">Pending Flags</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-red-600">{metrics.highPriorityFlagsCount}</div>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-xs text-muted-foreground">High Priority</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-blue-600">{metrics.pendingDuplicatesCount}</div>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs text-muted-foreground">Pending Duplicates</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(metrics.avgUserReputation)}
                </div>
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-xs text-muted-foreground">Avg Reputation</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moderation Tabs */}
      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">Content Flags</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="reputation">User Reputation</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Content Flags</CardTitle>
              <CardDescription>
                Community-reported content that requires moderation review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse">Loading flags...</div>
                </div>
              ) : contentFlags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending flags to review
                </div>
              ) : (
                <div className="space-y-4">
                  {contentFlags.map((flag) => (
                    <div key={flag.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {flag.content_type}
                            </Badge>
                            <Badge 
                              variant={flag.priority_score >= 80 ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              Priority: {flag.priority_score}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {flag.flag_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium">{flag.reason}</div>
                          {flag.description && (
                            <div className="text-sm text-muted-foreground">
                              {flag.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeDate(flag.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveFlag(flag.id)}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissFlag(flag.id)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Detection</CardTitle>
              <CardDescription>
                Potential duplicate entities detected by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Duplicate detection feature coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reputation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Reputation System</CardTitle>
              <CardDescription>
                Community reputation scores and quality metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">{metrics.totalUsersWithReputation}</div>
                  <div className="text-sm text-muted-foreground">Users with Reputation</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">{Math.round(metrics.avgUserReputation)}</div>
                  <div className="text-sm text-muted-foreground">Average Reputation</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">
                    {metrics.contentQualityScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Content Quality Score</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};