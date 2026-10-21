import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Read-only dashboard + manual sweep/dry-run. No deletion, mode change, override or scheduling.
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export const NOT_INSTALLED = 'not_installed';
export function isNotInstalled(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? ''));
}
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw isNotInstalled(error) ? new Error(NOT_INSTALLED) : new Error(error.message || 'request failed');
  return data as T;
}

const STATUSES = ['pending_grace', 'eligible', 'rescued_referenced', 'protected_ambiguous', 'deleting', 'deleted',
  'reconciled_already_deleted', 'retryable_error', 'failed_manual'];
const PAGE = 25;
const ALL = '__all';

const ago = (t?: string | null) => (t ? formatDistanceToNow(new Date(t), { addSuffix: true }) : '—');
const copy = (v: string) => { navigator.clipboard?.writeText(v); toast.success('Copied'); };

type Run = { id: string; kind: string; status: string; batch_limit: number | null; worker_run_id: string | null;
  result: Record<string, unknown> | null; error_message: string | null; started_at: string; finished_at: string | null; stale: boolean };

function RunStatus({ run }: { run: Run }) {
  if (run.stale) return <Badge variant="destructive">Stale (no completion recorded)</Badge>;
  const v = run.status === 'succeeded' ? 'secondary' : run.status === 'failed' ? 'destructive' : 'outline';
  return <Badge variant={v as any}>{run.status}</Badge>;
}

function runSummary(run: Run) {
  if (run.status !== 'succeeded' || !run.result) return run.error_message ?? '';
  const r = run.result as any;
  if (run.kind === 'dry_run') {
    const evaluated = (r.would_delete ?? 0) + (r.rescued ?? 0) + (r.ambiguous ?? 0);
    return `Run completed: ${evaluated} evaluated · would delete ${r.would_delete ?? 0} · rescued ${r.rescued ?? 0} · ambiguous ${r.ambiguous ?? 0}`;
  }
  return `Run completed: ${r.protected_recorded ?? 0} unlinked uploads recorded as protected`;
}

function Json({ value }: { value: unknown }) {
  return <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
}

function ListSkeleton() {
  return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}

export function AdminMuxCleanupPanel() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['mux-cleanup', 'overview'], queryFn: () => call<any>('admin_mux_cleanup_overview'), retry: false });

  if (overview.error?.message === NOT_INSTALLED) {
    return (
      <Alert>
        <AlertTitle>Dashboard backend not installed yet</AlertTitle>
        <AlertDescription>
          The Mux Videos dashboard needs its database changes applied first. Nothing is broken; the video cleanup queue keeps running in dry-run mode as before.
        </AlertDescription>
      </Alert>
    );
  }
  const refreshAll = () => qc.invalidateQueries({ queryKey: ['mux-cleanup'] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Cleanup is in dry-run mode: nothing on this screen can delete a video.</p>
        <Button variant="outline" size="sm" onClick={refreshAll}><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>
      <LiveDeletionSwitch />
      <Overview data={overview.data} loading={overview.isLoading} error={overview.error?.message} onRan={refreshAll} />
      <Candidates />
      <Runs />
      <Observations />
    </div>
  );
}

function LiveDeletionSwitch() {
  const qc = useQueryClient();
  const [confirmOn, setConfirmOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ['mux-cleanup', 'live'],
    queryFn: () => call<{ live_enabled: boolean; updated_at: string | null }>('admin_get_mux_live_deletion'),
    retry: false,
  });
  const set = async (enabled: boolean) => {
    setBusy(true);
    try {
      await call('admin_set_mux_live_deletion', { p_enabled: enabled });
      toast.success(enabled ? 'Live deletion turned ON' : 'Live deletion turned OFF');
    } catch (e: any) { toast.error(`Couldn't change live deletion: ${e.message}`); }
    finally { setBusy(false); setConfirmOn(false); qc.invalidateQueries({ queryKey: ['mux-cleanup'] }); }
  };

  if (q.isLoading) return <Skeleton className="h-20 w-full" />;
  if (q.error || !q.data) return <Alert variant="destructive"><AlertTitle>Could not load live deletion state</AlertTitle><AlertDescription>{q.error?.message}</AlertDescription></Alert>;
  const on = q.data.live_enabled;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={on ? 'default' : 'secondary'}>{on ? 'ON' : 'OFF'}</Badge>
            <span className="font-medium">{on ? 'Live deletion ON — automatic cleanup active' : 'Live deletion OFF — deletions paused'}</span>
          </div>
          <p className="text-xs text-muted-foreground">Last changed {ago(q.data.updated_at)}</p>
        </div>
        <Switch checked={on} disabled={busy} aria-label="Live Mux deletion"
          onCheckedChange={(v) => (v ? setConfirmOn(true) : set(false))} />
      </CardContent>
      <AlertDialog open={confirmOn} onOpenChange={(o) => !o && setConfirmOn(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on live Mux deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              The hourly worker will permanently delete eligible, unreferenced Mux videos from Mux. This cannot be undone. Protected and referenced videos are never deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); set(true); }}>Turn ON</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Overview({ data, loading, error, onRan }: { data: any; loading: boolean; error?: string; onRan: () => void }) {
  const [confirm, setConfirm] = useState<null | 'sweep' | 'dry_run'>(null);
  const [busy, setBusy] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const run = async (kind: 'sweep' | 'dry_run') => {
    setBusy(true);
    try {
      const res = await call<any>(kind === 'sweep' ? 'admin_run_mux_sweep' : 'admin_run_mux_dry_run', kind === 'dry_run' ? { p_batch: 25 } : undefined);
      if (res?.ok) toast.success(kind === 'sweep' ? 'Sweep completed' : 'Dry run completed');
      else if (res?.error === 'run_already_in_progress') toast.error('Another run is already in progress');
      else toast.error(`Run failed${res?.sqlstate ? ` (${res.sqlstate})` : ''}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setConfirm(null); onRan(); }
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (error || !data) return <Alert variant="destructive"><AlertTitle>Could not load overview</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  const sched = data.schedule?.state as string;
  const schedLabel: Record<string, string> = { not_scheduled: 'Not scheduled', active: 'Scheduled (active)', inactive: 'Scheduled job inactive', scheduler_unavailable: 'Scheduler unavailable (could not check)' };
  const counts = data.counts ?? {};

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Mode</CardDescription><CardTitle className="text-xl">{data.mode}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Schedule: {schedLabel[sched] ?? sched}</div>
            {(data.schedule?.jobs ?? []).map((j: any) => <div key={j.jobname} className="text-xs">{j.jobname} · {j.schedule} · {j.active ? 'active' : 'inactive'}</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Queue</CardDescription><CardTitle className="text-xl">{data.total} candidates</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Due now: {data.due_now} · Active leases: {data.active_leases}</div>
            <div>Destructive claims: {data.destructive_claims} · Observations: {data.observations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Last runs</CardDescription></CardHeader>
          <CardContent className="text-sm space-y-2">
            {(['last_sweep', 'last_dry_run'] as const).map((k) => {
              const r = data[k] as Run | null;
              return (
                <div key={k}>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">{k === 'last_sweep' ? 'Sweep' : 'Dry run'}:</span>{r ? <><RunStatus run={r} /><span>{ago(r.started_at)}</span></> : <span>never</span>}</div>
                  {r && <div className="text-xs text-muted-foreground">{runSummary(r)}</div>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardDescription>Counts by status</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STATUSES.map((s) => <Badge key={s} variant="outline">{s}: {counts[s] ?? 0}</Badge>)}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => setConfirm('sweep')}>Run Sweeper</Button>
        <Button disabled={busy} variant="secondary" onClick={() => setConfirm('dry_run')}>Run Dry-Run (max 25)</Button>
        <Button variant="outline" onClick={() => setInventoryOpen(true)}>Live Mux inventory</Button>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'sweep' ? 'Run the sweeper?' : 'Run a dry run?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'sweep'
                ? 'Records old unlinked uploads as protected. It never makes anything eligible for deletion.'
                : 'Checks up to 25 due candidates and records what would happen. No video is deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); if (confirm) run(confirm); }}>Run</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InventoryDialog open={inventoryOpen} onOpenChange={setInventoryOpen} />
    </>
  );
}

function Candidates() {
  const [status, setStatus] = useState(ALL);
  const [sourceKind, setSourceKind] = useState(ALL);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const args = { p_status: status === ALL ? null : status, p_source_kind: sourceKind === ALL ? null : sourceKind,
    p_reason: reason.trim() || null, p_search: search.trim() || null, p_limit: PAGE, p_offset: page * PAGE };
  const q = useQuery({ queryKey: ['mux-cleanup', 'candidates', args], queryFn: () => call<any>('admin_list_mux_candidates', args), retry: false });
  const total = q.data?.total ?? 0;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Candidates</CardTitle><CardDescription>Videos in the cleanup queue. Click a row for details.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sourceKind} onValueChange={(v) => { setSourceKind(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>{[ALL, 'post', 'review', 'review_update', 'upload'].map((s) => <SelectItem key={s} value={s}>{s === ALL ? 'All sources' : s}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-56" placeholder="Reason (enqueue or protection)" value={reason} onChange={(e) => { setReason(e.target.value); setPage(0); }} />
          <Input className="w-64" placeholder="Search asset ID or upload record ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        {q.isLoading ? <ListSkeleton /> : q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Asset ID</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Reason</TableHead><TableHead>Eligible</TableHead><TableHead>Discovered</TableHead></TableRow></TableHeader>
              <TableBody>
                {(q.data?.rows ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No candidates match these filters.</TableCell></TableRow>}
                {(q.data?.rows ?? []).map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1">{r.mux_asset_id.slice(0, 14)}…
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copy(r.mux_asset_id); }}><Copy className="h-3 w-3" /></Button>
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge>{r.is_destructively_claimed && <Badge variant="destructive" className="ml-1">claimed</Badge>}</TableCell>
                    <TableCell>{r.source_kind}</TableCell>
                    <TableCell className="text-xs">{r.protection_reason ?? r.enqueue_reason}</TableCell>
                    <TableCell className="text-xs">{ago(r.eligible_at)}</TableCell>
                    <TableCell className="text-xs">{ago(r.discovered_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} total={total} setPage={setPage} />
          </>
        )}
      </CardContent>
      <CandidateDrawer id={openId} onClose={() => setOpenId(null)} />
    </Card>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} total · page {page + 1} of {pages}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function CandidateDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['mux-cleanup', 'candidate', id], queryFn: () => call<any>('admin_mux_candidate_detail', { p_id: id }), enabled: !!id, retry: false });
  const d = q.data;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>Candidate detail</SheetTitle><SheetDescription>Live reference check and recent history. No content text is shown.</SheetDescription></SheetHeader>
        {q.isLoading ? <div className="mt-4"><ListSkeleton /></div> : q.error ? <p className="mt-4 text-sm text-destructive">{q.error.message}</p> : !d ? <p className="mt-4 text-sm">Not found.</p> : (
          <div className="mt-4 space-y-4 text-sm">
            <section><h4 className="font-medium mb-1">Fields</h4><Json value={d.candidate} /></section>
            <section><h4 className="font-medium mb-1">Reference state now</h4><Json value={d.reference_state} /></section>
            <section>
              <h4 className="font-medium mb-1">Live references{d.references_truncated ? ' (first 50 shown)' : ''}</h4>
              {d.references.length === 0 ? <p className="text-muted-foreground">No saved content references this video.</p> : (
                <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Content ID</TableHead><TableHead>Active</TableHead><TableHead>Matched by</TableHead></TableRow></TableHeader>
                  <TableBody>{d.references.map((r: any, i: number) => (
                    <TableRow key={i}><TableCell>{r.content_type}</TableCell><TableCell className="font-mono text-xs">{r.content_id}</TableCell><TableCell>{r.active ? 'yes' : 'deleted'}</TableCell><TableCell>{r.match_method}</TableCell></TableRow>
                  ))}</TableBody></Table>
              )}
            </section>
            <section><h4 className="font-medium mb-1">History{d.audit_truncated ? ' (latest 50 shown)' : ''}</h4><AuditList rows={d.audit} /></section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AuditList({ rows }: { rows: any[] }) {
  if (!rows?.length) return <p className="text-muted-foreground text-sm">No history entries.</p>;
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <div key={a.id} className="rounded border p-2">
          <div className="flex items-center gap-2 text-xs"><Badge variant="outline">{a.action}</Badge><span>{a.mode}</span><span className="text-muted-foreground">{ago(a.created_at)}</span></div>
          {a.details && <Json value={a.details} />}
        </div>
      ))}
    </div>
  );
}

function Runs() {
  const q = useQuery({ queryKey: ['mux-cleanup', 'runs'], queryFn: () => call<Run[]>('admin_list_mux_cleanup_runs', { p_limit: 25 }), retry: false });
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Run history</CardTitle><CardDescription>Manual runs from this dashboard. Click a dry run to see exactly what it recorded.</CardDescription></CardHeader>
      <CardContent>
        {q.isLoading ? <ListSkeleton /> : q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No runs recorded yet.</TableCell></TableRow>}
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell>{r.kind}</TableCell><TableCell><RunStatus run={r} /></TableCell>
                  <TableCell className="text-xs">{ago(r.started_at)}</TableCell><TableCell className="text-xs">{runSummary(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RunDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </Card>
  );
}

function RunDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['mux-cleanup', 'run', id], queryFn: () => call<any>('admin_mux_cleanup_run_detail', { p_run_id: id }), enabled: !!id, retry: false });
  const d = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Run detail</DialogTitle><DialogDescription>{d?.run ? runSummary(d.run) : ''}</DialogDescription></DialogHeader>
        {q.isLoading ? <ListSkeleton /> : q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : !d ? <p className="text-sm">Not found.</p> : (
          <div className="space-y-3 text-sm">
            <Json value={d.run} />
            {d.run.kind === 'sweep'
              ? <p className="text-muted-foreground">Sweeps don't write per-candidate history entries.</p>
              : <><h4 className="font-medium">History entries{d.audit_truncated ? ' (latest 50 shown)' : ''}</h4><AuditList rows={d.audit} /></>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Observations() {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(0);
  const args = { p_kind: kind.trim() || null, p_limit: PAGE, p_offset: page * PAGE };
  const q = useQuery({ queryKey: ['mux-cleanup', 'observations', args], queryFn: () => call<any>('admin_list_mux_observations', args), retry: false });
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Observations</CardTitle><CardDescription>Things the cleanup system noticed but did not act on.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <Input className="w-64" placeholder="Filter by kind" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }} />
        {q.isLoading ? <ListSkeleton /> : q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Source</TableHead><TableHead>Asset / upload</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
              <TableBody>
                {(q.data?.rows ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No observations.</TableCell></TableRow>}
                {(q.data?.rows ?? []).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell><Badge variant="outline">{o.kind}</Badge></TableCell>
                    <TableCell className="text-xs">{o.source_kind ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{o.mux_asset_id ?? o.mux_upload_id ?? '—'}</TableCell>
                    <TableCell className="text-xs">{ago(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} total={q.data?.total ?? 0} setPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const q = useQuery({
    queryKey: ['mux-cleanup', 'inventory'], enabled: open, retry: false, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('mux-inventory', { method: 'GET' });
      if (error) throw new Error(error.message || 'inventory failed');
      return data as any;
    },
  });
  const d = q.data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Live Mux inventory</DialogTitle><DialogDescription>Read-only check of what exists in Mux right now compared with the app.</DialogDescription></DialogHeader>
        <div className="flex justify-end"><Button size="sm" variant="outline" disabled={q.isFetching} onClick={() => q.refetch()}><RefreshCw className="h-4 w-4" />Re-check</Button></div>
        {q.isLoading || q.isFetching ? <ListSkeleton /> : q.error ? <p className="text-sm text-destructive">{q.error.message}</p> : d && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={d.inventory_complete ? 'secondary' : 'destructive'}>{d.inventory_complete ? 'Complete scan' : 'Incomplete scan'}</Badge>
              <Badge variant="outline">{d.observations?.length ?? 0} assets</Badge>
              <Badge variant="outline">{d.upload_rows} upload records</Badge>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Asset ID</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {(d.observations ?? []).map((o: any, i: number) => {
                  const { asset_id, id, ...rest } = o;
                  return <TableRow key={i}><TableCell className="font-mono text-xs align-top">{asset_id ?? id}</TableCell><TableCell><Json value={rest} /></TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
            {(d.warnings ?? []).map((w: string) => <p key={w} className="text-xs text-muted-foreground">{w}</p>)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
