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

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemaining = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Staleness thresholds: green &lt; {STALE_AMBER_DAYS}d · amber {STALE_AMBER_DAYS}–{STALE_RED_DAYS}d · red &gt; {STALE_RED_DAYS}d.
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
    </div>
  );
};

export default AdminMediaCleanupPanel;
