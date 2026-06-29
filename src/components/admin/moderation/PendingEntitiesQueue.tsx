import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { RejectEntityDialog } from './RejectEntityDialog';

interface PendingEntity {
  id: string;
  name: string;
  type: string | null;
  slug: string | null;
  website_url: string | null;
  image_url: string | null;
  created_at: string;
  created_by: string | null;
  approval_status: string;
}

export const PendingEntitiesQueue: React.FC = () => {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<PendingEntity | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-pending-entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, type, slug, website_url, image_url, created_at, created_by, approval_status')
        .eq('approval_status', 'pending')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PendingEntity[];
    },
  });

  const handleApprove = async (entity: PendingEntity) => {
    setBusyId(entity.id);
    try {
      const { data, error } = await supabase.functions.invoke('moderate-entity', {
        body: { entityId: entity.id, action: 'approve', expectedStatus: 'pending' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Approved "${entity.name}"`);
      queryClient.invalidateQueries({ queryKey: ['admin-pending-entities'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-entity-count'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectConfirmed = async (entity: PendingEntity, reason: string) => {
    setBusyId(entity.id);
    try {
      const { data, error } = await supabase.functions.invoke('moderate-entity', {
        body: { entityId: entity.id, action: 'reject', reason, expectedStatus: 'pending' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Rejected "${entity.name}"`);
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-pending-entities'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-entity-count'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Pending Entities</CardTitle>
          <CardDescription>
            Review entities awaiting approval. Approved and pending entities are visible to the public; rejected entities are hidden.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No pending entities right now.</p>
        ) : (
          data.map((entity) => (
            <div
              key={entity.id}
              className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex gap-3 items-start min-w-0 flex-1">
                {entity.image_url ? (
                  <img
                    src={entity.image_url}
                    alt={entity.name}
                    className="h-12 w-12 rounded object-cover flex-shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{entity.name}</span>
                    <Badge variant="secondary">{entity.type ?? 'unknown'}</Badge>
                    <Badge variant="outline">pending</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center flex-wrap">
                    <span>Created {new Date(entity.created_at).toLocaleString()}</span>
                    {entity.website_url && (
                      <a
                        href={entity.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        site
                      </a>
                    )}
                    {entity.slug && (
                      <a
                        href={`/entity/${entity.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        preview
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectTarget(entity)}
                  disabled={busyId === entity.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(entity)}
                  disabled={busyId === entity.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <RejectEntityDialog
        open={!!rejectTarget}
        entityName={rejectTarget?.name ?? ''}
        busy={busyId === rejectTarget?.id}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && handleRejectConfirmed(rejectTarget, reason)}
      />
    </Card>
  );
};

export default PendingEntitiesQueue;
