import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Status {
  processing_enabled: boolean;
  schedule: { jobname: string; schedule: string; active: boolean } | null;
  runs: { started_at: string; ok: boolean; report: Record<string, unknown> | null; error: string | null }[];
  counts: Record<string, number>;
  failed: number; stuck: number; retrying: number; overdue: number;
}
interface Candidate {
  id: string; path: string; status: string; attempts: number;
  last_error: string | null; created_at: string; updated_at: string;
}

const STATES = ['all', 'queued', 'deleting', 'kept', 'failed', 'deleted'] as const;
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

export function AdminMediaDeletionQueueCard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATES)[number]>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ['media_deletion', 'status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_media_deletion_status' as any);
      if (error) throw error;
      return data as unknown as Status;
    },
  });
  const list = useQuery({
    queryKey: ['media_deletion', 'list', filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_media_deletion_candidates', {
        p_status: filter === 'all' ? null : filter, p_limit: 50,
      } as any);
      if (error) throw error;
      return (data ?? []) as unknown as Candidate[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['media_deletion'] });

  const toggle = async () => {
    if (!status.data) return;
    setBusy(true);
    const next = !status.data.processing_enabled;
    const { error } = await supabase.rpc('set_app_flag', {
      _key: 'media_cleanup.processing_enabled', _value: { enabled: next } as any, _reason: reason || null,
    });
    setBusy(false); setConfirmOpen(false); setReason('');
    if (error) toast.error("Couldn't change cleanup", { description: error.message });
    else { toast.success(next ? 'Cleanup resumed' : 'Cleanup paused'); refresh(); }
  };

  const runNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-media-deletions-trigger', { method: 'POST' });
    setBusy(false);
    if (error) toast.error('Run failed', { description: error.message });
    else {
      const r = (data as any)?.result ?? {};
      toast.success(`Run finished: claimed ${r.claimed ?? 0}, deleted ${r.deleted ?? 0}`);
      refresh();
    }
  };

  const s = status.data;
  const last = s?.runs?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Saved-photo cleanup</CardTitle>
            <CardDescription>Photos removed from saved reviews and timeline updates, deleted by the hourly worker.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy || !s} onClick={runNow}>Run now</Button>
            <Button variant={s?.processing_enabled ? 'destructive' : 'default'} size="sm" disabled={busy || !s}
              onClick={() => setConfirmOpen(true)}>
              {s?.processing_enabled ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? <Skeleton className="h-24 w-full" /> : status.error ? (
          <Alert variant="destructive"><AlertDescription>Couldn't load cleanup status.</AlertDescription></Alert>
        ) : s && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={s.processing_enabled ? 'default' : 'secondary'}>Processing {s.processing_enabled ? 'ON' : 'OFF'}</Badge>
              <Badge variant={s.schedule?.active ? 'default' : 'secondary'}>
                {s.schedule ? `Schedule ${s.schedule.active ? 'active' : 'inactive'} (${s.schedule.schedule})` : 'No schedule'}
              </Badge>
              <span className="text-muted-foreground">
                Last run: {last ? `${ago(last.started_at)} — ${last.ok ? Object.entries(last.report ?? {})
                  .filter(([k]) => ['claimed', 'deleted', 'retry', 'failed', 'stale'].includes(k))
                  .map(([k, v]) => `${k} ${v}`).join(', ') : 'error'}` : 'never'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {['queued', 'deleting', 'kept', 'failed', 'deleted'].map((k) => (
                <span key={k}><strong>{s.counts[k] ?? 0}</strong> {k}</span>
              ))}
              <span><strong>{s.retrying}</strong> retrying</span>
            </div>
            {(s.failed > 0 || s.stuck > 0 || s.overdue > 0) && (
              <Alert variant="destructive"><AlertDescription>
                {s.failed > 0 && `${s.failed} failed. `}
                {s.stuck > 0 && `${s.stuck} stuck deleting. `}
                {s.overdue > 0 && `${s.overdue} queued over 3 hours.`}
              </AlertDescription></Alert>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-1">
          {STATES.map((st) => (
            <Button key={st} size="sm" variant={filter === st ? 'secondary' : 'ghost'} onClick={() => setFilter(st)}>{st}</Button>
          ))}
        </div>
        {list.isLoading ? <Skeleton className="h-32 w-full" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Path</TableHead><TableHead>State</TableHead><TableHead>Attempts</TableHead>
              <TableHead>Last error</TableHead><TableHead>Updated</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(list.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nothing here.</TableCell></TableRow>
              ) : list.data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs max-w-[280px] truncate" title={c.path}>{c.path}</TableCell>
                  <TableCell><Badge variant={c.status === 'failed' ? 'destructive' : 'outline'}>{c.status}</Badge></TableCell>
                  <TableCell>{c.attempts}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={c.last_error ?? ''}>{c.last_error ?? '—'}</TableCell>
                  <TableCell className="text-xs">{ago(c.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s?.processing_enabled ? 'Pause photo cleanup?' : 'Resume photo cleanup?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {s?.processing_enabled
                ? 'Deletions stop before the next file. The queue keeps filling and nothing is lost.'
                : 'The worker will start deleting queued photos on its next run.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggle} disabled={busy}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
