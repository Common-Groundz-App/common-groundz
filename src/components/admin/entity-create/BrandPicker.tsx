import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Plus, AlertTriangle, Loader2, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandCandidate } from '@/types/entityDraft';
import { brandDuplicateCheck, type BrandDuplicateMatch } from '@/utils/brandDuplicateCheck';

/**
 * BrandDecision — explicit conceptual model returned to the caller.
 * Translation to writes happens in DraftReviewBody.handleConfirmBrand
 * (Stage 1 footer is the ONLY brand-write trigger).
 */
export type BrandDecision =
  | { kind: 'existing'; entityId: string; candidate: BrandCandidate }
  | { kind: 'create_new'; candidate: BrandCandidate }
  | { kind: 'not_sure' }
  | { kind: 'not_listed' }
  | { kind: 'not_applicable' };

export interface WebsiteConflictInfo {
  candidate: {
    id: string;
    name: string;
    slug?: string | null;
    image_url?: string | null;
    website_url?: string | null;
  };
  submittedName: string;
  submittedWebsite: string;
}

export interface BrandPickerHandle {
  clearManualWebsite: () => void;
}

interface BrandPickerProps {
  candidates: BrandCandidate[];
  recommendedIndex?: number;
  defaultCollapsedNotApplicable?: boolean;
  value: BrandDecision | null;
  onChange: (decision: BrandDecision | null) => void;
  /** Plan v3.1 — when set, the manual form area renders a blocking conflict alert. */
  websiteConflict?: WebsiteConflictInfo | null;
  onClearWebsite?: () => void;
  onUseExistingFromConflict?: () => void;
  onCreateAnyway?: () => void;
}

/** Empty is valid; otherwise must parse as http(s) URL. */
function isValidOptionalUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const BrandPicker = forwardRef<BrandPickerHandle, BrandPickerProps>(function BrandPicker(
  {
    candidates,
    recommendedIndex,
    defaultCollapsedNotApplicable = false,
    value,
    onChange,
    websiteConflict = null,
    onClearWebsite,
    onUseExistingFromConflict,
    onCreateAnyway,
  },
  ref,
) {
  const existing = candidates.filter((c) => c.status === 'matched_existing');
  const suggested = candidates.filter((c) => c.status === 'suggested_new');
  const recommended =
    typeof recommendedIndex === 'number' ? candidates[recommendedIndex] ?? null : null;

  const isSelected = (cand: BrandCandidate) => {
    if (!value) return false;
    if (value.kind === 'existing' && value.candidate === cand) return true;
    if (value.kind === 'create_new' && value.candidate === cand) return true;
    return false;
  };

  const handleCandidateClick = (cand: BrandCandidate) => {
    if (cand.status === 'matched_existing' && cand.id) {
      onChange({ kind: 'existing', entityId: cand.id, candidate: cand });
    } else if (cand.status === 'suggested_new') {
      onChange({ kind: 'create_new', candidate: cand });
    }
  };

  useEffect(() => {
    if (defaultCollapsedNotApplicable && !value) {
      onChange({ kind: 'not_applicable' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCollapsedNotApplicable]);

  // ── Manual "Create new brand…" ─────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');
  const [manualLogo, setManualLogo] = useState('');
  const [dupChecking, setDupChecking] = useState(false);
  const [dupMatches, setDupMatches] = useState<BrandDuplicateMatch[]>([]);
  const [overrideDup, setOverrideDup] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Plan v3.2 — live logo preview state; only submit logoUrl when preview succeeds.
  type LogoPreviewState = 'idle' | 'loading' | 'ok' | 'failed';
  const [logoPreviewState, setLogoPreviewState] = useState<LogoPreviewState>('idle');
  const logoTimeoutRef = useRef<number | null>(null);

  // Plan v3.1 — track original name; first divergence clears stale URLs once.
  const originalNameRef = useRef<string>('');
  const staleClearedRef = useRef(false);

  // Expose imperative clearManualWebsite for the Clear-website conflict action.
  useImperativeHandle(
    ref,
    () => ({
      clearManualWebsite: () => {
        setManualWebsite('');
      },
    }),
    [],
  );

  useEffect(() => {
    if (!manualOpen) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = manualName.trim();
    if (trimmed.length < 2) {
      setDupMatches([]);
      setDupChecking(false);
      return;
    }
    setDupChecking(true);
    debounceRef.current = window.setTimeout(async () => {
      const matches = await brandDuplicateCheck(trimmed);
      setDupMatches(matches);
      setDupChecking(false);
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [manualName, manualOpen]);

  const exactDup = dupMatches.find((m) => m.isExactNormalized);
  const trimmedName = manualName.trim();
  const websiteValid = isValidOptionalUrl(manualWebsite);
  const logoValid = isValidOptionalUrl(manualLogo);
  const canSubmitManual =
    trimmedName.length >= 2 &&
    websiteValid &&
    logoValid &&
    (!exactDup || overrideDup);

  // Plan v3.2 — live logo preview with 5s timeout. Only gate the manual candidate's
  // logoUrl by preview success; do NOT block brand creation itself.
  useEffect(() => {
    if (logoTimeoutRef.current) {
      window.clearTimeout(logoTimeoutRef.current);
      logoTimeoutRef.current = null;
    }
    const trimmed = manualLogo.trim();
    if (!trimmed || !logoValid) {
      setLogoPreviewState('idle');
      return;
    }
    setLogoPreviewState('loading');
    const img = new window.Image();
    const timeoutId = window.setTimeout(() => {
      setLogoPreviewState('failed');
      try {
        console.warn('brand_logo_preview_failed', {
          host: new URL(trimmed).hostname,
          reason: 'timeout',
        });
      } catch {
        console.warn('brand_logo_preview_failed', { host: 'unknown', reason: 'timeout' });
      }
      img.src = '';
    }, 5000);
    logoTimeoutRef.current = timeoutId;
    img.onload = () => {
      window.clearTimeout(timeoutId);
      setLogoPreviewState('ok');
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      setLogoPreviewState('failed');
      try {
        console.warn('brand_logo_preview_failed', {
          host: new URL(trimmed).hostname,
          reason: 'onerror',
        });
      } catch {
        console.warn('brand_logo_preview_failed', { host: 'unknown', reason: 'onerror' });
      }
    };
    img.src = trimmed;
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [manualLogo, logoValid]);

  const effectiveLogoForSubmit = () =>
    logoPreviewState === 'ok' ? manualLogo.trim() : undefined;

  // Plan v3.1 — first time name diverges from the name when form opened,
  // clear stale website/logo exactly once.
  useEffect(() => {
    if (!manualOpen) return;
    if (staleClearedRef.current) return;
    if (trimmedName && trimmedName !== originalNameRef.current) {
      if (manualWebsite || manualLogo) {
        setManualWebsite('');
        setManualLogo('');
      }
      staleClearedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedName, manualOpen]);

  // Plan v3.1 — live-sync the manual decision so the parent footer enables
  // without requiring the inner "Use typed brand" click.
  const lastSyncedRef = useRef<string>('');
  useEffect(() => {
    if (!manualOpen) return;
    const syncKey = `${trimmedName}|${manualWebsite.trim()}|${manualLogo.trim()}|${overrideDup ? '1' : '0'}|${exactDup?.id ?? ''}|${logoPreviewState}`;
    if (!canSubmitManual) {
      // If currently-active decision is the manual one, clear it.
      if (
        value?.kind === 'create_new' &&
        (value.candidate as BrandCandidate).source === 'admin_manual'
      ) {
        onChange(null);
        lastSyncedRef.current = '';
      }
      return;
    }
    if (syncKey === lastSyncedRef.current) return;
    const candidate: BrandCandidate = {
      name: trimmedName,
      websiteUrl: manualWebsite.trim() || undefined,
      // Plan v3.2 — only include logoUrl when preview has actually loaded successfully.
      logoUrl: effectiveLogoForSubmit(),
      source: 'admin_manual',
      confidence: 1,
      reason: 'Entered manually by admin',
      status: 'suggested_new',
    };
    onChange({ kind: 'create_new', candidate });
    lastSyncedRef.current = syncKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmitManual, manualOpen, trimmedName, manualWebsite, manualLogo, overrideDup, exactDup?.id, logoPreviewState]);

  // Inner "Use typed brand" shortcut — same as live-sync but explicit.
  const submitManual = () => {
    if (!canSubmitManual) return;
    const candidate: BrandCandidate = {
      name: trimmedName,
      websiteUrl: manualWebsite.trim() || undefined,
      // Plan v3.2 — same gating as live-sync.
      logoUrl: effectiveLogoForSubmit(),
      source: 'admin_manual',
      confidence: 1,
      reason: 'Entered manually by admin',
      status: 'suggested_new',
    };
    onChange({ kind: 'create_new', candidate });
  };


  const manualSelected =
    value?.kind === 'create_new' && (value.candidate as BrandCandidate).source === 'admin_manual';

  const openManual = () => {
    setManualOpen(true);
    originalNameRef.current = manualName.trim();
    staleClearedRef.current = false;
    // Don't clobber an existing active decision: leave value alone.
  };

  const closeManual = () => {
    setManualOpen(false);
    setManualName('');
    setManualWebsite('');
    setManualLogo('');
    setDupMatches([]);
    setOverrideDup(false);
    originalNameRef.current = '';
    staleClearedRef.current = false;
    if (manualSelected) {
      onChange(null);
      lastSyncedRef.current = '';
    }
  };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-hidden">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Brand / Parent
      </Label>

      {/* ── Existing brands ─────────────────────────────────────────────── */}
      {existing.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Existing brands ({existing.length})
          </p>
          <div className="space-y-2">
            {existing.map((cand, idx) => {
              const selected = isSelected(cand);
              const isRecommended = recommended === cand;
              return (
                <button
                  key={`e-${cand.id ?? cand.name}-${idx}`}
                  type="button"
                  onClick={() => handleCandidateClick(cand)}
                  className={cn(
                    'w-full text-left rounded-md border p-3 transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {cand.logoUrl ? (
                      <img
                        src={cand.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded object-contain bg-muted flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{cand.name}</p>
                        {isRecommended && <Badge className="text-xs">recommended</Badge>}
                      </div>
                      {cand.websiteUrl && (
                        <p className="text-xs text-muted-foreground truncate" title={cand.websiteUrl}>
                          {cand.websiteUrl}
                        </p>
                      )}
                      {cand.reason && (
                        <p className="text-xs text-muted-foreground mt-1">{cand.reason}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Suggested new brands (+ manual-selected row) ────────────────── */}
      {(suggested.length > 0 || manualSelected) && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Suggested new brand{suggested.length + (manualSelected ? 1 : 0) > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {suggested.map((cand, idx) => {
              const selected = isSelected(cand);
              return (
                <button
                  key={`s-${cand.name}-${idx}`}
                  type="button"
                  onClick={() => handleCandidateClick(cand)}
                  className={cn(
                    'w-full text-left rounded-md border p-3 transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {cand.logoUrl ? (
                      <img
                        src={cand.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded object-contain bg-muted flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{cand.name}</p>
                        <Badge variant="outline" className="text-xs">new</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inferred from URL — confirm to create.
                      </p>
                      {cand.websiteUrl && (
                        <p className="text-xs text-muted-foreground truncate" title={cand.websiteUrl}>
                          {cand.websiteUrl}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Plan v3.2 — manual-selected row (visual confirmation for "Use typed brand") */}
            {manualSelected && value?.kind === 'create_new' && (
              <div
                key="manual-selected-row"
                className="w-full text-left rounded-md border p-3 border-primary bg-primary/5"
              >
                <div className="flex items-start gap-3">
                  {value.candidate.logoUrl && logoPreviewState === 'ok' ? (
                    <img
                      src={value.candidate.logoUrl}
                      alt=""
                      className="h-8 w-8 rounded object-contain bg-muted flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex-shrink-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                      {value.candidate.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{value.candidate.name}</p>
                      <Badge variant="outline" className="text-xs">new</Badge>
                      <Badge className="text-xs gap-1">
                        <Check className="h-3 w-3" /> selected
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Inferred from manual entry — click "Create Brand &amp; Continue" below to create it.
                    </p>
                    {value.candidate.websiteUrl && (
                      <p className="text-xs text-muted-foreground truncate" title={value.candidate.websiteUrl}>
                        {value.candidate.websiteUrl}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {candidates.length === 0 && !manualOpen && (
        <p className="text-sm text-muted-foreground">
          No brand candidates were detected. Create one manually or skip below.
        </p>
      )}

      {/* ── Manual create form ──────────────────────────────────────────── */}
      {!manualOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={openManual}
          className={cn(manualSelected && 'border-primary bg-primary/5')}
        >
          <Plus className="h-4 w-4 mr-1" /> Create new brand…
        </Button>
      ) : (
        <div className="rounded-md border p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Create new brand</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeManual}
              className="h-7 px-2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Brand name *</Label>
            <Input
              value={manualName}
              onChange={(e) => {
                setManualName(e.target.value);
                setOverrideDup(false);
              }}
              placeholder="e.g. AXIS-Y"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Website (optional)</Label>
              <Input
                value={manualWebsite}
                onChange={(e) => setManualWebsite(e.target.value)}
                placeholder="https://"
                className={cn(!websiteValid && 'border-destructive focus-visible:ring-destructive')}
              />
              {!websiteValid && (
                <p className="text-[11px] text-destructive">
                  Enter a valid http(s) URL or leave blank.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Logo URL (optional)</Label>
              <div className="flex items-start gap-2">
                <Input
                  value={manualLogo}
                  onChange={(e) => setManualLogo(e.target.value)}
                  placeholder="https://…/logo.png"
                  className={cn(
                    'flex-1',
                    !logoValid && 'border-destructive focus-visible:ring-destructive',
                    logoValid && logoPreviewState === 'failed' && 'border-amber-500 focus-visible:ring-amber-500',
                  )}
                />
                {/* Reserved 32px preview slot */}
                <div className="h-8 w-8 flex-shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                  {logoPreviewState === 'loading' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  {logoPreviewState === 'ok' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={manualLogo.trim()}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  )}
                  {logoPreviewState === 'failed' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
              </div>
              {!logoValid && (
                <p className="text-[11px] text-destructive">
                  Enter a valid http(s) URL or leave blank.
                </p>
              )}
              {logoValid && logoPreviewState === 'failed' && (
                <p className="text-[11px] text-amber-600">
                  This logo URL could not be loaded (redirect or non-image). The brand will be created without a logo — you can add one later. Use a direct image URL ending in .png/.jpg/.svg/.webp.
                </p>
              )}
              {logoValid && logoPreviewState === 'loading' && (
                <p className="text-[11px] text-muted-foreground">Checking logo…</p>
              )}
            </div>
          </div>

          {/* Duplicate-check feedback */}
          {dupChecking && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking for duplicates…
            </p>
          )}
          {!dupChecking && dupMatches.length > 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                {exactDup
                  ? `"${exactDup.name}" already exists`
                  : `${dupMatches.length} possibly matching brand${dupMatches.length > 1 ? 's' : ''} found`}
              </p>
              <ul className="space-y-1">
                {dupMatches.slice(0, 4).map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs">
                    {/* Reserved logo slot for consistent alignment */}
                    <div className="h-5 w-5 flex-shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt=""
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <span className="truncate flex-1">{m.name}</span>
                    <button
                      type="button"
                      className="text-primary hover:underline flex-shrink-0"
                      onClick={() => {
                        const cand: BrandCandidate = {
                          id: m.id,
                          name: m.name,
                          logoUrl: m.image_url ?? undefined,
                          websiteUrl: m.website_url ?? undefined,
                          source: 'existing_entity',
                          confidence: m.isExactNormalized ? 0.95 : 0.6,
                          reason: 'Selected from duplicate check',
                          status: 'matched_existing',
                        };
                        onChange({ kind: 'existing', entityId: m.id, candidate: cand });
                        setManualOpen(false);
                      }}
                    >
                      Use existing brand
                    </button>
                  </li>
                ))}
              </ul>
              {exactDup && (
                <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={overrideDup}
                    onChange={(e) => setOverrideDup(e.target.checked)}
                  />
                  Create anyway
                </label>
              )}
            </div>
          )}

          {/* Plan v3.1 — Website conflict alert (blocking) */}
          {websiteConflict && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="text-xs">
                  The website <span className="font-mono">{websiteConflict.submittedWebsite}</span> already
                  belongs to brand <strong>{websiteConflict.candidate.name}</strong>. Choose how to proceed:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onClearWebsite}
                  >
                    Clear website
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onUseExistingFromConflict}
                  >
                    Use existing brand
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onCreateAnyway}
                    title="Creates the new brand with website left empty (you can add a website later)."
                  >
                    Create without website
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  "Create without website" will create <strong>{websiteConflict.submittedName}</strong> with the
                  website field left empty to avoid a conflict.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              onClick={submitManual}
              disabled={!canSubmitManual || dupChecking || manualSelected}
              variant={manualSelected ? 'secondary' : 'default'}
            >
              {manualSelected ? (
                <><Check className="h-3.5 w-3.5 mr-1" />Selected</>
              ) : (
                'Use typed brand'
              )}
            </Button>
          </div>
          {manualSelected && !websiteConflict && (
            <p className="text-[11px] text-muted-foreground">
              Selected — click "Create Brand &amp; Continue" below to create it.
            </p>
          )}
        </div>
      )}

      {/* ── Catch-alls ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant={value?.kind === 'not_sure' ? 'default' : 'outline'}
          onClick={() => onChange({ kind: 'not_sure' })}
        >
          Not sure
        </Button>
        <Button
          size="sm"
          variant={value?.kind === 'not_listed' ? 'default' : 'outline'}
          onClick={() => onChange({ kind: 'not_listed' })}
        >
          Brand not listed
        </Button>
        <Button
          size="sm"
          variant={value?.kind === 'not_applicable' ? 'default' : 'outline'}
          onClick={() => onChange({ kind: 'not_applicable' })}
        >
          Not applicable
        </Button>
      </div>
    </div>
  );
});
