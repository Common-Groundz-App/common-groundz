// Phase 3.3A-1 — multi-select gallery with source/confidence chips,
// local-upload tile, and a "No image" toggle. Holds local Files in memory;
// no storage or DB writes happen here.
import React, { useCallback, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Upload, ImageOff, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import type { ImageCandidate } from '@/types/entityDraft';
import {
  ImageSelectionV2,
  MAX_MEDIA_ITEMS,
  PendingUpload,
  isPendingUpload,
} from './types';

// Strip tracking params for compare only — stored URLs remain byte-identical.
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_)/i;
function normUrl(u: string): string {
  try {
    const url = new URL(u);
    const keep = new URLSearchParams();
    url.searchParams.forEach((v, k) => { if (!TRACKING_PARAMS.test(k)) keep.append(k, v); });
    url.search = keep.toString();
    return url.toString();
  } catch { return u; }
}

interface Props {
  candidates: ImageCandidate[];
  recommendedIndex?: number;
  value: ImageSelectionV2;
  onChange: (next: ImageSelectionV2) => void;
}

function chipForSource(source?: string): string {
  switch (source) {
    case 'official_site': return 'Official site';
    case 'google_images': return 'Google Images';
    case 'firecrawl': return 'Firecrawl';
    case 'page_metadata': return 'Page metadata';
    case 'user_upload': return 'User upload';
    default: return source ?? 'Source';
  }
}
function confidenceColor(c?: number): string {
  if (typeof c !== 'number') return 'bg-muted-foreground/40';
  if (c >= 0.7) return 'bg-green-500';
  if (c >= 0.4) return 'bg-amber-500';
  return 'bg-muted-foreground/40';
}

interface Tile {
  key: string;
  url: string;            // remote URL or blob:
  storeUrl: string | null; // null for pending uploads
  pending: PendingUpload | null;
  source?: string;
  confidence?: number;
  recommended: boolean;
}

export const ImageCandidateGrid: React.FC<Props> = ({
  candidates, recommendedIndex, value, onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track all blob URLs we create so we can revoke on unmount.
  const blobsRef = useRef<Set<string>>(new Set());

  // Seed default primary on first mount only.
  useEffect(() => {
    if (
      value.primaryUrl == null && !value.primaryPending && !value.noImageChosen &&
      typeof recommendedIndex === 'number' && candidates[recommendedIndex]
    ) {
      onChange({
        ...value,
        primaryUrl: candidates[recommendedIndex].url,
        primaryPending: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup blob URLs on unmount.
  useEffect(() => {
    return () => {
      blobsRef.current.forEach(u => URL.revokeObjectURL(u));
      blobsRef.current.clear();
    };
  }, []);

  const tiles: Tile[] = [
    ...candidates.map((c, i) => ({
      key: `r-${i}-${c.url}`,
      url: c.url,
      storeUrl: c.url,
      pending: null,
      source: (c as any).source,
      confidence: (c as any).confidence,
      recommended: recommendedIndex === i,
    })),
    ...value.galleryPending
      .concat(value.primaryPending ? [value.primaryPending] : [])
      // dedupe pending tiles by previewUrl
      .filter((p, i, arr) => arr.findIndex(x => x.previewUrl === p.previewUrl) === i)
      .map((p, i) => ({
        key: `u-${i}-${p.previewUrl}`,
        url: p.previewUrl,
        storeUrl: null,
        pending: p,
        source: 'user_upload',
        confidence: 1,
        recommended: false,
      })),
  ];

  const totalSelected =
    (value.primaryUrl || value.primaryPending ? 1 : 0) +
    value.galleryUrls.length + value.galleryPending.length;

  const isPrimary = (t: Tile) =>
    (t.pending ? value.primaryPending?.previewUrl === t.pending.previewUrl
               : value.primaryUrl != null && normUrl(value.primaryUrl) === normUrl(t.url));
  const isInGallery = (t: Tile) =>
    t.pending
      ? value.galleryPending.some(p => p.previewUrl === t.pending!.previewUrl)
      : value.galleryUrls.some(u => normUrl(u) === normUrl(t.url));

  const setPrimary = (t: Tile) => {
    if (value.noImageChosen) return;
    // Promoting a tile to primary auto-removes it from gallery.
    if (t.pending) {
      onChange({
        ...value,
        primaryUrl: null,
        primaryPending: t.pending,
        galleryPending: value.galleryPending.filter(p => p.previewUrl !== t.pending!.previewUrl),
      });
    } else {
      onChange({
        ...value,
        primaryUrl: t.url,
        primaryPending: null,
        galleryUrls: value.galleryUrls.filter(u => normUrl(u) !== normUrl(t.url)),
      });
    }
  };

  const toggleGallery = (t: Tile, checked: boolean) => {
    if (value.noImageChosen) return;
    if (isPrimary(t)) return;
    if (checked && totalSelected >= MAX_MEDIA_ITEMS) return;
    if (t.pending) {
      onChange({
        ...value,
        galleryPending: checked
          ? [...value.galleryPending, t.pending]
          : value.galleryPending.filter(p => p.previewUrl !== t.pending!.previewUrl),
      });
    } else {
      onChange({
        ...value,
        galleryUrls: checked
          ? [...value.galleryUrls, t.url]
          : value.galleryUrls.filter(u => normUrl(u) !== normUrl(t.url)),
      });
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_MEDIA_ITEMS - totalSelected;
    if (room <= 0) return;
    const arr = Array.from(files).slice(0, room).filter(f => f.type.startsWith('image/'));
    const next: PendingUpload[] = arr.map(file => {
      const previewUrl = URL.createObjectURL(file);
      blobsRef.current.add(previewUrl);
      return { file, previewUrl };
    });
    if (next.length === 0) return;
    // First pending upload becomes primary if no primary exists.
    let nextState = { ...value, noImageChosen: false };
    if (!nextState.primaryUrl && !nextState.primaryPending) {
      nextState.primaryPending = next[0];
      nextState.galleryPending = [...nextState.galleryPending, ...next.slice(1)];
    } else {
      nextState.galleryPending = [...nextState.galleryPending, ...next];
    }
    onChange(nextState);
  }, [onChange, totalSelected, value]);

  const removeTile = (t: Tile) => {
    let nextState = { ...value };
    if (t.pending) {
      // Revoke blob immediately.
      URL.revokeObjectURL(t.pending.previewUrl);
      blobsRef.current.delete(t.pending.previewUrl);
      if (nextState.primaryPending?.previewUrl === t.pending.previewUrl) {
        nextState.primaryPending = null;
      }
      nextState.galleryPending = nextState.galleryPending.filter(p => p.previewUrl !== t.pending!.previewUrl);
    } else {
      if (nextState.primaryUrl && normUrl(nextState.primaryUrl) === normUrl(t.url)) {
        nextState.primaryUrl = null;
      }
      nextState.galleryUrls = nextState.galleryUrls.filter(u => normUrl(u) !== normUrl(t.url));
    }
    onChange(nextState);
  };

  const toggleNoImage = (checked: boolean) => {
    if (checked) {
      // Clear everything + revoke any pending blobs.
      [value.primaryPending, ...value.galleryPending].forEach(p => {
        if (p) { URL.revokeObjectURL(p.previewUrl); blobsRef.current.delete(p.previewUrl); }
      });
      onChange({
        primaryUrl: null, primaryPending: null,
        galleryUrls: [], galleryPending: [],
        noImageChosen: true,
      });
    } else {
      onChange({ ...value, noImageChosen: false });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Images ({totalSelected}/{MAX_MEDIA_ITEMS})
        </Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={value.noImageChosen} onCheckedChange={(c) => toggleNoImage(c === true)} />
          <ImageOff className="h-3 w-3" /> No image
        </label>
      </div>

      {!value.noImageChosen && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tiles.map((t) => {
              const primary = isPrimary(t);
              const inGallery = isInGallery(t);
              const checkboxDisabled = !primary && !inGallery && totalSelected >= MAX_MEDIA_ITEMS;
              return (
                <div
                  key={t.key}
                  className={cn(
                    'relative group rounded-md overflow-hidden border-2 transition-all',
                    primary ? 'border-primary ring-2 ring-primary/20'
                            : inGallery ? 'border-primary/50'
                            : 'border-transparent hover:border-muted-foreground/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setPrimary(t)}
                    className="block w-full cursor-pointer"
                    title="Set as primary"
                  >
                    {t.pending ? (
                      <img src={t.url} alt="upload preview" className="aspect-square w-full object-cover bg-muted" />
                    ) : (
                      <ImageWithFallback
                        src={t.url} alt="Candidate" entityType="product"
                        className="aspect-square w-full object-cover bg-muted"
                      />
                    )}
                  </button>

                  {/* Top-left badges */}
                  <div className="absolute top-1 left-1 flex flex-col gap-1 pointer-events-none">
                    {primary && (
                      <Badge className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5" /> Primary
                      </Badge>
                    )}
                    {t.recommended && !primary && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Suggested</Badge>
                    )}
                  </div>

                  {/* Top-right gallery checkbox */}
                  <div className="absolute top-1 right-1">
                    <label className={cn(
                      'flex items-center justify-center rounded bg-background/80 backdrop-blur p-0.5',
                      checkboxDisabled && 'opacity-40',
                    )} title={checkboxDisabled ? `Max ${MAX_MEDIA_ITEMS} images` : 'Add to gallery'}>
                      <Checkbox
                        checked={inGallery}
                        disabled={primary || checkboxDisabled}
                        onCheckedChange={(c) => toggleGallery(t, c === true)}
                      />
                    </label>
                  </div>

                  {/* Bottom chips */}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1 pointer-events-none">
                    <span className="text-[9px] px-1 py-0.5 rounded bg-background/85 backdrop-blur flex items-center gap-1">
                      <span className={cn('h-1.5 w-1.5 rounded-full', confidenceColor(t.confidence))} />
                      {chipForSource(t.source)}
                    </span>
                    {t.pending && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTile(t); }}
                        className="text-[9px] px-1 py-0.5 rounded bg-background/85 backdrop-blur pointer-events-auto hover:bg-destructive hover:text-destructive-foreground"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Upload tile */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={totalSelected >= MAX_MEDIA_ITEMS}
              className={cn(
                'aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground',
                totalSelected >= MAX_MEDIA_ITEMS
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:border-primary hover:text-primary cursor-pointer',
              )}
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
            <input
              ref={fileInputRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tap a tile to set primary. Checkboxes add up to {MAX_MEDIA_ITEMS - 1} more to the gallery.
            Uploaded files are stored only when you save the entity.
          </p>
        </>
      )}

      {value.noImageChosen && (
        <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/30">
          No image will be set. You can always add one later from the entity page.
        </div>
      )}
    </div>
  );
};

// Re-export for backwards-compat call sites that imported the v1 type.
export type { ImageSelectionV2 as ImageSelection } from './types';
