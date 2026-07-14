// Phase 3.5a — Search-to-Draft entry panel.
// Sits in the "Search" tab of CreateEntityDialog next to "Paste URL".
// Emits `onPick(payload)` when the user clicks "Review & create" on a
// web candidate, or `onOpenExisting(match)` when they click Open on a
// CommonGroundz match.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Loader2, PenSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { mergeEnrichedImage, type EnrichedImageMethod, type SearchCandidatePayload } from './applyEntityDraft';

export interface ExistingMatch {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  type: string;
}

interface SearchResponse {
  existingMatches: ExistingMatch[];
  candidates: SearchCandidatePayload[];
  diagnostics: {
    model: string;
    groundingUsed: boolean;
    cached: boolean;
    latencyMs: number;
    errorCode?: string;
    groundingSources?: Array<{ title: string; domain: string }>;
  };
}

interface SearchEntryPanelProps {
  onPick: (payload: SearchCandidatePayload) => void;
  onOpenExisting: (match: ExistingMatch) => void;
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  return 'Lower';
}

export const SearchEntryPanel: React.FC<SearchEntryPanelProps> = ({ onPick, onOpenExisting }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = query.trim().length >= 3 && !loading;

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('search-entity-candidates', {
        body: { query: q },
      });
      if (fnErr) {
        // supabase-js loses status; try to read context body.
        let detail = fnErr.message;
        try {
          const ctxAny = (fnErr as any).context;
          if (ctxAny?.text) detail = await ctxAny.text();
        } catch { /* noop */ }
        console.error('[SearchEntryPanel] invoke failed:', detail);
        if (detail?.includes('rate_limited')) {
          setError("You've made a lot of searches. Try again in a few minutes.");
        } else if (detail?.includes('search_disabled')) {
          setError('Search is not available for your account right now.');
        } else if (detail?.includes('search_not_configured')) {
          setError('Search is temporarily unavailable. Try Paste URL instead.');
        } else if (detail?.includes('invalid_query')) {
          setError('Try a longer, more specific name.');
        } else {
          setError('Search failed. Please try again.');
        }
        return;
      }
      setResult(data as SearchResponse);
    } catch (e: any) {
      console.error('[SearchEntryPanel] threw:', e);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSearch) {
      e.preventDefault();
      runSearch();
    }
  };

  const errorCode = result?.diagnostics?.errorCode;
  const hasCandidates = (result?.candidates.length ?? 0) > 0;
  const hasExisting = (result?.existingMatches.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border-2 border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 to-transparent p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-1">
              Search the web
            </h3>
            <p className="text-sm text-muted-foreground">
              Type a product, brand, place, book, movie, food, app, or TV show name and we'll suggest real-world matches.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder='e.g. "cetaphil gentle cleanser"'
            disabled={loading}
            className="bg-background"
            aria-label="Search entity name"
          />
          <Button
            onClick={runSearch}
            disabled={!canSearch}
            className="gap-2 min-w-[100px]"
          >
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <Skeleton className="h-14 w-14 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && !loading && (
        <>
          {hasExisting && (
            <section aria-label="Already on CommonGroundz" className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Already on CommonGroundz</h4>
              <div className="space-y-2">
                {result.existingMatches.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                      {m.imageUrl ? (
                        <ImageWithFallback src={m.imageUrl} alt={m.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{getEntityTypeLabel(m.type as any)}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => onOpenExisting(m)}>
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {errorCode && hasExisting && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              We could only check CommonGroundz. Web suggestions are temporarily unavailable.
            </div>
          )}

          {hasCandidates && (
            <section aria-label="Suggested from the web" className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Suggested from the web</h4>
              <div className="space-y-2">
                {result.candidates.map((p, idx) => {
                  const c = p.candidate;
                  return (
                    <div key={`${c.sourceUrl}-${idx}`} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {c.imageUrl ? (
                          <ImageWithFallback src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">{getEntityTypeLabel(c.type as any)}</Badge>
                          {c.brand && <span>· {c.brand}</span>}
                          <span>· {confidenceLabel(c.confidence)}</span>
                        </div>
                        {c.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                        )}
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {c.displayDomain || 'source'} · Google Search
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button size="sm" onClick={() => onPick(p)}>
                        Review &amp; create
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!hasExisting && !hasCandidates && !errorCode && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No matches. Try a more specific name.
            </div>
          )}

          {!hasExisting && !hasCandidates && errorCode && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Search is temporarily unavailable. Try again in a moment or use Paste URL.
            </div>
          )}
        </>
      )}
    </div>
  );
};
