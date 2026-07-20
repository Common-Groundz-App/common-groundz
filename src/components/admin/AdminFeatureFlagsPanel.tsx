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
  | { key: 'mux.prewarm_enabled'; nextEnabled: boolean }
  | { key: 'entity_extraction.version'; nextVersion: 'v1' | 'v2' }
  // Plan v10 — pipeline switcher: Legacy auto-create vs. Draft Review.
  | { key: 'entity_extraction.review_uses_draft'; nextEnabled: boolean }
  | { key: 'entity_creation.non_admin_enabled'; nextEnabled: boolean }
  | { key: 'search_to_draft.non_admin_enabled'; nextEnabled: boolean }
  | { key: 'entity_extraction.search_image_firecrawl_enabled'; nextEnabled: boolean }
  | { key: 'entity_extraction.search_image_cse_fallback_enabled'; nextEnabled: boolean }
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
  const prewarmRow = rows.data?.find((r) => r.key === 'mux.prewarm_enabled');

  const uploadsEnabled = uploadsRow?.value?.enabled ?? true;
  const muxMode: 'live' | 'test' = modeRow?.value?.mode === 'test' ? 'test' : 'live';
  const prewarmEnabled = prewarmRow?.value?.enabled ?? true;

  const effective = publicFlags.data?.mux;

  const extractionRow = rows.data?.find((r) => r.key === 'entity_extraction.version');
  const extractionVersion: 'v1' | 'v2' =
    extractionRow?.value?.version === 'v2' ? 'v2' : 'v1';

  const reviewDraftRow = rows.data?.find((r) => r.key === 'entity_extraction.review_uses_draft');
  const reviewDraftEnabled: boolean = reviewDraftRow?.value?.enabled === true;

  // Phase 3.4E — Non-admin entity creation kill-switch. Default OFF.
  const nonAdminEntityRow = rows.data?.find((r) => r.key === 'entity_creation.non_admin_enabled');
  const nonAdminEntityEnabled: boolean = nonAdminEntityRow?.value?.enabled === true;

  // Phase 3.5a — Search-to-Draft non-admin gate. Default OFF.
  const searchToDraftRow = rows.data?.find((r) => r.key === 'search_to_draft.non_admin_enabled');
  const searchToDraftEnabled: boolean = searchToDraftRow?.value?.enabled === true;

  // v8b — Firecrawl fallback for search-image enrichment. Default OFF.
  const firecrawlImgRow = rows.data?.find(
    (r) => r.key === 'entity_extraction.search_image_firecrawl_enabled',
  );
  const firecrawlImgEnabled: boolean = firecrawlImgRow?.value?.enabled === true;

  // v8c — Google CSE image fallback for Vertex rows. Default OFF.
  const cseImgRow = rows.data?.find(
    (r) => r.key === 'entity_extraction.search_image_cse_fallback_enabled',
  );
  const cseImgEnabled: boolean = cseImgRow?.value?.enabled === true;

  const confirmTitle =
    pending?.key === 'mux.uploads_enabled'
      ? pending.nextEnabled
        ? 'Enable Mux video uploads?'
        : 'Disable Mux video uploads?'
      : pending?.key === 'mux.mode'
        ? pending.nextMode === 'test'
          ? 'Switch Mux to Test mode?'
          : 'Switch Mux to Live mode?'
        : pending?.key === 'mux.prewarm_enabled'
          ? pending.nextEnabled
            ? 'Enable HLS prewarm on tap?'
            : 'Disable HLS prewarm on tap?'
          : pending?.key === 'entity_extraction.version'
            ? pending.nextVersion === 'v2'
              ? 'Switch entity URL extraction to Version 2 (Experimental)?'
              : 'Switch entity URL extraction to Version 1 (Stable)?'
            : pending?.key === 'entity_extraction.review_uses_draft'
              ? pending.nextEnabled
                ? 'Switch to Draft Review pipeline?'
                : 'Switch back to Legacy auto-create pipeline?'
              : pending?.key === 'entity_creation.non_admin_enabled'
                ? pending.nextEnabled
                  ? 'Enable non-admin entity creation?'
                  : 'Disable non-admin entity creation?'
                : pending?.key === 'search_to_draft.non_admin_enabled'
                  ? pending.nextEnabled
                    ? 'Enable Search-to-draft for non-admins?'
                    : 'Disable Search-to-draft for non-admins?'
                  : pending?.key === 'entity_extraction.search_image_firecrawl_enabled'
                    ? pending.nextEnabled
                      ? 'Enable Firecrawl fallback for search-result images?'
                      : 'Disable Firecrawl fallback for search-result images?'
                    : pending?.key === 'entity_extraction.search_image_cse_fallback_enabled'
                      ? pending.nextEnabled
                        ? 'Enable Google image search fallback for Vertex rows?'
                        : 'Disable Google image search fallback for Vertex rows?'
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
        : pending?.key === 'mux.prewarm_enabled'
          ? pending.nextEnabled
            ? 'Video taps will prefetch the HLS manifest and first segment again. Does NOT affect Mux uploads or video playback — only the on-tap prefetch optimization.'
            : 'Video taps will stop prefetching HLS manifests/segments. Does NOT affect Mux uploads or video playback — only the on-tap prefetch optimization.'
          : pending?.key === 'entity_extraction.version'
            ? pending.nextVersion === 'v2'
              ? 'The Analyze URL button in Create Entity will route to the experimental analyze-entity-url-v2 function. This is admin-only and may be unstable.'
              : 'The Analyze URL button in Create Entity will route to the stable analyze-entity-url function (current default behavior).'
            : pending?.key === 'entity_extraction.review_uses_draft'
              ? pending.nextEnabled
                ? 'Analyze will return a draft only. No brand or entity rows are written until the admin explicitly confirms in the two-stage review UI. Use this for safe testing and side-by-side comparison.'
                : 'Analyze will auto-create the parent brand and prefill the form in one step (legacy behavior). No draft review.'
              : pending?.key === 'entity_creation.non_admin_enabled'
                ? pending.nextEnabled
                  ? 'Signed-in non-admins can create entities via the V2 Draft Review flow. New entities are pending (limited to 10 per user per 24h) until an admin approves them.'
                  : 'Only admins can create entities. Any non-admin call to the atomic RPC or gated edge functions will be rejected.'
                : pending?.key === 'search_to_draft.non_admin_enabled'
                  ? pending.nextEnabled
                    ? 'Non-admin users will see the Search tab in Create Entity, powered by Gemini grounded search. Requires non-admin entity creation to also be enabled.'
                    : 'Only admins will see the Search tab in Create Entity. The search-entity-candidates edge function will reject non-admin calls.'
                  : pending?.key === 'entity_extraction.search_image_firecrawl_enabled'
                    ? pending.nextEnabled
                      ? 'When a search result has no image after direct fetch and soft-redirect, enrich-candidate-image will use Firecrawl as a last-resort fallback (extra ~2 s budget). Search-to-Draft only — URL Analysis is unaffected. May consume Firecrawl credits.'
                      : 'Disables the Firecrawl fallback in enrich-candidate-image. Results missing an image after direct fetch/soft-redirect will show no image, as before.'
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
      } else if (pending.key === 'mux.mode') {
        await setFlag.mutateAsync({
          key: 'mux.mode',
          value: { mode: pending.nextMode },
          reason: reason.trim() || undefined,
        });
      } else if (pending.key === 'mux.prewarm_enabled') {
        await setFlag.mutateAsync({
          key: 'mux.prewarm_enabled',
          value: { enabled: pending.nextEnabled },
          reason: reason.trim() || undefined,
        });
      } else if (pending.key === 'entity_extraction.version') {
        await setFlag.mutateAsync({
          key: 'entity_extraction.version',
          value: { version: pending.nextVersion },
          reason: reason.trim() || undefined,
        });
      } else if (pending.key === 'entity_extraction.review_uses_draft') {
        await setFlag.mutateAsync({
          key: 'entity_extraction.review_uses_draft',
          value: { enabled: pending.nextEnabled },
          reason: reason.trim() || undefined,
        });
      } else if (pending.key === 'entity_creation.non_admin_enabled') {
        await setFlag.mutateAsync({
          key: 'entity_creation.non_admin_enabled',
          value: { enabled: pending.nextEnabled },
          reason: reason.trim() || undefined,
        });
      } else if (pending.key === 'search_to_draft.non_admin_enabled') {
        await setFlag.mutateAsync({
          key: 'search_to_draft.non_admin_enabled',
          value: { enabled: pending.nextEnabled },
          reason: reason.trim() || undefined,
        });
      } else {
        await setFlag.mutateAsync({
          key: 'entity_extraction.search_image_firecrawl_enabled',
          value: { enabled: pending.nextEnabled },
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
                <span>
                  HLS prewarm:{' '}
                  <span className={effective.prewarm_enabled ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                    {effective.prewarm_enabled ? 'Enabled' : 'Disabled'}
                  </span>
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

          {/* HLS prewarm switch */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="mux-prewarm" className="text-base">
                HLS prewarm on tap
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, tapping a video prefetches its HLS manifest and first segment for faster playback start. Does NOT affect Mux uploads or video playback — only the on-tap prefetch optimization.
              </p>
              {prewarmRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(prewarmRow.updated_at), { addSuffix: true })}
                  {prewarmRow.updated_reason ? ` — “${prewarmRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <Switch
              id="mux-prewarm"
              checked={prewarmEnabled}
              disabled={rows.isLoading || setFlag.isPending}
              onCheckedChange={(checked) =>
                setPending({ key: 'mux.prewarm_enabled', nextEnabled: checked })
              }
            />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity URL extraction engine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Entity URL extraction engine
          </CardTitle>
          <CardDescription>
            Which engine the Create Entity dialog's “Analyze URL” button calls. Admin-only.
            Affects only the Create Entity dialog's Analyze URL button for admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium mb-1">Currently selected</p>
            {rows.isLoading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <span className="font-medium">
                {extractionVersion === 'v2'
                  ? 'Version 2 — Experimental'
                  : 'Version 1 — Stable'}
              </span>
            )}
            {extractionRow?.updated_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {formatDistanceToNow(new Date(extractionRow.updated_at), { addSuffix: true })}
                {extractionRow.updated_reason ? ` — “${extractionRow.updated_reason}”` : ''}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={rows.isLoading || setFlag.isPending}
              onClick={() =>
                extractionVersion !== 'v1' &&
                setPending({ key: 'entity_extraction.version', nextVersion: 'v1' })
              }
              className={`text-left rounded-lg border p-4 transition-colors ${
                extractionVersion === 'v1'
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
            >
              <p className="font-medium">Version 1 — Stable</p>
              <p className="text-xs text-muted-foreground mt-1">
                Current production engine. Calls <code>analyze-entity-url</code>.
              </p>
            </button>
            <button
              type="button"
              disabled={rows.isLoading || setFlag.isPending}
              onClick={() =>
                extractionVersion !== 'v2' &&
                setPending({ key: 'entity_extraction.version', nextVersion: 'v2' })
              }
              className={`text-left rounded-lg border p-4 transition-colors ${
                extractionVersion === 'v2'
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
            >
              <p className="font-medium">Version 2 — Experimental</p>
              <p className="text-xs text-muted-foreground mt-1">
                Calls <code>analyze-entity-url-v2</code>. Currently a scaffold and returns no AI prefill yet.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>



      {/* Plan v10 — Entity creation pipeline switcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Entity creation pipeline
          </CardTitle>
          <CardDescription>
            Controls how the Create Entity dialog behaves after Analyze. Switching here
            replaces the SQL toggle for <code>entity_extraction.review_uses_draft</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium mb-1">Currently selected</p>
            {rows.isLoading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <span className="font-medium">
                {reviewDraftEnabled
                  ? 'Draft Review — brand created only after confirmation'
                  : 'Legacy — auto-create brand during Analyze'}
              </span>
            )}
            {reviewDraftRow?.updated_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {formatDistanceToNow(new Date(reviewDraftRow.updated_at), { addSuffix: true })}
                {reviewDraftRow.updated_reason ? ` — “${reviewDraftRow.updated_reason}”` : ''}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Affects: Create Entity dialog (admin), Analyze URL button. Does not change
              entity visibility or moderation rules.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={rows.isLoading || setFlag.isPending}
              onClick={() =>
                reviewDraftEnabled &&
                setPending({ key: 'entity_extraction.review_uses_draft', nextEnabled: false })
              }
              className={`text-left rounded-lg border p-4 transition-colors ${
                !reviewDraftEnabled ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <p className="font-medium">Legacy — auto-create brand</p>
              <p className="text-xs text-muted-foreground mt-1">
                Analyze writes the brand immediately and prefills the form. Original behavior.
              </p>
            </button>
            <button
              type="button"
              disabled={rows.isLoading || setFlag.isPending}
              onClick={() =>
                !reviewDraftEnabled &&
                setPending({ key: 'entity_extraction.review_uses_draft', nextEnabled: true })
              }
              className={`text-left rounded-lg border p-4 transition-colors ${
                reviewDraftEnabled ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <p className="font-medium">Draft Review — confirm before write</p>
              <p className="text-xs text-muted-foreground mt-1">
                Analyze returns a draft only. Admin confirms the brand and entity in two stages.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Phase 3.4E — Non-admin entity creation kill-switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Non-admin entity creation
          </CardTitle>
          <CardDescription>
            Lets signed-in users create entities through the V2 Draft Review flow.
            Non-admin-created entities are pending and limited to 10 new entities per day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="non-admin-entity" className="text-base">
                Allow non-admin entity creation
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, signed-in non-admins can submit entities via the V2 Draft Review
                flow. Submissions land as <code>pending</code> until an admin approves them, and
                each user is capped at 10 new entities per 24 hours. When disabled, only admins
                can create entities and the atomic RPC + gated edge functions reject non-admin
                calls.
              </p>
              {nonAdminEntityRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(nonAdminEntityRow.updated_at), { addSuffix: true })}
                  {nonAdminEntityRow.updated_reason ? ` — “${nonAdminEntityRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <Switch
              id="non-admin-entity"
              checked={nonAdminEntityEnabled}
              disabled={rows.isLoading || setFlag.isPending}
              onCheckedChange={(checked) =>
                setPending({ key: 'entity_creation.non_admin_enabled', nextEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase 3.5a — Search-to-Draft non-admin gate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Search-to-draft for non-admins
          </CardTitle>
          <CardDescription>
            When ON, non-admin users see the Search tab in Create Entity using Gemini grounded search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="non-admin-search-to-draft" className="text-base">
                Allow non-admin Search-to-draft
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, signed-in non-admins see the Search tab in Create Entity powered by
                Gemini grounded search. Also requires <code>Non-admin entity creation</code> to be
                enabled. When disabled, only admins see the Search tab and the
                <code> search-entity-candidates</code> edge function rejects non-admin calls.
              </p>
              {searchToDraftRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(searchToDraftRow.updated_at), { addSuffix: true })}
                  {searchToDraftRow.updated_reason ? ` — “${searchToDraftRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <Switch
              id="non-admin-search-to-draft"
              checked={searchToDraftEnabled}
              disabled={rows.isLoading || setFlag.isPending}
              onCheckedChange={(checked) =>
                setPending({ key: 'search_to_draft.non_admin_enabled', nextEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* v8b — Firecrawl fallback for search-result images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            Firecrawl fallback for search images
          </CardTitle>
          <CardDescription>
            Last-resort image enrichment for search results that need JS rendering
            (e.g. Google/Vertex interstitial pages). Search-to-Draft only; URL Analysis is unaffected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="firecrawl-search-image" className="text-base">
                Use Firecrawl as a fallback in enrich-candidate-image
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, if direct fetch and soft-redirect both fail to produce a page image,
                <code> enrich-candidate-image</code> calls Firecrawl once (extra ~2 s budget) to
                render the page and extract og:image / JSON-LD. Firecrawl-sourced images are labeled
                <em> Rendered page</em> in the picker. May consume Firecrawl credits.
              </p>
              {firecrawlImgRow?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(firecrawlImgRow.updated_at), { addSuffix: true })}
                  {firecrawlImgRow.updated_reason ? ` — “${firecrawlImgRow.updated_reason}”` : ''}
                </p>
              )}
            </div>
            <Switch
              id="firecrawl-search-image"
              checked={firecrawlImgEnabled}
              disabled={rows.isLoading || setFlag.isPending}
              onCheckedChange={(checked) =>
                setPending({
                  key: 'entity_extraction.search_image_firecrawl_enabled',
                  nextEnabled: checked,
                })
              }
            />
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
