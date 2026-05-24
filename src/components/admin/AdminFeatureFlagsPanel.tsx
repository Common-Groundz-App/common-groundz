import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ToggleRight, ShieldAlert, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useAppFlagRows, useSetAppFlag } from '@/hooks/admin/useAppFlagsAdmin';

type PendingChange =
  | { key: 'mux.uploads_enabled'; nextEnabled: boolean }
  | { key: 'mux.mode'; nextMode: 'live' | 'test' }
  | null;

export function AdminFeatureFlagsPanel() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const publicFlags = useAppConfig();
  const rows = useAppFlagRows();
  const setFlag = useSetAppFlag();

  const [pending, setPending] = useState<PendingChange>(null);
  const [reason, setReason] = useState('');

  if (adminLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
          <span>Admins only.</span>
        </CardContent>
      </Card>
    );
  }

  const uploadsRow = rows.data?.find((r) => r.key === 'mux.uploads_enabled');
  const modeRow = rows.data?.find((r) => r.key === 'mux.mode');

  const uploadsEnabled = uploadsRow?.value?.enabled ?? true;
  const muxMode: 'live' | 'test' = modeRow?.value?.mode === 'test' ? 'test' : 'live';

  const effective = publicFlags.data?.mux;

  const confirmTitle =
    pending?.key === 'mux.uploads_enabled'
      ? pending.nextEnabled
        ? 'Enable Mux video uploads?'
        : 'Disable Mux video uploads?'
      : pending?.key === 'mux.mode'
        ? pending.nextMode === 'test'
          ? 'Switch Mux to Test mode?'
          : 'Switch Mux to Live mode?'
        : '';

  const confirmDesc =
    pending?.key === 'mux.uploads_enabled'
      ? pending.nextEnabled
        ? 'New videos will upload to Mux again.'
        : 'New videos will fall back to Supabase Storage. Existing Mux videos continue playing.'
      : pending?.key === 'mux.mode'
        ? pending.nextMode === 'test'
          ? 'New uploads will use Mux test mode (no charges, watermarked).'
          : 'New uploads will use Mux live mode.'
        : '';

  const applyPending = async () => {
    if (!pending) return;
    try {
      if (pending.key === 'mux.uploads_enabled') {
        await setFlag.mutateAsync({
          key: 'mux.uploads_enabled',
          value: { enabled: pending.nextEnabled },
          reason: reason.trim() || undefined,
        });
      } else {
        await setFlag.mutateAsync({
          key: 'mux.mode',
          value: { mode: pending.nextMode },
          reason: reason.trim() || undefined,
        });
      }
      toast({ title: 'Flag updated', description: 'The change is now active.' });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err?.message ?? 'Could not update flag.',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
      setReason('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Runtime controls for the Mux video pipeline. Changes apply to new uploads only.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Effective config readout */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Effective config (backend)</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => publicFlags.refetch()}
                disabled={publicFlags.isFetching}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${publicFlags.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {publicFlags.isLoading || !effective ? (
              <Skeleton className="h-5 w-64" />
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  Uploads:{' '}
                  <span className={effective.uploads_enabled ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                    {effective.uploads_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </span>
                <span>
                  Mode:{' '}
                  <span className="font-medium capitalize">{effective.mode}</span>
                </span>
              </div>
            )}
          </div>

          {/* Mux uploads switch */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="mux-uploads" className="text-base">
                Mux video uploads
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, new video uploads go to Supabase Storage. Existing Mux videos continue playing.
              </p>
              {uploadsRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(uploadsRow.updated_at), { addSuffix: true })}
                  {uploadsRow.updated_reason ? ` — “${uploadsRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <Switch
              id="mux-uploads"
              checked={uploadsEnabled}
              disabled={rows.isLoading || setFlag.isPending}
              onCheckedChange={(checked) =>
                setPending({ key: 'mux.uploads_enabled', nextEnabled: checked })
              }
            />
          </div>

          {/* Mux mode switch */}
          <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${!uploadsEnabled ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="mux-mode" className="text-base">
                Mux mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Test mode is for development only. Switching affects new uploads only — existing posts are unchanged.
              </p>
              {modeRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(modeRow.updated_at), { addSuffix: true })}
                  {modeRow.updated_reason ? ` — “${modeRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Test</span>
              <Switch
                id="mux-mode"
                checked={muxMode === 'live'}
                disabled={!uploadsEnabled || rows.isLoading || setFlag.isPending}
                onCheckedChange={(checked) =>
                  setPending({ key: 'mux.mode', nextMode: checked ? 'live' : 'test' })
                }
              />
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm">
              Reason for change (optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Mux quota hit, switching to Supabase temporarily"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setFlag.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyPending} disabled={setFlag.isPending}>
              {setFlag.isPending ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AdminFeatureFlagsPanel;
