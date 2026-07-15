// Phase 3.5a — Search-to-Draft entry panel.
// Sits in the "Search" tab of CreateEntityDialog next to "Paste URL".
// Emits `onPick(payload)` when the user clicks "Review & create" on a
// web candidate, or `onOpenExisting(match)` when they click Open on a
// CommonGroundz match.

import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Loader2, PenSquare, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useSearchFunnel } from '@/hooks/useSearchFunnel';
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
  onOpenExisting: (match: ExistingMatch, intent?: 'view' | 'review') => void;
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  return 'Lower';
}

// Phase 3.5b — client-side cap for on-click image enrichment. Server budget
// is 6s; add 500ms for network + serialization.
const ENRICH_CLIENT_TIMEOUT_MS = 6_500;

interface EnrichResponse {
  imageUrl: string | null;
  source: 'page_metadata' | null;
  method: EnrichedImageMethod | null;
  diagnostics?: { latencyMs: number; fetched: boolean; cached: boolean; errorCode?: string };
}

export const SearchEntryPanel: React.FC<SearchEntryPanelProps> = ({ onPick, onOpenExisting }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrichingIndex, setEnrichingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Phase 3.5c — recent-search chips (surface-scoped, existing hook).
  const { recents, addRecent, removeRecent, clearRecents } =
    useRecentSearches('entity-create-search');

  // Phase 3.5c — privacy-safe funnel telemetry.
  const { log: logFunnel, markPick } = useSearchFunnel();

  const canSearch = query.trim().length >= 3 && !loading;

  // Auto-focus on mount (tab activation).
  useEffect(() => {
    // Delay one tick so Radix Tab focus mgmt doesn't fight us.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const runSearch = async (rawQuery?: string) => {
    const q = (rawQuery ?? query).trim();
    if (q.length < 3) return;
    if (rawQuery !== undefined) setQuery(rawQuery);
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
        // Phase 3.5c — do NOT log the raw query. Log only failure detail.
        console.error('[SearchEntryPanel] invoke failed');
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
      const resp = data as SearchResponse;
      setResult(resp);

      // Persist as a "recent" only on a successful (non-error) response.
      // Chip text stays client-side; never enters telemetry.
      addRecent(q, 'query');

      // Fire funnel event — hashed only.
      const hasResults =
        (resp?.existingMatches?.length ?? 0) > 0 ||
        (resp?.candidates?.length ?? 0) > 0;
      void logFunnel({
        event: 'search_run',
        source: 'search',
        query: q,
        diagnostics: {
          latencyMs: resp?.diagnostics?.latencyMs,
          cached: resp?.diagnostics?.cached,
          hasImage: hasResults,
        },
      });
    } catch (e: any) {
      // Do NOT include the raw query in the log.
      console.error('[SearchEntryPanel] threw');
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSearch) {
      e.preventDefault();
      void runSearch();
    }
  };

  /** Phase 3.5b — on Review & create: for web candidates without an image,
   *  request one page-metadata image enrichment. Regardless of outcome
   *  (success, null, timeout, 429, SSRF-block), call onPick exactly once so
   *  Draft Review still opens. No error toast. */
  const handleReviewCreate = async (payload: SearchCandidatePayload, idx: number) => {
    if (enrichingIndex !== null) return;
    const { candidate } = payload;

    // Phase 3.5c — funnel: candidate_pick from search results.
    markPick();
    void logFunnel({
      event: 'candidate_pick',
      source: 'search',
      candidateIndex: idx,
      entityType: candidate.type,
      diagnostics: { hasImage: Boolean(candidate.imageUrl) },
    });

    if (candidate.imageUrl) {
      onPick(payload);
      return;
    }
    setEnrichingIndex(idx);
    let enrichedPayload = payload;
    try {
      const enrichPromise = supabase.functions.invoke('enrich-candidate-image', {
        body: { sourceUrl: candidate.sourceUrl, name: candidate.name },
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error('client_timeout') }),
          ENRICH_CLIENT_TIMEOUT_MS,
        ),
      );
      const raced = await Promise.race([enrichPromise, timeoutPromise]);
      const data = (raced as any).data as EnrichResponse | null;
      if (data?.imageUrl && data.method) {
        enrichedPayload = {
          ...payload,
          draft: mergeEnrichedImage(payload.draft, data.imageUrl, data.method),
        };
      }
    } catch (e) {
      console.warn('[SearchEntryPanel] image enrichment failed:', (e as Error).message);
    } finally {
      setEnrichingIndex(null);
      onPick(enrichedPayload);
    }
  };

  // Phase 3.5c — instrumented "Write review" / "Open" for existing matches.
  const handleOpenExisting = (m: ExistingMatch, intent: 'view' | 'review') => {
    markPick();
    void logFunnel({
      event: 'candidate_pick',
      source: 'existing_match',
      entityType: m.type,
      diagnostics: { hasImage: Boolean(m.imageUrl) },
    });
    onOpenExisting(m, intent);
  };

  const errorCode = result?.diagnostics?.errorCode;
  const hasCandidates = (result?.candidates.length ?? 0) > 0;
  const hasExisting = (result?.existingMatches.length ?? 0) > 0;
  const showRecents = !result && !loading && !error && query.trim().length === 0 && recents.length > 0;

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
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder='e.g. "cetaphil gentle cleanser"'
            disabled={loading}
            className="bg-background"
            aria-label="Search entity name"
          />
          <Button
            onClick={() => runSearch()}
            disabled={!canSearch}
            className="gap-2 min-w-[100px]"
          >
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {showRecents && (
        <section aria-label="Recent searches" className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent searches
            </h4>
            <button
              type="button"
              onClick={clearRecents}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents
              .filter((r) => !r.kind || r.kind === 'query')
              .map((r) => (
                <div
                  key={r.query}
                  className="group inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-foreground shadow-sm hover:border-brand-orange/50"
                >
                  <button
                    type="button"
                    onClick={() => void runSearch(r.query)}
                    className="max-w-[220px] truncate"
                  >
                    {r.query}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r.query}`}
                    onClick={() => removeRecent(r.query)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}

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
                    <div className="flex items-center gap-2">
                      {user && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenExisting(m, 'review')}
                          className="gap-1"
                        >
                          <PenSquare className="h-3.5 w-3.5" />
                          Write review
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenExisting(m, 'view')}
                      >
                        Open
                      </Button>
                    </div>
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
                  const enriching = enrichingIndex === idx;
                  return (
                    <div
                      key={`${c.sourceUrl}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && enrichingIndex === null) {
                          e.preventDefault();
                          void handleReviewCreate(p, idx);
                        }
                      }}
                      className="flex items-start gap-3 rounded-lg border bg-card p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {enriching ? (
                          <Skeleton className="h-full w-full" />
                        ) : c.imageUrl ? (
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
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {c.displayDomain || 'source'} · Google Search
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleReviewCreate(p, idx);
                        }}
                        disabled={enrichingIndex !== null}
                        className="gap-1 min-w-[128px]"
                      >
                        {enriching ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Preparing…
                          </>
                        ) : (
                          <>Review &amp; create</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!hasExisting && !hasCandidates && !errorCode && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No matches yet. Try adding the brand name, e.g. "cetaphil gentle cleanser".
            </div>
          )}

          {!hasExisting && !hasCandidates && errorCode && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Web suggestions are temporarily unavailable. Try again.
            </div>
          )}
        </>
      )}
    </div>
  );
};
