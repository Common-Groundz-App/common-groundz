import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, Search, Plus, Navigation } from 'lucide-react';
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
}: UnifiedEntitySelectorProps) {
  const [selectedEntities, setSelectedEntities] = useState<EntityAdapter[]>(initialEntities);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [showResults, setShowResults] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const isCreatingRef = useRef(false);

  const { results, isLoading, loadingStates } = useEnhancedRealtimeSearch(debouncedQuery);
  const {
    position,
    locationEnabled,
    enableLocation,
    disableLocation,
    isLoading: geoLoading,
    permissionStatus,
    formatDistance
  } = useLocation();

  const isMaxReached = selectedEntities.length >= maxEntities;

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

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        resultsRef.current && !resultsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select a local entity
  const handleEntitySelect = useCallback((entity: EntityAdapter) => {
    if (isMaxReached) return;
    if (selectedEntities.some(e => e.id === entity.id)) return;
    const newEntities = [...selectedEntities, entity];
    setSelectedEntities(newEntities);
    onEntitiesChange(newEntities);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowResults(false);
  }, [selectedEntities, isMaxReached, onEntitiesChange]);

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

  // Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Try to select first eligible entity result
      const firstEntity = results.entities?.[0];
      if (firstEntity && !isMaxReached) {
        handleEntitySelect({
          id: firstEntity.id,
          name: firstEntity.name,
          type: firstEntity.type,
          image_url: firstEntity.image_url || undefined,
          description: firstEntity.description || undefined,
          venue: firstEntity.venue || undefined,
        });
        return;
      }
      // No results and query >= 3 chars → open create dialog
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

  // Recent searches (composer surface)
  const { recents, addRecent, removeRecent, clearRecents } = useRecentSearches('composer');

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

  // Section rendering helper
  const renderSectionHeader = (title: string, count: number) => (
    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {count > MAX_RESULTS_PER_CATEGORY && (
        <span className="text-xs text-muted-foreground">{count} results</span>
      )}
    </div>
  );

  const renderEntityRow = (entity: any, onClick: () => void, isDisabled = false) => (
    <div
      key={entity.id || `${entity.api_source}-${entity.api_ref}`}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/30'
      }`}
      onClick={isDisabled ? undefined : onClick}
    >
      <div className="flex-shrink-0">
        <ImageWithFallback
          src={getImageUrl(entity)}
          alt={entity.name}
          className="w-8 h-8 object-cover rounded"
          fallbackSrc={getEntityTypeFallbackImage(entity.type || 'product')}
          entityType={entity.type}
          suppressConsoleErrors
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          <HighlightMatch text={entity.name} query={searchQuery} />
        </div>
        {entity.venue && (
          <div className="text-xs text-muted-foreground truncate">{entity.venue}</div>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{getEntityIcon(entity.type || 'product')}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Selected entities as badges */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntities.map(entity => (
            <Badge
              key={entity.id}
              variant="outline"
              className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs bg-accent/30"
            >
              <span>{getEntityIcon(entity.type)}</span>
              <span>{entity.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 rounded-full hover:bg-muted"
                onClick={() => removeEntity(entity.id)}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Max reached message */}
      {isMaxReached && (
        <p className="text-xs text-muted-foreground">You can add up to {maxEntities} tags</p>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search for places, products, books, movies..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) setShowResults(true);
              else setShowResults(false);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchQuery.length >= 2) setShowResults(true); }}
            autoFocus={autoFocusSearch}
            className="pl-8 pr-8"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
              type="button"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Location toggle */}
        {showLocationToggle && (
          <div className="flex items-center gap-2 mt-1.5">
            <Button
              type="button"
              variant={locationEnabled ? 'secondary' : 'outline'}
              size="sm"
              className="flex items-center gap-1 text-xs h-6"
              onClick={() => locationEnabled ? disableLocation() : enableLocation()}
              disabled={geoLoading || permissionStatus === 'denied'}
            >
              <Navigation className={`h-3 w-3 ${geoLoading ? 'animate-pulse' : ''}`} />
              {geoLoading ? 'Getting location...' : locationEnabled ? 'Near me' : 'Use my location'}
            </Button>
          </div>
        )}

        {/* Results dropdown */}
        {showResults && searchQuery.length >= 2 && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto"
          >
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

            {/* Local entities — "On Groundz" */}
            {localEntities.length > 0 && (
              <div>
                {renderSectionHeader('✨ On Groundz', localEntities.length)}
                {localEntities.slice(0, MAX_RESULTS_PER_CATEGORY).map(entity =>
                  renderEntityRow(
                    entity,
                    () => handleEntitySelect({
                      id: entity.id,
                      name: entity.name,
                      type: entity.type,
                      image_url: entity.image_url || undefined,
                      description: entity.description || undefined,
                      venue: entity.venue || undefined,
                    }),
                    isMaxReached
                  )
                )}
              </div>
            )}

            {/* Books */}
            {books.length > 0 && (
              <div>
                {renderSectionHeader('📚 Books', books.length)}
                {books.slice(0, MAX_RESULTS_PER_CATEGORY).map((book, i) =>
                  renderEntityRow(
                    { ...book, type: 'book' },
                    () => handleExternalSelect({ ...book, type: 'book' }),
                    isMaxReached || isCreatingEntity
                  )
                )}
              </div>
            )}

            {/* Movies */}
            {movies.length > 0 && (
              <div>
                {renderSectionHeader('🎬 Movies', movies.length)}
                {movies.slice(0, MAX_RESULTS_PER_CATEGORY).map((movie, i) =>
                  renderEntityRow(
                    { ...movie, type: 'movie' },
                    () => handleExternalSelect({ ...movie, type: 'movie' }),
                    isMaxReached || isCreatingEntity
                  )
                )}
              </div>
            )}

            {/* Places */}
            {places.length > 0 && (
              <div>
                {renderSectionHeader('📍 Places', places.length)}
                {places.slice(0, MAX_RESULTS_PER_CATEGORY).map((place, i) =>
                  renderEntityRow(
                    { ...place, type: 'place' },
                    () => handleExternalSelect({ ...place, type: 'place' }),
                    isMaxReached || isCreatingEntity
                  )
                )}
              </div>
            )}

            {/* People — click inserts @mention */}
            {people.length > 0 && (
              <div>
                {renderSectionHeader('👥 People', people.length)}
                {people.slice(0, MAX_RESULTS_PER_CATEGORY).map(user => (
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
            {loadingStates.external && !loadingStates.local && (
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
