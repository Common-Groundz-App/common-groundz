import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  HardDrive,
  Loader2,
  Play,
  Trash2,
  TrendingUp,
} from 'lucide-react';

interface CleanupRun {
  id: string;
  mode: string;
  scanned: number;
  would_delete: number;
  deleted: number;
  skipped_young: number;
  skipped_referenced: number;
  referenced_path_count: number;
  max_deletions: number | null;
  errors: any;
  sample_deleted: string[] | null;
  started_at: string;
  finished_at: string | null;
  took_ms: number | null;
}

const STALE_AMBER_DAYS = 7;
const STALE_RED_DAYS = 10;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function statusFromWouldDelete(n: number | null | undefined) {
  if (n == null) return { label: 'Unknown', tone: 'muted' as const };
  if (n === 0) return { label: 'Healthy', tone: 'success' as const };
  if (n <= 50) return { label: 'Needs review', tone: 'warning' as const };
  if (n <= 200) return { label: 'Warning', tone: 'warning' as const };
  return { label: 'Danger', tone: 'danger' as const };
}

function staleness(d: number | null) {
  if (d == null) return { label: 'No data', tone: 'muted' as const };
  if (d < STALE_AMBER_DAYS) return { label: `${Math.round(d)}d ago`, tone: 'success' as const };
  if (d < STALE_RED_DAYS) return { label: `${Math.round(d)}d ago — overdue`, tone: 'warning' as const };
  return { label: `${Math.round(d)}d ago — stale`, tone: 'danger' as const };
}

function toneClass(tone: 'success' | 'warning' | 'danger' | 'muted') {
  switch (tone) {
    case 'success':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    case 'warning':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'danger':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
);

const RunRow: React.FC<{ run: CleanupRun }> = ({ run }) => {
  const [open, setOpen] = useState(false);
  const errors = Array.isArray(run.errors) ? run.errors : [];
  const samples = Array.isArray(run.sample_deleted) ? run.sample_deleted : [];
  const sampleLabel = run.mode === 'execute' ? 'Sample deleted paths' : 'Sample orphan paths';
  const hasDetails = samples.length > 0 || errors.length > 0;

  return (
    <>
      <TableRow
        className={hasDetails ? 'cursor-pointer' : ''}
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <TableCell className="whitespace-nowrap">
          {hasDetails ? (
            open ? <ChevronDown className="inline h-3 w-3 mr-1" /> : <ChevronRight className="inline h-3 w-3 mr-1" />
          ) : (
            <span className="inline-block w-4" />
          )}
          <span className="text-sm">{format(new Date(run.started_at), 'MMM d, HH:mm')}</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={run.mode === 'execute' ? toneClass('warning') : toneClass('muted')}>
            {run.mode}
          </Badge>
        </TableCell>
        <TableCell className="tabular-nums text-right">{run.scanned}</TableCell>
        <TableCell className="tabular-nums text-right">{run.would_delete}</TableCell>
        <TableCell className="tabular-nums text-right">{run.deleted}</TableCell>
        <TableCell className="tabular-nums text-right">{run.skipped_young}</TableCell>
        <TableCell className="tabular-nums text-right">{run.skipped_referenced}</TableCell>
        <TableCell className="tabular-nums text-right">
          {errors.length > 0 ? (
            <span className="text-destructive font-semibold">{errors.length}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </TableCell>
        <TableCell className="tabular-nums text-right text-muted-foreground">
          {run.took_ms != null ? `${run.took_ms}ms` : '—'}
        </TableCell>
      </TableRow>
      {open && hasDetails && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30">
            <div className="space-y-3 py-2">
              {samples.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    {sampleLabel} ({samples.length})
                  </p>
                  <ul className="text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto">
                    {samples.map((p, i) => (
                      <li key={i} className="break-all text-muted-foreground">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">
                    Errors
                  </p>
                  <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto">
                    {JSON.stringify(errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export const AdminMediaCleanupPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownTick, setCooldownTick] = useState(0);

  // Execute (destructive) state
  const [executeOpen, setExecuteOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeCooldownUntil, setExecuteCooldownUntil] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [maxDeletionsInput, setMaxDeletionsInput] = useState<number>(50);

  useEffect(() => {
    if (!cooldownUntil && !executeCooldownUntil) return;
    const id = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil, executeCooldownUntil]);

  const cooldownRemaining = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    : 0;
  const executeCooldownRemaining = executeCooldownUntil
    ? Math.max(0, Math.ceil((executeCooldownUntil - Date.now()) / 1000))
    : 0;
  // referenced so eslint doesn't complain about unused tick
  void cooldownTick;

  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['admin-media-cleanup-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_cleanup_runs')
        .select(
          'id,mode,scanned,would_delete,deleted,skipped_young,skipped_referenced,referenced_path_count,max_deletions,errors,sample_deleted,started_at,finished_at,took_ms'
        )
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as CleanupRun[];
    },
    refetchOnWindowFocus: false,
  });

  const handleRunDryRun = async () => {
    if (isTriggering || cooldownRemaining > 0) return;
    setIsTriggering(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'admin-media-cleanup-trigger',
        { method: 'POST' }
      );
      if (invokeErr) throw invokeErr;

      const result = (data?.result ?? {}) as {
        wouldDelete?: number;
        scanned?: number;
      };
      const auditWritten = !!data?.auditWritten;
      const wouldDelete = typeof result.wouldDelete === 'number' ? result.wouldDelete : null;

      if (!auditWritten) {
        toast.warning('Scan completed but audit row was not written — check edge function logs.');
      } else if (wouldDelete === 0) {
        toast.success('Dry-run complete — 0 orphan files found');
      } else if (wouldDelete != null) {
        toast.success(`Dry-run complete — ${wouldDelete} orphan files need review`);
      } else {
        toast.success('Dry-run complete');
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-media-cleanup-runs'] });
      setCooldownUntil(Date.now() + 30_000);
    } catch (e) {
      const msg = (e as Error)?.message || 'Failed to trigger dry-run';
      toast.error(msg);
    } finally {
      setIsTriggering(false);
    }
  };


  const latestDryRun = useMemo(
    () => runs?.find((r) => r.mode === 'dry-run'),
    [runs]
  );
  const latestExecute = useMemo(
    () => runs?.find((r) => r.mode === 'execute'),
    [runs]
  );

  const dryRunHistory = useMemo(
    () =>
      (runs ?? [])
        .filter((r) => r.mode === 'dry-run')
        .slice(0, 8)
        .reverse()
        .map((r) => ({
          date: format(new Date(r.started_at), 'MMM d'),
          wouldDelete: r.would_delete,
        })),
    [runs]
  );

  const status = statusFromWouldDelete(latestDryRun?.would_delete);
  const stale = staleness(daysSince(latestDryRun?.started_at));
  const latestErrors =
    latestDryRun && Array.isArray(latestDryRun.errors) && latestDryRun.errors.length > 0
      ? latestDryRun.errors
      : latestExecute && Array.isArray(latestExecute.errors) && latestExecute.errors.length > 0
        ? latestExecute.errors
        : null;

  // Execute button gating
  const dryRunAgeHours = latestDryRun
    ? (Date.now() - new Date(latestDryRun.started_at).getTime()) / (1000 * 60 * 60)
    : null;
  const dryRunWouldDelete = latestDryRun?.would_delete ?? 0;
  const dryRunSamples = Array.isArray(latestDryRun?.sample_deleted)
    ? (latestDryRun!.sample_deleted as string[])
    : [];

  let executeDisabledReason: string | null = null;
  if (!latestDryRun) executeDisabledReason = 'Run a dry-run first';
  else if (dryRunAgeHours != null && dryRunAgeHours > 24)
    executeDisabledReason = 'Latest dry-run is stale — run a fresh one';
  else if (dryRunWouldDelete <= 0) executeDisabledReason = 'Nothing to clean up';

  const canExecute = executeDisabledReason === null;
  const defaultMaxDeletions = Math.min(50, Math.max(1, dryRunWouldDelete || 1));

  const openExecuteDialog = () => {
    setMaxDeletionsInput(defaultMaxDeletions);
    setConfirmText('');
    setExecuteOpen(true);
  };

  const handleRunExecute = async () => {
    if (isExecuting || executeCooldownRemaining > 0) return;
    const clamped = Math.min(50, Math.max(1, Math.floor(maxDeletionsInput || 0)));
    setIsExecuting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'admin-media-cleanup-execute-trigger',
        { body: { confirm: 'DELETE', maxDeletions: clamped } }
      );
      if (invokeErr) {
        // FunctionsHttpError carries response context; try to surface preflight code
        const ctx: any = (invokeErr as any)?.context;
        let detail: any = null;
        try {
          detail = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
        } catch {
          detail = null;
        }
        const code = detail?.code as string | undefined;
        const codeMessages: Record<string, string> = {
          NO_DRY_RUN: 'Run a dry-run first',
          STALE_DRY_RUN: 'Latest dry-run is stale — run a fresh one',
          NOTHING_TO_DELETE: 'Nothing to clean up',
          DRY_RUN_DRIFT: 'Orphan count drifted — re-run dry-run',
          NOT_ADMIN: 'Not authorized',
          MISSING_AUTH: 'Not authorized',
          INVALID_TOKEN: 'Not authorized',
          MISSING_CONFIRM: 'Confirmation missing',
          INVALID_MAX_DELETIONS: 'Invalid max deletions value',
        };
        toast.error(code ? codeMessages[code] ?? `Cleanup failed (${code})` : invokeErr.message);
        return;
      }

      const result = (data?.result ?? {}) as {
        deleted?: number;
        errors?: unknown[];
      };
      const deleted = typeof result.deleted === 'number' ? result.deleted : 0;
      const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
      const auditWritten = !!data?.auditWritten;

      if (errCount > 0) {
        toast.warning(`Deleted ${deleted}, ${errCount} errors — see Recent runs`);
      } else {
        toast.success(`Deleted ${deleted} files`);
      }
      if (!auditWritten) {
        toast.warning('Cleanup ran but audit row not found — check edge function logs');
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-media-cleanup-runs'] });
      setExecuteOpen(false);
      setExecuteCooldownUntil(Date.now() + 60_000);
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to run cleanup');
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load cleanup history</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Orphan Media Cleanup
              </CardTitle>
              <CardDescription className="mt-1">
                Read-only monitoring. Bucket: <span className="font-mono">post_media</span>. Weekly dry-run cron — manual execute only.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={toneClass(status.tone)}>
                {status.label}
              </Badge>
              <Badge variant="outline" className={toneClass(stale.tone)}>
                <Clock className="h-3 w-3 mr-1" />
                Last dry-run: {stale.label}
              </Badge>
              <Button
                size="sm"
                onClick={handleRunDryRun}
                disabled={isTriggering || isLoading || cooldownRemaining > 0}
              >
                {isTriggering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Scanning…
                  </>
                ) : cooldownRemaining > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-1" />
                    Wait {cooldownRemaining}s
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Run dry-run now
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={openExecuteDialog}
                disabled={!canExecute || isExecuting || executeCooldownRemaining > 0}
                title={executeDisabledReason ?? undefined}
              >
                {executeCooldownRemaining > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-1" />
                    Wait {executeCooldownRemaining}s
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Run cleanup now
                    {canExecute && dryRunWouldDelete > 0 ? ` (${dryRunWouldDelete})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Scheduled: weekly dry-run · Sundays 03:00 UTC
          </p>
          <p>
            Staleness thresholds: green &lt; {STALE_AMBER_DAYS}d · amber {STALE_AMBER_DAYS}–{STALE_RED_DAYS}d · red &gt; {STALE_RED_DAYS}d.
          </p>
          {executeDisabledReason && (
            <p className="text-xs italic">Cleanup disabled: {executeDisabledReason}.</p>
          )}
        </CardContent>
      </Card>

      {/* Top-level errors callout */}
      {latestErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errors in latest run</AlertTitle>
          <AlertDescription>
            <pre className="text-xs mt-2 overflow-x-auto">
              {JSON.stringify(latestErrors, null, 2)}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Latest dry-run */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Latest dry-run
            </CardTitle>
            {latestDryRun && (
              <CardDescription>
                {formatDistanceToNow(new Date(latestDryRun.started_at), { addSuffix: true })} ·{' '}
                {format(new Date(latestDryRun.started_at), 'PPp')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {latestDryRun ? (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Scanned" value={latestDryRun.scanned} />
                <Stat label="Would delete" value={latestDryRun.would_delete} />
                <Stat label="Skipped (young)" value={latestDryRun.skipped_young} />
                <Stat label="Skipped (referenced)" value={latestDryRun.skipped_referenced} />
                <Stat label="Referenced paths" value={latestDryRun.referenced_path_count} />
                <Stat label="Took" value={latestDryRun.took_ms != null ? `${latestDryRun.took_ms}ms` : '—'} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No dry-run history yet — next scheduled run will populate this.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Latest execute */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Latest execute
            </CardTitle>
            {latestExecute && (
              <CardDescription>
                {formatDistanceToNow(new Date(latestExecute.started_at), { addSuffix: true })} ·{' '}
                {format(new Date(latestExecute.started_at), 'PPp')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {latestExecute ? (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Deleted" value={latestExecute.deleted} />
                <Stat
                  label="Errors"
                  value={
                    Array.isArray(latestExecute.errors) ? latestExecute.errors.length : 0
                  }
                />
                <Stat label="Max deletions" value={latestExecute.max_deletions ?? '—'} />
                <Stat label="Took" value={latestExecute.took_ms != null ? `${latestExecute.took_ms}ms` : '—'} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No execute runs yet — execute is manual-only and triggered via the SQL editor.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend sparkline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Would-delete trend
          </CardTitle>
          <CardDescription>Last {dryRunHistory.length || 0} dry-runs</CardDescription>
        </CardHeader>
        <CardContent>
          {dryRunHistory.length >= 2 ? (
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dryRunHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <YAxis hide domain={[0, 'dataMax + 5']} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wouldDelete"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Need at least 2 dry-runs to plot a trend.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent runs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
          <CardDescription>
            Last {runs?.length ?? 0} entries. Click a row to expand sample paths or errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!runs || runs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              No runs recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Scanned</TableHead>
                    <TableHead className="text-right">Would delete</TableHead>
                    <TableHead className="text-right">Deleted</TableHead>
                    <TableHead className="text-right">Skipped young</TableHead>
                    <TableHead className="text-right">Skipped ref</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Took</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <RunRow key={r.id} run={r} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Destructive cleanup confirmation */}
      <AlertDialog open={executeOpen} onOpenChange={(o) => !isExecuting && setExecuteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Permanently delete orphan media?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Bucket: <span className="font-mono">post_media</span>. This deletes objects from
                  storage. There is no undo.
                </p>
                {latestDryRun && (
                  <p>
                    Based on dry-run from{' '}
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(latestDryRun.started_at), { addSuffix: true })}
                    </span>{' '}
                    · would delete <span className="font-semibold">{dryRunWouldDelete}</span> files.
                  </p>
                )}
                {dryRunSamples.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Sample orphan paths
                    </p>
                    <ul className="text-xs font-mono space-y-0.5 max-h-28 overflow-y-auto bg-muted/40 rounded p-2">
                      {dryRunSamples.slice(0, 5).map((p, i) => (
                        <li key={i} className="break-all text-foreground/80">{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="max-deletions">Max files to delete this run</Label>
              <Input
                id="max-deletions"
                type="number"
                min={1}
                max={50}
                value={maxDeletionsInput}
                onChange={(e) => setMaxDeletionsInput(Number(e.target.value))}
                disabled={isExecuting}
              />
              <p className="text-xs text-muted-foreground">Hard cap: 50 per run.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-semibold">DELETE</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={isExecuting}
                autoComplete="off"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRunExecute();
              }}
              disabled={
                isExecuting ||
                confirmText !== 'DELETE' ||
                !Number.isFinite(maxDeletionsInput) ||
                maxDeletionsInput < 1
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Deleting…
                </>
              ) : (
                `Permanently delete ${Math.min(50, Math.max(1, Math.floor(maxDeletionsInput || 0)))} files`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminMediaCleanupPanel;
