import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import SEOHead from '@/components/seo/SEOHead';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { RecentSearchesPanel } from '@/components/search/RecentSearchesPanel';
import { useEntityCache } from '@/hooks/use-entity-cache';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { PillTabs } from '@/components/ui/pill-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { ReviewResultItem } from '@/components/search/ReviewResultItem';
import { RecommendationResultItem } from '@/components/search/RecommendationResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { cn } from '@/lib/utils';
import { Search as SearchIcon, Users, MapPin, Film, Book, ShoppingBag, AlertCircle, Loader2, Star, Globe, ChevronDown, ChevronUp, Hash, Plus, X } from 'lucide-react';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { Badge } from '@/components/ui/badge';
import { getRandomLoadingMessage, type EntityCategory } from '@/utils/loadingMessages';
import { CreateEntityDialog } from '@/components/admin/CreateEntityDialog';
import { useToast } from '@/hooks/use-toast';
import {
  dedupeResults,
  rankCategories,
  applyExactMatchOverride,
  softCollapse,
} from '@/utils/searchRanking';
import type { UnifiedSearchResults } from '@/hooks/use-unified-search';

// Locale-safe query normalization (handles Turkish "İ"/"i" and other locale quirks)
const normalize = (q: string) => q.trim().toLocaleLowerCase();

// Ordered classification for items in the merged "local results" list.
// Order matters: review/recommendation BEFORE user, because reviews/recs may
// also carry user-shaped fields and would otherwise be mis-rendered as users.
type LocalItemKind = 'review' | 'recommendation' | 'entity' | 'user' | 'unknown';

const classifyLocalItem = (item: any): LocalItemKind => {
  if (!item || typeof item !== 'object') return 'unknown';
  // Reviews: have entity_id + rating + (title or description)
  if ('entity_id' in item && 'rating' in item && ('title' in item || 'description' in item)) {
    return 'review';
  }
  // Recommendations: have entity_id + title, but no rating
  if ('entity_id' in item && 'title' in item && !('rating' in item)) {
    return 'recommendation';
  }
  // Entities: have name + type, but no entity_id (they ARE the entity)
  if ('name' in item && 'type' in item && !('entity_id' in item)) {
    return 'entity';
  }
  // Users: fall through last — username can appear on review authors etc.
  if ('username' in item) {
    return 'user';
  }
  return 'unknown';
};

const Search = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsMobile(630); // Custom breakpoint for pill tabs
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = searchParams.get('q') || '';
  const mode = searchParams.get('mode') || 'quick';
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState('all');
  const [isDeepSearching, setIsDeepSearching] = useState(mode === 'deep');

  // Keep input ↔ URL in sync (initial load, back/forward, pasted links)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  // State for "show all" functionality (page-results section)
  const [showAllStates, setShowAllStates] = useState({
    localResults: false,
    externalResults: false,
    users: false
  });

  // Create entity dialog state
  const [showCreateEntityDialog, setShowCreateEntityDialog] = useState(false);
  const [createEntityQuery, setCreateEntityQuery] = useState('');

  // Page-level entity processing (overlay for external picks)
  const [isProcessingEntity, setIsProcessingEntity] = useState(false);
  const [processingEntityName, setProcessingEntityName] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');

  // Dropdown state for search suggestions — focus-gated with single-Escape dismissal
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownDismissed, setIsDropdownDismissed] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrefetchedSlugRef = useRef<string | null>(null);
  const isComposingRef = useRef(false); // IME composition guard

  // Per-category inline expand state — uses canonical ranking keys
  const initialDropdownExpansion: Record<string, boolean> = {
    entities: false,
    books: false,
    movies: false,
    places: false,
    users: false,
    hashtags: false,
  };
  const [dropdownShowAll, setDropdownShowAll] = useState<Record<string, boolean>>(initialDropdownExpansion);

  const handleDropdownToggle = useCallback((key: string, hiddenCount: number) => {
    if (hiddenCount === 0) return; // defensive guard
    setDropdownShowAll((prev) => ({ ...prev, [key]: !prev[key] }));
    setHighlightedIdx(() => -1);
  }, []);

  // Recent searches — shared 'explore' bucket with /explore page
  const { recents, addRecent, removeRecent, clearRecents } = useRecentSearches('explore');

  // Entity prefetch (TanStack Query cache)
  const { prefetchEntity } = useEntityCache({ slugOrId: '', enabled: false });

  const schedulePrefetch = useCallback((slug?: string) => {
    if (!slug || slug === lastPrefetchedSlugRef.current) return;
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      prefetchEntity(slug);
      lastPrefetchedSlugRef.current = slug;
    }, 80);
  }, [prefetchEntity]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  const { toast } = useToast();

  // Tab items configuration matching Explore page
  const tabItems = [
    { value: 'all', label: 'All', emoji: '🌟' },
    { value: 'hashtags', label: 'Hashtags', emoji: '#️⃣' },
    { value: 'movies', label: 'Movies', emoji: '🎬' },
    { value: 'books', label: 'Books', emoji: '📚' },
    { value: 'places', label: 'Places', emoji: '📍' },
    { value: 'products', label: 'Products', emoji: '🛍️' },
    { value: 'users', label: 'People', emoji: '👥' }
  ];

  const tubelightTabItems = [
    { value: 'all', label: 'All', icon: Star },
    { value: 'hashtags', label: 'Hashtags', icon: Hash },
    { value: 'movies', label: 'Movies', icon: Film },
    { value: 'books', label: 'Books', icon: Book },
    { value: 'places', label: 'Places', icon: MapPin },
    { value: 'products', label: 'Products', icon: ShoppingBag },
    { value: 'users', label: 'People', icon: Users }
  ];

  // SINGLE realtime search hook — drives both dropdown AND page results.
  // Keyed off `searchQuery` (which stays in sync with URL ?q=).
  const {
    results,
    isLoading,
    loadingStates,
    error,
    showAllResults,
    toggleShowAll,
    searchMode,
    refetch
  } = useEnhancedRealtimeSearch(searchQuery, { mode: mode as 'quick' | 'deep' });

  // Trimmed query — reused everywhere
  const trimmedQuery = searchQuery.trim();

  // Reset expansion + highlight when query changes (skip during IME composition)
  useEffect(() => {
    if (isComposingRef.current) return;
    setDropdownShowAll(initialDropdownExpansion);
    setHighlightedIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  // Reset expansion when route changes (defensive)
  useEffect(() => {
    setDropdownShowAll(initialDropdownExpansion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Reset last-prefetched slug when query changes so same-named entity re-prefetches in new results
  useEffect(() => {
    lastPrefetchedSlugRef.current = null;
  }, [trimmedQuery]);

  // Ranking pipeline for dropdown — gated on trimmed query to prevent stale-flicker
  const collapsed = useMemo(() => {
    if (trimmedQuery.length < 1) return null;
    const externalAll = dedupeResults(
      [
        ...(results.categorized?.books || []).map((b: any) => ({ ...b, type: 'book' })),
        ...(results.categorized?.movies || []).map((m: any) => ({ ...m, type: 'movie' })),
        ...(results.categorized?.places || []).map((p: any) => ({ ...p, type: 'place' })),
      ],
      trimmedQuery,
    );
    const dedupedBooks = externalAll.filter((r) => r.type === 'book');
    const dedupedMovies = externalAll.filter((r) => r.type === 'movie');
    const dedupedPlaces = externalAll.filter((r) => r.type === 'place');
    const dedupedLocal = dedupeResults(results.entities || [], trimmedQuery);

    const ranked = rankCategories(
      {
        entities: dedupedLocal,
        places: dedupedPlaces,
        books: dedupedBooks,
        movies: dedupedMovies,
        users: results.users || [],
      },
      trimmedQuery,
    );
    const overridden = applyExactMatchOverride(ranked, trimmedQuery);
    return softCollapse(overridden);
  }, [trimmedQuery, results.entities, results.categorized, results.users]);

  // Update the URL when search query changes
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmedQuery.length >= 1) {
      // Save typed query as a recent before navigating
      addRecent(trimmedQuery, 'query');
      setSearchParams({ q: trimmedQuery, mode: 'quick' });
      setIsDropdownDismissed(true);
    }
  };

  // Handle search input changes — dismissed flag resets so user can keep typing after Escape
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsDropdownDismissed(false);
    setHighlightedIdx(-1);
  };

  // Pick a recent: entity → deep-link with fallback state; query → fill input + run search
  const handlePickRecent = (q: string, item?: { kind?: string; entityId?: string; slug?: string }) => {
    if (item?.kind === 'entity' && item.slug) {
      navigate(`/entity/${item.slug}`, {
        state: { fallbackQuery: q, fallbackEntityId: item.entityId },
      });
      setIsFocused(false);
      setHighlightedIdx(-1);
      return;
    }
    setSearchQuery(q);
    setSearchParams({ q, mode: 'quick' });
    setIsDropdownDismissed(true);
    setHighlightedIdx(-1);
  };

  // Click on a local entity row → record recent + navigate to entity page
  const handleEntityClick = (entity: { id: string; type?: string; name: string; slug?: string }) => {
    addRecent(entity.name, 'entity', {
      entityId: entity.id,
      entityType: entity.type,
      slug: entity.slug,
    });
    setIsDropdownDismissed(true);
    setIsFocused(false);
    setHighlightedIdx(-1);
    if (entity.slug) {
      navigate(`/entity/${entity.slug}`);
    }
  };

  // Page-level processing handlers (mirror Explore)
  const handleProcessingStart = (entityName: string, message: string) => {
    // Dismiss dropdown to avoid overlay/dropdown overlap
    setIsDropdownDismissed(true);
    setIsFocused(false);
    setIsProcessingEntity(true);
    setProcessingEntityName(entityName);
    setProcessingMessage(message);
  };

  const handleProcessingUpdate = (message: string) => {
    setProcessingMessage(message);
  };

  const handleProcessingEnd = () => {
    setIsProcessingEntity(false);
    setProcessingEntityName('');
    setProcessingMessage('');
  };

  const handleCancelProcessing = () => {
    setIsProcessingEntity(false);
    setProcessingEntityName('');
    setProcessingMessage('');
  };

  // Helper function to get the display name from different result types
  const getResultDisplayName = (item: any): string => {
    if ('name' in item) return item.name;
    if ('title' in item) return item.title;
    return 'Unknown';
  };

  // Handle deep search request
  const handleDeepSearch = () => {
    if (query.trim().length >= 2) {
      setIsDeepSearching(true);
      setSearchParams({ q: query, mode: 'deep' });
    }
  };

  // Handle "View All" button clicks (page-results)
  const handleViewAll = (section: keyof typeof showAllStates) => {
    if (section === 'users') {
      setActiveTab('users');
    } else {
      setShowAllStates(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    }
  };

  // (legacy `handleDropdownViewAll` removed — use `handleDropdownToggle` defined above)

  // Filter results based on active tab using backend categorization (page-results)
  const getFilteredResults = () => {
    const allLocalResults = [
      ...results.entities,
      ...results.reviews,
      ...results.recommendations
    ];

    const categorizedProducts = {
      movies: results.categorized?.movies || [],
      books: results.categorized?.books || [],
      places: results.categorized?.places || [],
      products: results.products.filter(p => {
        const movieRefs = (results.categorized?.movies || []).map(item => item.api_ref);
        const bookRefs = (results.categorized?.books || []).map(item => item.api_ref);
        const placeRefs = (results.categorized?.places || []).map(item => item.api_ref);
        return !movieRefs.includes(p.api_ref) &&
               !bookRefs.includes(p.api_ref) &&
               !placeRefs.includes(p.api_ref);
      })
    };

    switch (activeTab) {
      case 'hashtags':
        return { localResults: [], externalResults: [], hashtags: results.hashtags || [] };
      case 'movies':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'movie') return true;
            if ('category' in item && item.category === 'movie') return true;
            return false;
          }),
          externalResults: categorizedProducts.movies,
          hashtags: []
        };
      case 'books':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'book') return true;
            if ('category' in item && item.category === 'book') return true;
            return false;
          }),
          externalResults: categorizedProducts.books,
          hashtags: []
        };
      case 'places':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'place') return true;
            if ('category' in item && item.category === 'place') return true;
            return false;
          }),
          externalResults: categorizedProducts.places,
          hashtags: []
        };
      case 'products':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'product') return true;
            if ('category' in item && item.category === 'product') return true;
            return false;
          }),
          externalResults: categorizedProducts.products,
          hashtags: []
        };
      case 'users':
        return { localResults: [], externalResults: [], users: results.users, hashtags: [] };
      default:
        return {
          localResults: allLocalResults,
          externalResults: results.products,
          users: results.users,
          hashtags: results.hashtags || []
        };
    }
  };

  const filteredResults = getFilteredResults();

  // Enhanced loading screen with category-based loading facts
  const renderEnhancedLoadingState = () => {
    const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);
    const getCategoryForFacts = (): EntityCategory => {
      switch (activeTab) {
        case 'movies': return 'movie';
        case 'books': return 'book';
        case 'places': return 'place';
        case 'products': return 'product';
        default: return 'product';
      }
    };
    const loadingFact = getRandomLoadingMessage(getCategoryForFacts());

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
        </div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          🔍 {searchMode === 'deep' ? 'Deep searching' : 'Searching'} for "{capitalizedQuery}"
        </h2>
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">{loadingFact}</p>
          {searchMode === 'deep' && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                📚 Books {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                🎬 Movies {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                📍 Places {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant="default" className="text-xs">
                🛍️ Products <Loader2 className="w-3 h-3 ml-1 animate-spin" />
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to render mixed local results (page-results section)
  const renderLocalResultItem = (item: any) => {
    if ('username' in item) {
      return <UserResultItem key={item.id} user={item} onClick={() => {}} />;
    } else if ('entity_id' in item && 'rating' in item && 'title' in item && 'description' in item) {
      return <ReviewResultItem key={item.id} review={item} onClick={() => {}} />;
    } else if ('entity_id' in item && 'title' in item && !('rating' in item)) {
      return <RecommendationResultItem key={item.id} recommendation={item} onClick={() => {}} />;
    } else if ('name' in item && 'type' in item) {
      return <EntityResultItem key={item.id} entity={item} onClick={() => {}} />;
    }
    return null;
  };

  // Render search dropdown — focus-gated, with Escape dismissal flag
  const shouldShowDropdown =
    isFocused &&
    !isDropdownDismissed &&
    (trimmedQuery.length >= 1 || recents.length > 0);

  // Cancel queued prefetch when dropdown closes
  useEffect(() => {
    if (!shouldShowDropdown && prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, [shouldShowDropdown]);

  // Build flat keyboard-navigable list — recents first, then ranked categories
  const showRecentsBranch = trimmedQuery.length < 1 && recents.length > 0;

  type FlatItem =
    | { kind: 'recent'; query: string; entityKind?: 'query' | 'entity'; entityId?: string; slug?: string }
    | { kind: 'entity'; entityId: string; entityType?: string; name: string; slug?: string }
    | { kind: 'user'; userId: string }
    | { kind: 'external'; categoryKey: string; itemRef: any; slug?: string }
    | { kind: 'hashtag'; nameNorm: string; nameOriginal: string };

  const flatKeyboardItems: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    if (showRecentsBranch) {
      recents.slice(0, 6).forEach((r) =>
        out.push({
          kind: 'recent',
          query: r.query,
          entityKind: r.kind,
          entityId: r.entityId,
          slug: r.slug,
        }),
      );
    }
    if (trimmedQuery.length >= 1 && collapsed) {
      collapsed.forEach((cat) => {
        if (cat.visible.length === 0) return;
        if (cat.key === 'users') {
          cat.visible.forEach((u: any) => out.push({ kind: 'user', userId: u.id }));
        } else if (cat.key === 'entities') {
          cat.visible.forEach((e: any) =>
            out.push({
              kind: 'entity',
              entityId: e.id,
              entityType: e.type,
              name: e.name,
              slug: e.slug,
            }),
          );
        } else {
          cat.visible.forEach((it: any) =>
            out.push({ kind: 'external', categoryKey: cat.key, itemRef: it, slug: it.slug }),
          );
        }
      });
      // Hashtags — kept separate from ranking pipeline
      (results.hashtags || []).slice(0, 3).forEach((h: any) =>
        out.push({ kind: 'hashtag', nameNorm: h.name_norm, nameOriginal: h.name_original }),
      );
    }
    return out;
  }, [showRecentsBranch, recents, trimmedQuery, collapsed, results.hashtags]);

  // Reset highlight when context changes
  useEffect(() => {
    setHighlightedIdx(-1);
  }, [trimmedQuery, isFocused, isDropdownDismissed]);

  // Prefetch entity for currently highlighted entity-like item
  useEffect(() => {
    if (highlightedIdx < 0) return;
    const item = flatKeyboardItems[highlightedIdx];
    if (!item) return;
    if (item.kind === 'entity' && item.slug) schedulePrefetch(item.slug);
    if (item.kind === 'recent' && item.entityKind === 'entity' && item.slug) {
      schedulePrefetch(item.slug);
    }
  }, [highlightedIdx, flatKeyboardItems, schedulePrefetch]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME composition guard — do not handle nav keys while composing
    if (isComposingRef.current || (e.nativeEvent as any).isComposing) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownDismissed(true);
      setHighlightedIdx(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (flatKeyboardItems.length === 0) return;
      e.preventDefault();
      setHighlightedIdx((idx) => (idx + 1) % flatKeyboardItems.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (flatKeyboardItems.length === 0) return;
      e.preventDefault();
      setHighlightedIdx((idx) => (idx <= 0 ? flatKeyboardItems.length - 1 : idx - 1));
      return;
    }
    if (e.key === 'Enter') {
      const active = highlightedIdx >= 0 ? flatKeyboardItems[highlightedIdx] : null;
      if (active) {
        e.preventDefault();
        if (active.kind === 'recent') {
          handlePickRecent(active.query, {
            kind: active.entityKind,
            entityId: active.entityId,
            slug: active.slug,
          });
          return;
        }
        if (active.kind === 'entity') {
          handleEntityClick({
            id: active.entityId,
            type: active.entityType,
            name: active.name,
            slug: active.slug,
          });
          return;
        }
        if (active.kind === 'hashtag') {
          navigate(`/t/${active.nameNorm}`);
          setIsDropdownDismissed(true);
          setIsFocused(false);
          return;
        }
        // user / external → fall through to default form submit
      }
      // No actionable highlight — let form's onSubmit run
    }
  };

  const dropdownId = 'search-dropdown';
  const activeOptionId =
    shouldShowDropdown && highlightedIdx >= 0 ? `search-opt-${highlightedIdx}` : undefined;

  // Map category key → display title for ranked render
  const dropdownCategoryTitle: Record<string, string> = {
    entities: '✨ Already on Groundz',
    places: '📍 Places',
    books: '📚 Books',
    movies: '🎬 Movies',
    users: '👥 People',
  };

  // Section header (matches Explore visual)
  const renderSectionHeader = (
    title: string,
    count: number,
    categoryKey?: string,
    hiddenCount: number = 0,
  ) => (
    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span>{title} ({count})</span>
      <div className="flex items-center gap-2">
        {categoryKey && hiddenCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-brand-orange font-semibold hover:text-brand-orange/80"
            onMouseDown={(e) => e.preventDefault()}
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
        )}
      </div>
    </div>
  );

  // "Show N more in full search" → run the URL search
  const handleShowMoreInFullSearch = () => {
    if (trimmedQuery.length >= 1) {
      addRecent(trimmedQuery, 'query');
      setSearchParams({ q: trimmedQuery, mode: 'quick' });
      setIsDropdownDismissed(true);
    }
  };

  // Render search dropdown
  const renderSearchDropdown = () => {
    if (!shouldShowDropdown) return null;

    return (
      <div
        id={dropdownId}
        role="listbox"
        aria-label="Search suggestions"
        className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-lg shadow-xl mt-1 max-h-[70vh] overflow-y-auto animate-in fade-in-0 slide-in-from-top-1 duration-150"
      >
        {showRecentsBranch && (
          <RecentSearchesPanel
            recents={recents}
            onPick={(q, item) =>
              handlePickRecent(q, {
                kind: item?.kind,
                entityId: item?.entityId,
                slug: item?.slug,
              })
            }
            onRemove={removeRecent}
            onClearAll={clearRecents}
            highlightedIndex={
              highlightedIdx >= 0 && highlightedIdx < recents.slice(0, 6).length
                ? highlightedIdx
                : undefined
            }
            optionIdPrefix="search-opt"
          />
        )}

        {trimmedQuery.length >= 1 && (
          <>
            {/* Loading state */}
            {isLoading && (
              <div className="p-3 text-center border-b bg-background">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching with enhanced reliability...</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-3 text-center border-b bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Ranked categories (collapsed) */}
            {collapsed && (() => {
              // Compute global flat-row index across keyboard-nav items so highlight maps correctly
              let kbdIdx = showRecentsBranch ? recents.slice(0, 6).length : 0;
              return collapsed.map((cat) => {
                if (!cat.allItems?.length) return null; // empty guard
                const title = dropdownCategoryTitle[cat.key] || cat.key;
                const total = cat.allItems.length;
                const isExpanded = !!dropdownShowAll[cat.key];
                const itemsToRender = isExpanded ? cat.allItems : cat.visible;

                if (cat.key === 'users') {
                  return (
                    <div key={cat.key} className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader(title, total, cat.key, cat.hidden.length)}
                      {itemsToRender.map((u: any) => {
                        const myIdx = kbdIdx++;
                        return (
                          <div
                            key={u.id}
                            id={`search-opt-${myIdx}`}
                            role="option"
                            aria-selected={highlightedIdx === myIdx}
                            className={highlightedIdx === myIdx ? 'bg-accent/40' : ''}
                          >
                            <UserResultItem user={u} onClick={() => {}} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                if (cat.key === 'entities') {
                  return (
                    <div key={cat.key} className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader(title, total, cat.key, cat.hidden.length)}
                      {itemsToRender.map((entity: any) => {
                        const myIdx = kbdIdx++;
                        return (
                          <div
                            key={entity.id}
                            id={`search-opt-${myIdx}`}
                            role="option"
                            aria-selected={highlightedIdx === myIdx}
                            className={cn(
                              'cursor-pointer',
                              highlightedIdx === myIdx ? 'bg-accent/40' : '',
                            )}
                            onMouseEnter={() => schedulePrefetch(entity.slug)}
                            onClick={() =>
                              handleEntityClick({
                                id: entity.id,
                                type: entity.type,
                                name: entity.name,
                                slug: entity.slug,
                              })
                            }
                          >
                            <EntityResultItem entity={entity} onClick={() => {}} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // External: places / books / movies
                return (
                  <div key={cat.key} className="border-b last:border-b-0 bg-background">
                    {renderSectionHeader(title, total, cat.key, cat.hidden.length)}
                    {itemsToRender.map((item: any, idx: number) => {
                      const myIdx = kbdIdx++;
                      return (
                        <div
                          key={`${item.api_source}-${item.api_ref ?? idx}`}
                          id={`search-opt-${myIdx}`}
                          role="option"
                          aria-selected={highlightedIdx === myIdx}
                          className={highlightedIdx === myIdx ? 'bg-accent/40' : ''}
                          onMouseEnter={() => schedulePrefetch(item.slug)}
                        >
                          <SearchResultHandler
                            result={item}
                            query={trimmedQuery}
                            onClose={() => {
                              setIsDropdownDismissed(true);
                              setIsFocused(false);
                            }}
                            isProcessing={isProcessingEntity}
                            onProcessingStart={handleProcessingStart}
                            onProcessingUpdate={handleProcessingUpdate}
                            onProcessingEnd={handleProcessingEnd}
                            useExternalOverlay={true}
                          />
                        </div>
                      );
                    })}
                    {!isExpanded && cat.hidden.length > 0 && (
                      <button
                        type="button"
                        className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 px-3 py-1.5 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowMoreInFullSearch();
                        }}
                      >
                        Show {cat.hidden.length} more in full search
                      </button>
                    )}
                  </div>
                );
              });
            })()}

            {/* Hashtags (kept separate — not part of ranking pipeline) */}
            {results.hashtags?.length > 0 && (() => {
              // Recompute hashtag base index so option ids align with flatKeyboardItems
              let kbdIdx = showRecentsBranch ? recents.slice(0, 6).length : 0;
              if (collapsed) {
                collapsed.forEach((cat) => { kbdIdx += cat.visible.length; });
              }
              const isExpanded = !!dropdownShowAll['hashtags'];
              const hashtagsToRender = isExpanded ? results.hashtags : results.hashtags.slice(0, 3);
              const hiddenCount = Math.max(0, results.hashtags.length - 3);
              return (
                <div className="border-b last:border-b-0 bg-background">
                  {renderSectionHeader('# Hashtags', results.hashtags.length, 'hashtags', hiddenCount)}
                  {hashtagsToRender.map((hashtag: any) => {
                    const myIdx = kbdIdx++;
                    return (
                      <div
                        key={hashtag.id}
                        id={`search-opt-${myIdx}`}
                        role="option"
                        aria-selected={highlightedIdx === myIdx}
                        onClick={() => {
                          navigate(`/t/${hashtag.name_norm}`);
                          setIsDropdownDismissed(true);
                          setIsFocused(false);
                        }}
                        className={cn(
                          'flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
                          highlightedIdx === myIdx ? 'bg-accent/40' : '',
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-medium">#{hashtag.name_original}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {hashtag.post_count} posts
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Add Entity CTA — once at bottom when query ≥ 1 char */}
            <div className="p-3 text-center bg-muted/30 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Couldn't find "<span className="font-medium text-foreground">{trimmedQuery}</span>"?
              </p>
              <button
                type="button"
                className="text-sm text-brand-orange hover:text-brand-orange/80 font-medium flex items-center justify-center w-full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCreateEntityQuery(trimmedQuery);
                  setShowCreateEntityDialog(true);
                  setIsDropdownDismissed(true);
                  setIsFocused(false);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Entity
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <SEOHead noindex={true} title="Search — Common Groundz" />
      {/* Mobile Header - only show on screens smaller than xl */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start min-w-0">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar - only show on xl+ screens */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        </div>
        
        <div className={cn(
          "flex-1 min-w-0",
          "pt-16 xl:pt-0 xl:pl-64"
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8 min-w-0">
            <h1 className="text-3xl font-bold mb-6">Search</h1>
            
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2 min-w-0">
                <div className="relative flex-grow min-w-0">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for people, places, products..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onMouseDown={() => {
                      // Re-click into already-focused input → reopen dropdown if there's content
                      if (isFocused && (trimmedQuery.length >= 1 || recents.length > 0)) {
                        setIsDropdownDismissed(false);
                      }
                    }}
                    onFocus={() => {
                      if (blurTimerRef.current) {
                        clearTimeout(blurTimerRef.current);
                        blurTimerRef.current = null;
                      }
                      setIsFocused(true);
                      setIsDropdownDismissed(false);
                    }}
                    onBlur={() => {
                      blurTimerRef.current = setTimeout(() => {
                        setIsFocused(false);
                        setIsDropdownDismissed(false);
                        setHighlightedIdx(-1);
                      }, 150);
                    }}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={() => { isComposingRef.current = false; }}
                    onKeyDown={handleInputKeyDown}
                    role="combobox"
                    aria-expanded={shouldShowDropdown}
                    aria-controls={dropdownId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOptionId}
                    className="pl-10 pr-10 min-w-0"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setIsDropdownDismissed(false);
                        setHighlightedIdx(-1);
                        inputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                      type="button"
                      aria-label="Clear search query"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                  {renderSearchDropdown()}
                </div>
                <Button type="submit" className="flex-shrink-0">Search</Button>
              </div>
            </form>
            
            {query ? (
              <>
                {/* Responsive Navigation */}
                {isTablet ? (
                  <div className="mb-6 overflow-x-auto">
                    <PillTabs items={tabItems} activeTab={activeTab} onTabChange={setActiveTab} />
                  </div>
                ) : (
                  <div className="mb-6 overflow-x-auto">
                    <TubelightTabs
                      defaultValue={activeTab}
                      items={tubelightTabItems}
                      onValueChange={setActiveTab}
                      className="mb-6"
                    >
                      <TabsContent value={activeTab} />
                    </TubelightTabs>
                  </div>
                )}
                
                <div className="mt-6 min-w-0">
                  {isLoading || Object.values(loadingStates).some(Boolean) ? (
                    renderEnhancedLoadingState()
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="h-8 w-8 text-destructive mb-4" />
                      <p className="text-muted-foreground">{error}</p>
                    </div>
                  ) : (
                    <>
                      {activeTab === 'all' && (
                        <>
                          {/* Already on Groundz section */}
                          {filteredResults.localResults.length > 0 && (
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-500" /> Already on Groundz
                              </h2>
                              <div className="border rounded-md overflow-hidden min-w-0">
                                {(showAllStates.localResults ? filteredResults.localResults : filteredResults.localResults.slice(0, 5)).map((item) => renderLocalResultItem(item))}
                              </div>
                              {filteredResults.localResults.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button variant="outline" onClick={() => handleViewAll('localResults')}>
                                    {showAllStates.localResults ? 'Show less' : `View all ${filteredResults.localResults.length} items`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* All Items section */}
                          {filteredResults.externalResults.length > 0 && (
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Globe className="h-5 w-5" /> All Items
                              </h2>
                              <p className="text-sm text-muted-foreground mb-4">
                                Everything we found related to your search.
                              </p>
                              <div className="space-y-2 min-w-0">
                                {(showAllStates.externalResults ? filteredResults.externalResults : filteredResults.externalResults.slice(0, 8)).map((product, index) => (
                                  <SearchResultHandler
                                    key={`${product.api_source}-${product.api_ref || index}`}
                                    result={product}
                                    query={query}
                                  />
                                ))}
                              </div>
                              {filteredResults.externalResults.length > 8 && (
                                <div className="mt-4 text-center">
                                  <Button variant="outline" onClick={() => handleViewAll('externalResults')}>
                                    {showAllStates.externalResults ? 'Show less' : `View all ${filteredResults.externalResults.length} items`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* People section */}
                          {results.users.length > 0 && (
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" /> People
                              </h2>
                              <div className="border rounded-md overflow-hidden min-w-0">
                                {results.users.slice(0, 5).map((user) => (
                                  <UserResultItem key={user.id} user={user} onClick={() => {}} />
                                ))}
                              </div>
                              {results.users.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button variant="outline" onClick={() => handleViewAll('users')}>
                                    View all {results.users.length} people
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Add Entity CTA */}
                          {searchMode === 'quick' && (
                            <div className="mb-8 p-6 border border-dashed rounded-lg text-center bg-gradient-to-br from-muted/30 to-muted/10 min-w-0">
                              <h3 className="text-lg font-semibold mb-2">❓ Couldn't find what you're looking for?</h3>
                              <p className="text-sm text-muted-foreground mb-1 max-w-lg mx-auto">
                                Help us build the most comprehensive database by adding missing entities
                              </p>
                              <p className="text-xs text-muted-foreground/70 mb-4 max-w-lg mx-auto italic">
                                Contribute books, movies, places, products, and more to help other users discover great content
                              </p>
                              <Button
                                onClick={() => {
                                  setCreateEntityQuery(query);
                                  setShowCreateEntityDialog(true);
                                }}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entity
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      
                      {activeTab === 'movies' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Film className="h-5 w-5" /> Movies
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Movies
                                  </h3>
                                  <div className="space-y-2 min-w-0">
                                    {filteredResults.externalResults.map((movie, index) => (
                                      <SearchResultHandler
                                        key={`${movie.api_source}-${movie.api_ref || index}`}
                                        result={movie}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No movies found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}
                      
                      {activeTab === 'books' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Book className="h-5 w-5" /> Books
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Books
                                  </h3>
                                  <div className="space-y-2 min-w-0">
                                    {filteredResults.externalResults.map((book, index) => (
                                      <SearchResultHandler
                                        key={`${book.api_source}-${book.api_ref || index}`}
                                        result={book}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No books found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}
                      
                      {activeTab === 'places' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Places
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Places
                                  </h3>
                                  <div className="space-y-2 min-w-0">
                                    {filteredResults.externalResults.map((place, index) => (
                                      <SearchResultHandler
                                        key={`${place.api_source}-${place.api_ref || index}`}
                                        result={place}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No places found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}
                      
                      {activeTab === 'products' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" /> Products
                          </h2>
                          {searchMode === 'quick' && filteredResults.externalResults.length === 0 && (
                            <div className="mb-8 p-6 border border-dashed rounded-lg text-center bg-gradient-to-br from-muted/30 to-muted/10 min-w-0">
                              <h3 className="text-lg font-semibold mb-2">❓ Couldn't find what you're looking for?</h3>
                              <p className="text-sm text-muted-foreground mb-1 max-w-lg mx-auto">
                                Help us build the most comprehensive database by adding missing entities
                              </p>
                              <p className="text-xs text-muted-foreground/70 mb-4 max-w-lg mx-auto italic">
                                Contribute books, movies, places, products, and more to help other users discover great content
                              </p>
                              <Button
                                onClick={() => {
                                  setCreateEntityQuery(query);
                                  setShowCreateEntityDialog(true);
                                }}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entity
                              </Button>
                            </div>
                          )}
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) && (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Products
                                  </h3>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Click any result to create an entity and start reviewing!
                                  </p>
                                  <div className="space-y-2 min-w-0">
                                    {filteredResults.externalResults.map((product, index) => (
                                      <SearchResultHandler
                                        key={`${product.api_source}-${product.api_ref || index}`}
                                        result={product}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      
                      {activeTab === 'hashtags' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Hash className="h-5 w-5" /> Hashtags
                          </h2>
                          {filteredResults.hashtags && filteredResults.hashtags.length > 0 ? (
                            <div className="space-y-3 min-w-0">
                              {filteredResults.hashtags.map((hashtag) => (
                                <div
                                  key={hashtag.id}
                                  onClick={() => navigate(`/t/${hashtag.name_norm}`)}
                                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Hash className="w-5 h-5 text-primary" />
                                    <div>
                                      <p className="font-medium">#{hashtag.name_original}</p>
                                      <p className="text-sm text-muted-foreground">{hashtag.post_count} posts</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No hashtags found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}

                      {activeTab === 'users' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5" /> People
                          </h2>
                          {results.users.length > 0 ? (
                            <div className="border rounded-md overflow-hidden min-w-0">
                              {results.users.map((user) => (
                                <UserResultItem key={user.id} user={user} onClick={() => {}} />
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No people found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Enter a search term to find people, places, products and more</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Create Entity Dialog */}
      <CreateEntityDialog
        open={showCreateEntityDialog}
        onOpenChange={setShowCreateEntityDialog}
        onEntityCreated={() => {
          refetch();
          toast({
            title: "Entity created",
            description: "Your entity has been added successfully!",
          });
        }}
        variant="user"
        prefillName={createEntityQuery}
        showPreviewTab={false}
      />

      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>

      {/* Full-Screen Loading Overlay (mirrors Explore) */}
      {isProcessingEntity && (
        <div className="fixed inset-0 z-[100] pointer-events-auto">
          <div className="absolute inset-0 bg-white" />
          <div className="flex items-center justify-center h-full">
            <div className="bg-white border rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full animate-fade-in relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCancelProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
                </div>
                <div className="text-center space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">{processingEntityName}</h3>
                  <div className="flex items-center justify-center">
                    <span className="text-center leading-relaxed animate-fade-in text-sm text-muted-foreground px-4">
                      {processingMessage || '✨ Processing your selection...'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/80">Click X to cancel</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
