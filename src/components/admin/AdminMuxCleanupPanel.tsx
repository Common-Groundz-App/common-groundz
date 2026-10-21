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

// Read-only dashboard + manual sweep/dry-run diagnostics. Deletion itself is only
// ever performed by the hourly live worker; this screen can pause/resume it and
// trigger the same worker path manually ("Run now").
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
// Abnormal queue states: highlighted only when non-zero.
const ABNORMAL = new Set(['deleting', 'retryable_error', 'failed_manual']);
const PAGE = 25;
const ALL = '__all';

const ago = (t?: string | null) => (t ? formatDistanceToNow(new Date(t), { addSuffix: true }) : '—');
const copy = (v: string) => { navigator.clipboard?.writeText(v); toast.success('Copied'); };

type Run = { id: string; kind: string; status: string; batch_limit: number | null; worker_run_id: string | null;
  result: Record<string, unknown> | null; error_message: string | null; started_at: string; finished_at: string | null; stale: boolean };

type LiveRun = { id: string; worker_run_id: string; trigger_source: 'cron' | 'admin';
  status: 'running' | 'succeeded' | 'paused' | 'failed'; selected: number | null;
  results: unknown; error_category: string | null; started_at: string; finished_at: string | null; stale: boolean };

type LiveStatus = { live_enabled: boolean; live_updated_at: string | null; schedule: string; schedule_active: boolean;
  next_run_at: string | null; last_cron_run: LiveRun | null; last_run: LiveRun | null; overdue: boolean };

function RunStatus({ run }: { run: Run }) {
  if (run.stale) return <Badge variant="destructive">Stale (no completion recorded)</Badge>;
  const v = run.status === 'succeeded' ? 'secondary' : run.status === 'failed' ? 'destructive' : 'outline';
  return <Badge variant={v as any}>{run.status}</Badge>;
}

function LiveRunBadge({ run }: { run: LiveRun | null }) {
  if (!run) return <Badge variant="outline">never</Badge>;
  if (run.stale) return <Badge variant="destructive">Stale</Badge>;
  if (run.status === 'succeeded') return <Badge className="bg-primary text-primary-foreground">succeeded</Badge>;
  if (run.status === 'paused') return <Badge variant="secondary">paused</Badge>;
  if (run.status === 'failed') return <Badge variant="destructive">failed{run.error_category ? `: ${run.error_category}` : ''}</Badge>;
  return <Badge variant="outline">running</Badge>;
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

function liveRunSummary(run: LiveRun) {
  if (run.status === 'paused') return 'Ran with live deletion OFF — nothing was deleted.';
  if (run.status === 'failed') return `Failed${run.error_category ? ` (${run.error_category})` : ''}.`;
  if (run.status === 'running') return 'In progress…';
  return `Processed ${run.selected ?? 0} candidate(s).`;
}

function Json({ value }: { value: unknown }) {
  return <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
}

function ListSkeleton() {
  return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}

function useLiveStatus() {
  return useQuery({
    queryKey: ['mux-cleanup', 'live-status'],
    queryFn: () => call<LiveStatus>('admin_mux_live_status'),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function AdminMuxCleanupPanel() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['mux-cleanup', 'overview'], queryFn: () => call<any>('admin_mux_cleanup_overview'), retry: false });

  if (overview.error?.message === NOT_INSTALLED) {
    return (
      <Alert>
        <AlertTitle>Dashboard backend not installed yet</AlertTitle>
        <AlertDescription>
          The Mux Videos dashboard needs its database changes applied first. Nothing is broken; the video cleanup queue keeps running as before.
        </AlertDescription>
      </Alert>
    );
  }
  const refreshAll = () => qc.invalidateQueries({ queryKey: ['mux-cleanup'] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Automatic cleanup of unreferenced Mux videos. Every deletion keeps its safeguards: 24-hour grace, zero-reference check, protected history.
        </p>
        <Button variant="outline" size="sm" onClick={refreshAll}><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>
      <AutomaticCleanupPanel />
      <AutomationHealth overview={overview.data} />
      <Overview data={overview.data} loading={overview.isLoading} error={overview.error?.message} />
      <Diagnostics onRan={refreshAll} />
      <Candidates />
      <Runs />
      <Observations />
    </div>
  );
}

function AutomaticCleanupPanel() {
  const qc = useQueryClient();
  const [confirmOn, setConfirmOn] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useLiveStatus();
  const runs = useQuery({
    queryKey: ['mux-cleanup', 'live-runs'],
    queryFn: () => call<LiveRun[]>('admin_list_mux_live_runs', { p_limit: 5 }),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['mux-cleanup'] });

  const setLive = async (enabled: boolean) => {
    setBusy(true);
    try {
      await call('admin_set_mux_live_deletion', { p_enabled: enabled });
      toast.success(enabled ? 'Live deletion turned ON' : 'Live deletion turned OFF');
    } catch (e: any) { toast.error(`Couldn't change live deletion: ${e.message}`); }
    finally { setBusy(false); setConfirmOn(false); refresh(); }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('mux-cleanup-live', { method: 'POST' });
      if (error) throw new Error(error.message || 'worker call failed');
      if (data?.error) throw new Error(data.error);
      if (data?.paused) toast.success('Worker ran — live deletion is OFF, so nothing was deleted');
      else toast.success(`Worker ran: ${data?.selected ?? 0} candidate(s) processed`);
    } catch (e: any) { toast.error(`Run now failed: ${e.message}`); }
    finally { setBusy(false); setConfirmRun(false); refresh(); }
  };

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.error || !q.data) return <Alert variant="destructive"><AlertTitle>Could not load automatic cleanup state</AlertTitle><AlertDescription>{q.error?.message}</AlertDescription></Alert>;
  const d = q.data;
  const on = d.live_enabled;
  const healthy = on && d.schedule_active && !d.overdue && d.last_cron_run?.status === 'succeeded';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Automatic Mux cleanup
              {healthy && <Badge className="bg-primary text-primary-foreground">Healthy</Badge>}
              {d.overdue && <Badge variant="destructive">Overdue</Badge>}
            </CardTitle>
            <CardDescription>
              {on ? 'Live deletion ON — automatic cleanup active' : 'Live deletion OFF — deletions paused'}
              {d.live_updated_at ? ` · last changed ${ago(d.live_updated_at)}` : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmRun(true)}>Run now</Button>
            <Switch checked={on} disabled={busy} aria-label="Live Mux deletion"
              onCheckedChange={(v) => (v ? setConfirmOn(true) : setLive(false))} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {d.overdue && (
          <Alert variant="destructive">
            <AlertTitle>Hourly worker is overdue</AlertTitle>
            <AlertDescription>
              No schedule-started run has been recorded in the last 90 minutes. The schedule exists, but the worker may not be running — check the cron job and function logs.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Schedule</div>
            <div className="font-medium">{d.schedule_active ? `Hourly (${d.schedule})` : d.schedule === 'unavailable' ? 'Scheduler unavailable' : 'Not scheduled'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Next run</div>
            <div className="font-medium">{d.next_run_at ? ago(d.next_run_at) : '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Last automatic run</div>
            <div className="flex items-center gap-2">
              <LiveRunBadge run={d.last_cron_run} />
              {d.last_cron_run && <span className="font-medium">{ago(d.last_cron_run.started_at)}</span>}
            </div>
            {d.last_cron_run && <div className="text-xs text-muted-foreground mt-0.5">{liveRunSummary(d.last_cron_run)}</div>}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Recent worker runs</div>
          {runs.isLoading ? <ListSkeleton /> : (runs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No worker runs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Started by</TableHead><TableHead>Status</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
              <TableBody>
                {(runs.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{ago(r.started_at)}</TableCell>
                    <TableCell><Badge variant="outline">{r.trigger_source === 'cron' ? 'schedule' : 'admin'}</Badge></TableCell>
                    <TableCell><LiveRunBadge run={r} /></TableCell>
                    <TableCell className="text-xs">{liveRunSummary(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
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
              onClick={(e) => { e.preventDefault(); setLive(true); }}>Turn ON</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRun} onOpenChange={(o) => !o && setConfirmRun(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run the cleanup worker now?</AlertDialogTitle>
            <AlertDialogDescription>
              This runs the exact same worker the hourly schedule runs. If live deletion is ON, eligible unreferenced videos will be permanently deleted. If it is OFF, the run is recorded as paused and deletes nothing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); runNow(); }}>Run now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AutomationHealth({ overview }: { overview: any }) {
  const live = useLiveStatus();
  const cron = live.data?.last_cron_run ?? null;
  const rows: { label: string; cadence: string; badge: React.ReactNode; when: string; detail: string }[] = [
    {
      label: 'Live worker', cadence: 'hourly · automatic',
      badge: live.isLoading ? <Skeleton className="h-5 w-16" /> : <LiveRunBadge run={cron} />,
      when: cron ? ago(cron.started_at) : 'never',
      detail: cron ? liveRunSummary(cron) : 'No automatic run recorded yet.',
    },
    ...(['last_sweep', 'last_dry_run'] as const).map((k) => {
      const r = overview?.[k] as Run | null;
      return {
        label: k === 'last_sweep' ? 'Sweeper' : 'Dry run', cadence: 'manual · diagnostic',
        badge: r ? <RunStatus run={r} /> : <Badge variant="outline">never</Badge>,
        when: r ? ago(r.started_at) : 'never',
        detail: r ? runSummary(r) : '',
      };
    }),
  ];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Automation health</CardTitle>
        <CardDescription>The hourly live worker first, then the manual diagnostics.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 font-medium">{r.label}</span>
            <span className="text-xs text-muted-foreground w-32">{r.cadence}</span>
            {r.badge}
            <span className="text-xs text-muted-foreground">{r.when}</span>
            {r.detail && <span className="text-xs text-muted-foreground">· {r.detail}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Overview({ data, loading, error }: { data: any; loading: boolean; error?: string }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (error || !data) return <Alert variant="destructive"><AlertTitle>Could not load overview</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  const counts = data.counts ?? {};

  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardDescription>Queue</CardDescription><CardTitle className="text-xl">{data.total} candidates</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>Due now: {data.due_now} · Active leases: {data.active_leases}</div>
          <div>Destructive claims: {data.destructive_claims} · Observations: {data.observations}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardDescription>Counts by status</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const n = counts[s] ?? 0;
            const abnormal = ABNORMAL.has(s) && n > 0;
            return <Badge key={s} variant={abnormal ? 'destructive' : 'outline'}>{s}: {n}</Badge>;
          })}
        </CardContent>
      </Card>
    </>
  );
}

function Diagnostics({ onRan }: { onRan: () => void }) {
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Diagnostics</CardTitle>
        <CardDescription>Manual investigation tools. Not needed for normal hourly cleanup — the automatic worker runs on its own.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button disabled={busy} variant="outline" onClick={() => setConfirm('sweep')}>Run Sweeper</Button>
        <Button disabled={busy} variant="outline" onClick={() => setConfirm('dry_run')}>Run Dry-Run (max 25)</Button>
        <Button variant="outline" onClick={() => setInventoryOpen(true)}>Live Mux inventory</Button>
      </CardContent>

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
    </Card>
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
      <CardHeader><CardTitle className="text-lg">Diagnostic run history</CardTitle><CardDescription>Manual sweep and dry-run runs from this dashboard. Click a dry run to see exactly what it recorded.</CardDescription></CardHeader>
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
