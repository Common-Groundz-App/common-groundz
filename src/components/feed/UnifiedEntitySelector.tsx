import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Loader2, Search, Plus, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { EntityAdapter } from '@/components/profile/circles/types';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getOptimalEntityImageUrl, getEntityTypeFallbackImage } from '@/utils/entityImageUtils';
import { useLocation } from '@/contexts/LocationContext';
import { CreateEntityDialog } from '@/components/admin/CreateEntityDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { findEntityByApiRef } from '@/services/recommendation/entityOperations';
import { createEntityQuick } from '@/services/enhancedEntityService';
import {
  normalize,
  dedupeResults,
  rankCategories,
  applyExactMatchOverride,
  softCollapse,
} from '@/utils/searchRanking';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { RecentSearchesPanel } from '@/components/search/RecentSearchesPanel';

// Map api_source → canonical entity type (single source of truth, mirrors use-entity-operations)
const normalizeEntityType = (rawType: string | undefined, apiSource: string | undefined): string => {
  const apiSourceMap: Record<string, string> = {
    openlibrary: 'book',
    google_books: 'book',
    omdb: 'movie',
    tmdb: 'movie',
    google_places: 'place',
  };
  if (apiSource && apiSourceMap[apiSource]) return apiSourceMap[apiSource];
  return rawType || 'product';
};

interface UnifiedEntitySelectorProps {
  onEntitiesChange: (entities: EntityAdapter[]) => void;
  onMentionInsert?: (username: string) => void;
  initialEntities?: EntityAdapter[];
  initialQuery?: string;
  autoFocusSearch?: boolean;
  maxEntities?: number;
  /**
   * Visual variant.
   * - `inline` (default): compact dropdown, used inside the explore search bar.
   * - `modal`: premium hero search + inline scrollable results, used inside
   *   the composer's "Select entities" modal.
   */
  variant?: 'inline' | 'modal';
}

interface CreatedEntityShape {
  id: string;
  name: string;
  type: string;
  image_url?: string;
}

const MAX_RESULTS_PER_CATEGORY = 5;

// Normalize is imported from searchRanking.ts (shared, strips punctuation too).

// Sanitize username: only allow alphanumeric, dots, underscores
const sanitizeUsername = (username: string) => username.replace(/[^a-z0-9._]/gi, '');

// Bold the matching substring in a name
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'place': return '📍';
    case 'food': return '🍽️';
    case 'movie': return '🎬';
    case 'book': return '📚';
    case 'product': return '💄';
    case 'brand': return '🏷️';
    default: return '🏷️';
  }
}

export function UnifiedEntitySelector({
  onEntitiesChange,
  onMentionInsert,
  initialEntities = [],
  initialQuery = '',
  autoFocusSearch = false,
  maxEntities = 3,
  variant = 'inline',
}: UnifiedEntitySelectorProps) {
  const isModal = variant === 'modal';
  const [selectedEntities, setSelectedEntities] = useState<EntityAdapter[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [showResults, setShowResults] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const isCreatingRef = useRef(false);

  // Session-only override: lets the user enable location for THIS modal even
  // if the global Settings → Privacy toggle is off (and vice-versa). Defaults
  // to whatever the global setting says when the component mounts.
  const {
    position,
    locationEnabled: globalLocationEnabled,
    isLoading: geoLoading,
    permissionStatus,
    formatDistance,
    getPosition,
    isGeolocationSupported,
  } = useLocation();
  const [sessionLocationEnabled, setSessionLocationEnabled] = useState<boolean>(globalLocationEnabled);
  // Keep session in sync whenever the global flag flips (e.g., user opens
  // settings, toggles, comes back to the modal).
  useEffect(() => {
    setSessionLocationEnabled(globalLocationEnabled);
  }, [globalLocationEnabled]);

  const locationActive = sessionLocationEnabled && !!position;

  const { results, isLoading, loadingStates } = useEnhancedRealtimeSearch(debouncedQuery, {
    location: {
      enabled: locationActive,
      latitude: position?.latitude,
      longitude: position?.longitude,
    },
  });

  const handleEnableLocationInSession = useCallback(() => {
    setSessionLocationEnabled(true);
    if (!position) {
      // Will trigger the browser permission prompt if not yet granted.
      getPosition();
    }
    if (!globalLocationEnabled) {
      // Don't flip the global setting — session-only.
      // (enableLocation() would persist; we deliberately skip it.)
    }
  }, [position, getPosition, globalLocationEnabled]);

  const handleDisableLocationInSession = useCallback(() => {
    // Session-only OFF; do NOT touch the global setting.
    setSessionLocationEnabled(false);
  }, []);


  const isMaxReached = selectedEntities.length >= maxEntities;

  // Recent searches (composer surface) — declared early so callbacks can use addRecent.
  const { recents, addRecent, removeRecent, clearRecents } = useRecentSearches('composer');

  // Sync initial entities from parent
  useEffect(() => {
    setSelectedEntities(initialEntities);
  }, [initialEntities]);

  // Sync initialQuery
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
      setShowResults(true);
    }
  }, [initialQuery]);

  // Debounce search input → debouncedQuery
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Click outside handler — skip in modal variant where Dialog overlay handles dismissal
  useEffect(() => {
    if (isModal) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModal]);

  // Select a local entity
  const handleEntitySelect = useCallback((entity: EntityAdapter) => {
    if (isMaxReached) return;
    if (selectedEntities.some(e => e.id === entity.id)) return;
    const newEntities = [...selectedEntities, entity];
    setSelectedEntities(newEntities);
    onEntitiesChange(newEntities);
    addRecent(entity.name, 'entity', {
      entityId: entity.id,
      entityType: entity.type,
    });
    setSearchQuery('');
    setDebouncedQuery('');
    setShowResults(false);
  }, [selectedEntities, isMaxReached, onEntitiesChange, searchQuery, addRecent]);

  // Select an external result (find-or-create entity client-side, mirrors Explore search flow)
  const handleExternalSelect = useCallback(async (result: any) => {
    if (isMaxReached) return;
    // Selection lock: prevent rapid double-clicks / picking another result mid-create
    if (isCreatingRef.current) return;
    // Defensive guard: external results must have dedupe keys
    if (!result.api_source || !result.api_ref) {
      toast({
        title: 'Could not add this result',
        description: 'Try the "Add as new entity" option instead.',
        variant: 'destructive',
      });
      return;
    }

    isCreatingRef.current = true;
    setIsCreatingEntity(true);
    try {
      const normalizedType = normalizeEntityType(result.type, result.api_source);

      // Step 1: Dedupe — check if this external entity already exists locally
      let entity = await findEntityByApiRef(result.api_source, result.api_ref);

      // Step 2: Create if not found
      if (!entity) {
        entity = await createEntityQuick(
          {
            name: result.name,
            venue: result.venue,
            description: result.description,
            image_url: result.image_url,
            api_source: result.api_source,
            api_ref: result.api_ref,
            metadata: result.metadata || {},
          },
          normalizedType
        );
      }

      if (!entity) throw new Error('Entity creation returned null');

      // Step 3: Fire-and-forget background enrichment for Google Places
      if (result.api_source === 'google_places' && entity.id && result.api_ref) {
        supabase.functions
          .invoke('refresh-google-places-entity', {
            body: { entityId: entity.id, placeId: result.api_ref },
          })
          .catch((err) => console.error('Background enrichment failed:', err));
      }

      // Step 4: Add as tag chip
      handleEntitySelect({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        image_url: entity.image_url || undefined,
        description: entity.description || undefined,
        venue: entity.venue || undefined,
      });
    } catch (err) {
      console.error('Error selecting external result:', err);
      toast({
        title: 'Error',
        description: 'Could not select this item. Please try again.',
        variant: 'destructive',
      });
    } finally {
      isCreatingRef.current = false;
      setIsCreatingEntity(false);
    }
  }, [isMaxReached, handleEntitySelect, toast]);

  // Handle people click → insert @mention
  const handlePeopleClick = useCallback((user: any) => {
    const username = user.username || user.display_name;
    if (!username) return;
    const sanitized = sanitizeUsername(username);
    if (sanitized && onMentionInsert) {
      onMentionInsert(sanitized);
    }
    setSearchQuery('');
    setDebouncedQuery('');
    setShowResults(false);
  }, [onMentionInsert]);

  // Remove selected entity
  const removeEntity = useCallback((entityId: string) => {
    const newEntities = selectedEntities.filter(e => e.id !== entityId);
    setSelectedEntities(newEntities);
    onEntitiesChange(newEntities);
  }, [selectedEntities, onEntitiesChange]);

  // Keyboard handler: ↑/↓ navigate, Enter picks, Esc closes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => {
        if (pickableItems.length === 0) return -1;
        return (i + 1) % pickableItems.length;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => {
        if (pickableItems.length === 0) return -1;
        return i <= 0 ? pickableItems.length - 1 : i - 1;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isMaxReached) return;
      if (pickActive()) return;
      // No pickable results and query >= 3 chars → open create dialog
      if (searchQuery.trim().length >= 3 && !hasAnyResults) {
        setShowCreateDialog(true);
      }
    }
  };

  // Handle entity created from dialog
  const handleEntityCreated = (entity?: CreatedEntityShape) => {
    if (entity && !isMaxReached) {
      const adapter: EntityAdapter = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        image_url: entity.image_url,
      };
      if (!selectedEntities.some(e => e.id === adapter.id)) {
        const newEntities = [...selectedEntities, adapter];
        setSelectedEntities(newEntities);
        onEntitiesChange(newEntities);
      }
    }
    setShowCreateDialog(false);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowResults(false);
  };

  // Get image URL for entity
  const getImageUrl = (item: any) => {
    const optimalUrl = getOptimalEntityImageUrl(item);
    if (optimalUrl) return optimalUrl;
    return getEntityTypeFallbackImage(item.type || 'product');
  };

  // Raw category buckets from backend
  const localEntities = results.entities || [];
  const books = results.categorized?.books || [];
  const movies = results.categorized?.movies || [];
  const places = results.categorized?.places || [];
  const people = results.users || [];
  const hashtags = results.hashtags || [];

  // (recent searches hook is declared near the top of the component)

  // Ranking pipeline:
  //   dedupe → score+sort within → sort categories → exact override → soft collapse
  const collapsed = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [] as ReturnType<typeof softCollapse>;

    // Dedupe across external buckets — same name+venue collapses to higher score.
    const externalAll = dedupeResults(
      [
        ...books.map((b: any) => ({ ...b, type: 'book' })),
        ...movies.map((m: any) => ({ ...m, type: 'movie' })),
        ...places.map((p: any) => ({ ...p, type: 'place' })),
      ],
      q,
    );
    const dedupedBooks = externalAll.filter((r) => r.type === 'book');
    const dedupedMovies = externalAll.filter((r) => r.type === 'movie');
    const dedupedPlaces = externalAll.filter((r) => r.type === 'place');
    const dedupedLocal = dedupeResults(localEntities, q);

    const ranked = rankCategories(
      {
        entities: dedupedLocal,
        places: dedupedPlaces,
        books: dedupedBooks,
        movies: dedupedMovies,
        people,
      },
      q,
    );
    const overridden = applyExactMatchOverride(ranked, q);
    return softCollapse(overridden);
  }, [searchQuery, localEntities, books, movies, places, people]);

  const hasAnyResults =
    localEntities.length > 0 ||
    books.length > 0 ||
    movies.length > 0 ||
    places.length > 0 ||
    people.length > 0;

  // "Did you mean?" — uses shared normalize() (now also strips punctuation).
  const hasSimilarResults =
    searchQuery.trim().length >= 3 &&
    localEntities.some(
      (e) =>
        normalize(e.name).includes(normalize(searchQuery)) ||
        normalize(searchQuery).includes(normalize(e.name)),
    );

  const showAddEntity = searchQuery.trim().length >= 3 && !isMaxReached;

  // Location toggle
  const showLocationToggle = places.length > 0 || searchQuery.length >= 2;

  // Flat list of pickable items (in render order) for keyboard nav.
  // Excludes "people" (they trigger @mention, not entity-add).
  const pickableItems = useMemo(() => {
    const flat: { categoryKey: string; item: any }[] = [];
    for (const cat of collapsed) {
      if (cat.key === 'people') continue;
      for (const it of cat.visible) flat.push({ categoryKey: cat.key, item: it });
    }
    return flat;
  }, [collapsed]);

  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownShowAll, setDropdownShowAll] = useState<Record<string, boolean>>({});

  const handleDropdownToggle = useCallback((key: string, hiddenCount: number) => {
    if (hiddenCount === 0) return;
    setDropdownShowAll((prev) => ({ ...prev, [key]: !prev[key] }));
    setActiveIdx(-1);
  }, []);

  useEffect(() => {
    setActiveIdx(-1);
    setDropdownShowAll({});
  }, [searchQuery]);

  // Trigger pick on the currently-highlighted item (or first item if none highlighted).
  const pickActive = useCallback(() => {
    const idx = activeIdx >= 0 ? activeIdx : 0;
    const target = pickableItems[idx];
    if (!target) return false;
    const it = target.item;
    if (target.categoryKey === 'entities') {
      handleEntitySelect({
        id: it.id,
        name: it.name,
        type: it.type,
        image_url: it.image_url || undefined,
        description: it.description || undefined,
        venue: it.venue || undefined,
      });
    } else {
      handleExternalSelect({ ...it, type: it.type || target.categoryKey.replace(/s$/, '') });
    }
    return true;
  }, [activeIdx, pickableItems, handleEntitySelect, handleExternalSelect]);

  // Section rendering helper
  const renderSectionHeader = (title: string, count: number, isFirst = false, categoryKey?: string, hiddenCount: number = 0) => {
    const toggleButton = categoryKey && hiddenCount > 0 ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-brand-orange font-semibold hover:text-brand-orange/80"
        onClick={(e) => {
          e.stopPropagation();
          handleDropdownToggle(categoryKey, hiddenCount);
        }}
      >
        {dropdownShowAll[categoryKey] ? (
          <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
        ) : (
          <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
        )}
      </Button>
    ) : null;

    if (isModal) {
      return (
        <div
          className={`flex items-center justify-between px-4 pb-1.5 ${
            isFirst ? 'pt-3' : 'pt-4 border-t border-border/40'
          }`}
        >
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {title}
          </h4>
          <div className="flex items-center gap-2">
            {toggleButton}
            {!toggleButton && count > MAX_RESULTS_PER_CATEGORY && (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
                {count} results
              </span>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <div className="flex items-center gap-2">
          {toggleButton}
          {!toggleButton && count > MAX_RESULTS_PER_CATEGORY && (
            <span className="text-xs text-muted-foreground">{count} results</span>
          )}
        </div>
      </div>
    );
  };

  const renderEntityRow = (
    entity: any,
    onClick: () => void,
    isDisabled = false,
    opts: { isTop?: boolean; isActive?: boolean } = {},
  ) => (
    <div
      key={entity.id || `${entity.api_source}-${entity.api_ref}`}
      className={`flex items-center cursor-pointer transition-colors min-w-0 ${
        isModal ? 'px-4 py-3.5 gap-4' : 'px-3 py-2 gap-3'
      } ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/50'
      } ${opts.isActive ? 'bg-accent/60' : ''} ${
        opts.isTop && !isModal ? 'border-b border-border/40' : ''
      }`}
      onClick={isDisabled ? undefined : onClick}
    >
      <div className="flex-shrink-0">
        <ImageWithFallback
          src={getImageUrl(entity)}
          alt={entity.name}
          className={`object-cover ${
            isModal ? 'w-11 h-11 rounded-lg' : 'w-8 h-8 rounded'
          }`}
          fallbackSrc={getEntityTypeFallbackImage(entity.type || 'product')}
          entityType={entity.type}
          suppressConsoleErrors
        />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`truncate ${
            isModal ? 'text-[15px] font-semibold' : `text-sm ${opts.isTop ? 'font-medium' : ''}`
          }`}
        >
          <HighlightMatch text={entity.name} query={searchQuery} />
        </div>
        {isModal ? (
          <div className="text-[13px] text-muted-foreground truncate capitalize">
            {entity.venue ? entity.venue : (entity.type || 'product')}
          </div>
        ) : (
          entity.venue && (
            <div className="text-xs text-muted-foreground truncate">{entity.venue}</div>
          )
        )}
        {entity.metadata?.distance_label && (
          <div className="text-[11px] text-primary font-medium mt-0.5">
            {entity.metadata.distance_label}
          </div>
        )}
      </div>
      <span
        className={`${isModal ? 'text-base text-muted-foreground/60 ml-2' : 'text-xs text-muted-foreground'}`}
        aria-hidden
      >
        {getEntityIcon(entity.type || 'product')}
      </span>
    </div>
  );

  // Map category key → display title
  const categoryTitle: Record<string, string> = {
    entities: '✨ On Groundz',
    places: '📍 Places',
    books: '📚 Books',
    movies: '🎬 Movies',
    people: '👥 People',
  };

  // Compute the global flat-index of each render row, so we can highlight via activeIdx.
  // (people are excluded from pickableItems; they keep no highlight slot.)
  const flatIndexFor = (categoryKey: string, rowIndex: number): number => {
    let idx = 0;
    for (const cat of collapsed) {
      if (cat.key === 'people') continue;
      if (cat.key === categoryKey) return idx + rowIndex;
      idx += cat.visible.length;
    }
    return -1;
  };

  return (
    <div className="space-y-3">
      {/* Selected entities – compact pills matching composer's EntityHeroPill style */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntities.map(entity => {
            const imgUrl = entity.image_url || getOptimalEntityImageUrl(entity as any);
            const typeBg: Record<string, string> = {
              place: 'bg-emerald-100 dark:bg-emerald-900/40',
              food: 'bg-orange-100 dark:bg-orange-900/40',
              movie: 'bg-violet-100 dark:bg-violet-900/40',
              book: 'bg-blue-100 dark:bg-blue-900/40',
              product: 'bg-pink-100 dark:bg-pink-900/40',
            };
            return (
              <span
                key={entity.id}
                className="inline-flex items-center gap-1.5 h-8 rounded-full border border-primary/20 bg-primary/5 text-foreground pl-1 pr-1 text-xs transition-colors"
              >
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span
                    className={`inline-flex items-center justify-center h-5 w-5 rounded-full flex-shrink-0 text-[10px] ${typeBg[entity.type] || 'bg-muted'}`}
                  >
                    {getEntityIcon(entity.type)}
                  </span>
                )}
                <span className="font-semibold truncate max-w-[160px]">{entity.name}</span>
                <button
                  type="button"
                  onClick={() => removeEntity(entity.id)}
                  aria-label={`Remove ${entity.name}`}
                  className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Max reached message */}
      {isMaxReached && (
        <p className="text-xs text-muted-foreground">You've selected {maxEntities} entities. Remove one to add another.</p>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
              isModal ? 'left-4 h-5 w-5' : 'left-2.5 h-4 w-4'
            }`}
          />
          <Input
            ref={inputRef}
            placeholder="Search for places, products, books, movies..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowResults(true)}
            autoFocus={autoFocusSearch}
            className={
              isModal
                ? 'h-12 pl-12 pr-10 rounded-full bg-muted/40 border-border/60 text-base focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40'
                : 'pl-8 pr-8'
            }
            disabled={isMaxReached}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setShowResults(false);
                inputRef.current?.focus();
              }}
              className={`absolute top-1/2 -translate-y-1/2 rounded-full hover:bg-muted ${
                isModal ? 'right-3 p-1' : 'right-2 p-0.5'
              }`}
              type="button"
              aria-label="Clear search"
            >
              <X className={isModal ? 'h-4 w-4 text-muted-foreground' : 'h-3.5 w-3.5 text-muted-foreground'} />
            </button>
          )}
        </div>

        {/* Location indicator: subtle link when OFF, dismissible pill when ON */}
        {showLocationToggle && (
          <div className="flex items-center gap-2 mt-2 min-h-[24px]">
            {locationActive ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
                title="Results are biased toward your current location for this search."
              >
                <Navigation className="h-3 w-3" />
                <span>Using your location</span>
                <button
                  type="button"
                  onClick={handleDisableLocationInSession}
                  className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5"
                  aria-label="Stop using my location for this search"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEnableLocationInSession}
                disabled={
                  !isGeolocationSupported || geoLoading || permissionStatus === 'denied'
                }
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  permissionStatus === 'denied'
                    ? 'Location permission was denied. Update your browser settings to enable.'
                    : 'Show nearby places first'
                }
              >
                <Navigation
                  className={`h-3 w-3 ${geoLoading ? 'animate-pulse' : ''}`}
                />
                <span className="underline-offset-2 hover:underline">
                  {geoLoading ? 'Getting location…' : 'Use my location'}
                </span>
              </button>
            )}
          </div>
        )}


        {/* Results — inline (flat) in modal variant, floating dropdown in inline variant */}
        {showResults && (
          <div
            ref={resultsRef}
            className={
              isModal
                ? 'mt-2 w-full min-w-0 max-h-[460px] overflow-y-auto overflow-x-hidden'
                : 'absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto'
            }
          >
            {/* Recent searches — shown when input is empty / under 2 chars */}
            {searchQuery.trim().length < 2 && (
              <RecentSearchesPanel
                recents={recents}
                onPick={(q, item) => {
                  // Entity-kind recent: add directly as a tag chip
                  if (item?.kind === 'entity' && item.entityId) {
                    if (isMaxReached) return;
                    if (selectedEntities.some(e => e.id === item.entityId)) return;

                    const adapter: EntityAdapter = {
                      id: item.entityId,
                      name: item.query,
                      type: item.entityType || 'other',
                    };
                    const newEntities = [...selectedEntities, adapter];
                    setSelectedEntities(newEntities);
                    onEntitiesChange(newEntities);
                    return;
                  }

                  // Query-kind recent: fill search input (existing behavior)
                  setSearchQuery(q);
                  setDebouncedQuery(q);
                  setShowResults(true);
                  inputRef.current?.focus();
                }}
                onRemove={removeRecent}
                onClearAll={clearRecents}
              />
            )}

            {searchQuery.length >= 2 && (
              <>
                {/* Loading */}
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </div>
                )}

                {/* Creating entity */}
                {isCreatingEntity && (
                  <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground border-b">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adding entity...</span>
                  </div>
                )}

                {/* Ranked categories (collapsed) */}
                {(() => {
                  const visibleCats = collapsed.filter((c) => c.visible.length > 0);
                  return visibleCats.map((cat, catIdx) => {
                    const title = categoryTitle[cat.key] || cat.key;
                    const total = cat.visible.length + cat.hidden.length;
                    const isFirst = catIdx === 0;

                    // People: render as @mention rows (no entity-add).
                    if (cat.key === 'people') {
                      return (
                        <div key={cat.key}>
                          {renderSectionHeader(title, total, isFirst)}
                          {cat.visible.map((user: any) => (
                            <div
                              key={user.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
                              onClick={() => handlePeopleClick(user)}
                            >
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium overflow-hidden">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt={user.username || ''} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(user.username || '?')[0].toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">
                                  <HighlightMatch text={user.username || ''} query={searchQuery} />
                                </div>
                                {user.username && (
                                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                                )}
                              </div>
                              <span className="text-xs text-primary">@mention</span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    const isExpanded = !!dropdownShowAll[cat.key];
                    const itemsToRender = isExpanded ? [...cat.visible, ...cat.hidden] : cat.visible;

                    return (
                      <div key={cat.key}>
                        {renderSectionHeader(title, total, isFirst, cat.key, cat.hidden.length)}
                      {itemsToRender.map((item: any, rowIdx: number) => {
                        const flatIdx = flatIndexFor(cat.key, rowIdx);
                        const isTop = flatIdx === 0;
                        const isActive = flatIdx === activeIdx;
                        const onPick =
                          cat.key === 'entities'
                            ? () =>
                                handleEntitySelect({
                                  id: item.id,
                                  name: item.name,
                                  type: item.type,
                                  image_url: item.image_url || undefined,
                                  description: item.description || undefined,
                                  venue: item.venue || undefined,
                                })
                            : () => handleExternalSelect({ ...item, type: item.type || cat.key.replace(/s$/, '') });
                        return renderEntityRow(
                          { ...item, type: item.type || cat.key.replace(/s$/, '') },
                          onPick,
                          cat.key === 'entities' ? isMaxReached : isMaxReached || isCreatingEntity,
                          { isTop, isActive },
                        );
                      })}
                      {cat.hidden.length > 0 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-1 text-xs text-brand-orange font-medium hover:text-brand-orange/80 hover:bg-accent/20 px-3 py-1.5 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropdownToggle(cat.key, cat.hidden.length);
                          }}
                        >
                          {isExpanded ? (
                            <>See less <ChevronUp className="w-3 h-3" /></>
                          ) : (
                            <>See {cat.hidden.length} more results <ChevronDown className="w-3 h-3" /></>
                          )}
                        </button>
                      )}
                    </div>
                  );
                });
                })()}
              </>
            )}

            {/* "Did you mean?" + Add Entity section */}
            {showAddEntity && (
              <div className="border-t">
                {hasSimilarResults && localEntities.length > 0 && (
                  <div className="px-3 py-1.5 bg-accent/30">
                    <p className="text-xs text-muted-foreground">
                      Did you mean one of the results above?
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-primary hover:bg-accent/30 transition-colors"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Add "{searchQuery.trim()}" as a new entity</span>
                </button>
              </div>
            )}

            {/* No results */}
            {!isLoading && !hasAnyResults && searchQuery.length >= 2 && (
              <div className="p-3 text-center">
                <p className="text-sm text-muted-foreground mb-2">No results found</p>
                {searchQuery.trim().length >= 3 && !isMaxReached && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline flex items-center justify-center gap-1 w-full"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add "{searchQuery.trim()}" as a new entity
                  </button>
                )}
              </div>
            )}

            {/* External search still loading indicator */}
            {searchQuery.length >= 2 && loadingStates.external && !loadingStates.local && (
              <div className="flex items-center justify-center gap-2 p-2 text-xs text-muted-foreground border-t">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Searching more sources...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Entity Dialog */}
      <CreateEntityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onEntityCreated={handleEntityCreated}
        variant="user"
        showPreviewTab={false}
        prefillName={searchQuery.trim()}
      />
    </div>
  );
}
