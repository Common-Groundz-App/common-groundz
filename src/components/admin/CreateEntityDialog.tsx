import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ContactInfoEditor } from './ContactInfoEditor';
import { BusinessHoursEditor } from './BusinessHoursEditor';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ParentEntitySelector } from './ParentEntitySelector';
import { Entity } from '@/services/recommendation/types';
import { setEntityParent } from '@/services/entityHierarchyService';
import { SimpleMediaUploadModal } from '@/components/entity-v4/SimpleMediaUploadModal';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { MediaItem } from '@/types/media';
import { uploadEntityMediaBatch } from '@/services/entityMediaService';
import { DynamicFieldGroup } from './DynamicFieldGroup';
import { entityTypeConfig, EntityFieldConfig } from '../../../shared/config/entityTypeConfig';
import { validateUrlForType, getSuggestedEntityType } from '@/config/urlPatterns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const MAX_MEDIA_ITEMS = 4;
import { Plus, Sparkles, Loader2, AlertTriangle, ExternalLink, X, Info, ArrowLeft, ArrowRight } from 'lucide-react';
import { getOrCreateTag } from '@/services/tagService';

import { EntityType } from '@/services/recommendation/types';
import { getEntityTypeLabel, getActiveEntityTypes } from '@/services/entityTypeHelpers';
import { Database } from '@/integrations/supabase/types';
import { CategorySelector } from './CategorySelector';
import { SimpleTagInput } from './SimpleTagInput';
import { AutoFillPreviewModal } from './AutoFillPreviewModal';
import { useAnalyzeUrlEngine } from '@/hooks/useAnalyzeUrlEngine';
import { useEntityReviewUsesDraft } from '@/hooks/useEntityReviewUsesDraft';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { DuplicateConfirmDialog, type DuplicateCandidate } from './entity-create/DuplicateConfirmDialog';
import { ExactUrlDuplicateDialog } from './entity-create/ExactUrlDuplicateDialog';
import { uploadEntityImage } from '@/services/entityImageService';
import type { BrandCandidate } from '@/types/entityDraft';
import { PostCreateContinuation, type CreatedEntitySummary } from './entity-create/PostCreateContinuation';
// Phase 3.5a — Search-to-Draft (additive, sits alongside URL flow).
import { SearchEntryPanel, type ExistingMatch as SearchExistingMatch } from './entity-create/SearchEntryPanel';
import { buildSearchPredictions, enrichBrandCandidatesWithExistingMatch, type SearchCandidatePayload } from './entity-create/applyEntityDraft';
import { useSearchToDraftEnabled } from '@/hooks/useSearchToDraftEnabled';
import { useSearchFunnel } from '@/hooks/useSearchFunnel';
import {
  mapCandidateSourceToInitial,
  mapCandidateSourceToMethod,
  pickUserRelevantMetadata,
  normalizeText,
  type SearchDraftSnapshot,
  type SearchFinalizationDiff,
  type FinalImageSource,
  type ImageMethod,
} from './entity-create/searchTelemetryTypes';
import { Search as SearchIcon, Link2 } from 'lucide-react';

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated: (entity?: { id: string; name: string; type: string; image_url?: string }) => void;
  variant?: 'admin' | 'user';        // Default: 'admin' (backward compatible)
  showPreviewTab?: boolean;           // Default: true (backward compatible)
  prefillName?: string;               // Optional: search query to prefill
}

export const CreateEntityDialog: React.FC<CreateEntityDialogProps> = ({
  open,
  onOpenChange,
  onEntityCreated,
  variant = 'admin',           // ✅ Admin default keeps existing behavior
  showPreviewTab = true,       // ✅ Preview tab shown by default
  prefillName                  // ✅ Optional prefill for user mode
}) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  // Phase 3.4C — non-admin brand-plus-entity atomic-RPC payload.
  // When set at Stage 1 for a non-admin creating a brand new brand,
  // handleSubmit routes through create_brand_and_entity_atomic instead of
  // a direct entities.insert.
  const [pendingBrandForAtomic, setPendingBrandForAtomic] = useState<BrandCandidate | null>(null);
  // Phase 3.4D — post-create continuation prompt (view / post / just save).
  const [continuationEntity, setContinuationEntity] = useState<CreatedEntitySummary | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftCheckComplete, setDraftCheckComplete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  
  // Variant-aware storage keys for isolated drafts
  const DRAFT_KEY = `create-entity-draft-${variant}`;
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    image_url: '',
    website_url: '',
    venue: '',
    category_id: null as string | null,
    metadata: {} as Record<string, any>,
    authors: [] as string[],
    languages: [] as string[],
    isbn: '',
    publication_year: null as number | null,
    cast_crew: {} as Record<string, any>,
    ingredients: [] as string[],
    specifications: {} as Record<string, any>,
    price_info: {} as Record<string, any>,
    nutritional_info: {} as Record<string, any>,
    external_ratings: {} as Record<string, any>,
  });
  
  const [businessHours, setBusinessHours] = useState({});
  const [contactInfo, setContactInfo] = useState({});
  const [selectedParent, setSelectedParent] = useState<Entity | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  const [otherTypeReason, setOtherTypeReason] = useState('');
  const [primaryMediaUrl, setPrimaryMediaUrl] = useState<string | null>(null);
  
  // Tag input state (string-based for simplicity)
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  
  // Active tab tracking for step-by-step navigation
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  // URL analysis state
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const { engine: analyzeEngine, isLoading: engineLoading } = useAnalyzeUrlEngine();
  // Phase 3.5a — Search-to-Draft tab visibility + active-tab state.
  const searchToDraftEnabled = useSearchToDraftEnabled();
  const [createEntityTab, setCreateEntityTab] = useState<'url' | 'search'>('url');
  // Phase 3.5c — funnel telemetry (fire-and-forget, hashed query only).
  const { log: logFunnel, consumePickLatency } = useSearchFunnel();
  const useDraftReviewFlagRaw = useEntityReviewUsesDraft();
  // Phase 3.4C — non-admins (variant === 'user') are always forced onto the
  // V2 Draft Review path; the admin-only useEntityReviewUsesDraft flag never
  // downgrades them to the legacy Analyze flow.
  const useDraftReviewFlag = variant === 'user' ? true : useDraftReviewFlagRaw;
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false);
  const [aiPredictions, setAiPredictions] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showUrlMismatchDialog, setShowUrlMismatchDialog] = useState(false);
  const [urlMismatchMessage, setUrlMismatchMessage] = useState('');
  const [urlMetadata, setUrlMetadata] = useState<any>(null);
  // Phase 2: normalized URL of the most recent Analyze attempt (success or
  // failure). Used for analysis retry / metadata-freshness logic only.
  // Does NOT drive form/media reset anymore — see lastAppliedUrl.
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);
  // Phase 2 v8: normalized URL of the result currently committed to the
  // form (via Apply to Form / Use basic metadata). Drives the
  // reset-on-different-URL behavior inside the apply handlers.
  const [lastAppliedUrl, setLastAppliedUrl] = useState<string | null>(null);
  // Phase 2 v8: URL snapshot captured at the moment the preview modal opens
  // for a successful AI prediction. Apply handlers read this — never the
  // live analyzeUrl input — so a post-render edit cannot poison apply.
  const [predictionUrlSnapshot, setPredictionUrlSnapshot] = useState<string | null>(null);
  // Phase 3.3A — pending local uploads. Map<blobUrl, File>. The MediaItem's
  // `url` is the blob URL until host-form Save resolves it to a real CDN URL.
  // Tracked by ref so the lookup is sync, plus a Set for blob-revoke lifecycle.
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const trackedBlobsRef = useRef<Set<string>>(new Set());
  // Phase 3.3A — duplicate-check state for the pre-insert "Did you mean?" step.
  const [dupCandidates, setDupCandidates] = useState<import('./entity-create/DuplicateConfirmDialog').DuplicateCandidate[]>([]);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const pendingSubmitOverridesRef = useRef<any>(undefined);
  const prefilledFromDraftRef = useRef<boolean>(false);
  // Phase 3.5c — search-origin flag scoped to the currently open duplicate dialog.
  // Captured at the moment the dialog opens so "Use this" can route
  // search-origin duplicates to /entity/:slug?compose=review while leaving
  // URL/manual duplicate behavior untouched. Reset on dialog close.
  const pendingDuplicateOriginRef = useRef<'search' | 'other'>('other');
  // Exact-URL preflight (fires before Analyze spends AI/scrape credits).
  const [preflightDupCandidates, setPreflightDupCandidates] = useState<DuplicateCandidate[]>([]);
  const [preflightDupOpen, setPreflightDupOpen] = useState(false);
  const [pendingAnalyzeUrl, setPendingAnalyzeUrl] = useState<string | null>(null);
  const skipEarlyDupCheckOnceRef = useRef<boolean>(false);
  const preflightInFlightRef = useRef<boolean>(false);
  // Phase 3.5c v2 — Search-to-Draft finalization snapshot. Captured at Apply
  // time; consumed once at successful entity_created; reset on close/reset.
  const searchSnapshotRef = useRef<SearchDraftSnapshot | null>(null);
  // Phase 2: normalized URL the currently held urlMetadata belongs to. Used
  // by the metadata-only modal as a freshness guard so URL A's metadata never
  // surfaces under URL B.
  const [metadataUrl, setMetadataUrl] = useState<string | null>(null);
  
  // Progressive disclosure state (user variant only)
  const [isFormExpanded, setIsFormExpanded] = useState(variant === 'admin'); // Admin always expanded
  const [urlAnalysisComplete, setUrlAnalysisComplete] = useState(false);
  
  // Metadata cache with TTL
  const metadataCache = useRef(new Map<string, { data: any; timestamp: number }>());
  
  const getCachedMetadata = (url: string) => {
    const cached = metadataCache.current.get(url);
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    if (cached && Date.now() - cached.timestamp < FIVE_MINUTES) {
      console.log('✅ Using cached metadata for:', url);
      return cached.data;
    }
    return null;
  };
  
  const setCachedMetadata = (url: string, data: any) => {
    metadataCache.current.set(url, { data, timestamp: Date.now() });
  };

  // Safe domain extraction helper
  const getSafeDomain = (url: string | undefined): string => {
    if (!url) return 'Unknown source';
    try {
      return new URL(url).hostname;
    } catch (error) {
      console.warn('Invalid URL for domain extraction:', url);
      return 'Unknown source';
    }
  };

  // URL metadata persistence constants (variant-aware)
  const METADATA_STORAGE_KEY = `entity_url_metadata_preview-${variant}`;
  const METADATA_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Save URL metadata to localStorage with expiration
  const saveUrlMetadataToStorage = (url: string, metadata: any) => {
    try {
      const data = {
        url,
        metadata,
        timestamp: Date.now(),
        expiresAt: Date.now() + METADATA_TTL
      };
      localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(data));
      console.log('💾 Saved URL metadata to localStorage:', url);
    } catch (error) {
      console.warn('Failed to save URL metadata to localStorage:', error);
    }
  };

  // Load URL metadata from localStorage (with expiration check)
  const loadUrlMetadataFromStorage = (): { url: string; metadata: any } | null => {
    try {
      const stored = localStorage.getItem(METADATA_STORAGE_KEY);
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      
      // Check expiration
      if (Date.now() > data.expiresAt) {
        console.log('🗑️ URL metadata expired, clearing...');
        localStorage.removeItem(METADATA_STORAGE_KEY);
        return null;
      }
      
      console.log('✅ Restored URL metadata from localStorage:', data.url);
      return { url: data.url, metadata: data.metadata };
    } catch (error) {
      console.warn('Failed to load URL metadata from localStorage:', error);
      return null;
    }
  };

  // Clear URL metadata from localStorage
  const clearUrlMetadataFromStorage = () => {
    try {
      localStorage.removeItem(METADATA_STORAGE_KEY);
      console.log('🗑️ Cleared URL metadata from localStorage');
    } catch (error) {
      console.warn('Failed to clear URL metadata from localStorage:', error);
    }
  };

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const loadDraft = () => {
      try {
        const savedDraft = sessionStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          setFormData(draft.formData || formData);
          setBusinessHours(draft.businessHours || {});
          setContactInfo(draft.contactInfo || {});
          setSelectedParent(draft.selectedParent || null);
          setUploadedMedia(draft.uploadedMedia || []);
          setOtherTypeReason(draft.otherTypeReason || '');
          setPrimaryMediaUrl(draft.primaryMediaUrl || null);
          setSelectedTagNames(draft.selectedTagNames || []);
          setDraftRestored(true);
        }
        
        // Restore URL metadata preview
        const storedMetadata = loadUrlMetadataFromStorage();
        if (storedMetadata) {
          setAnalyzeUrl(storedMetadata.url);
          setUrlMetadata(storedMetadata.metadata);
          setShowAnalyzeButton(isValidUrl(storedMetadata.url));
          console.log('🔄 Restored URL preview:', storedMetadata.url);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      } finally {
        // ✅ Always mark draft check as complete (whether draft found or not)
        setDraftCheckComplete(true);
      }
    };

    if (open) {
      setDraftCheckComplete(false); // Reset when dialog opens
      searchSnapshotRef.current = null; // Phase 3.5c v2 — reset stale finalization snapshot
      loadDraft();
    }
  }, [open]);

  // Auto-expand form when draft is restored (user variant only)
  useEffect(() => {
    if (draftRestored && variant === 'user') {
      setIsFormExpanded(true);
      setUrlAnalysisComplete(true); // Mark URL workflow as complete
      console.log('📝 Auto-expanding form - draft restored');
    }
  }, [draftRestored, variant]);

  // Prefill name field when opening in user mode with search query
  useEffect(() => {
    // Only proceed in user mode with prefillName provided
    if (variant !== 'user' || !prefillName) return;
    
    // Wait for draft check to complete
    if (!draftCheckComplete) return;
    
    // ✅ Only prefill if NO draft was restored (fresh dialog)
    if (draftRestored) {
      console.log('📝 Skipping prefill - draft was restored');
      return;
    }
    
    // Only prefill if name field is still empty
    if (!formData.name || formData.name.trim() === '') {
      console.log('📝 Pre-filling entity name from search:', prefillName);
      setFormData(prev => ({ ...prev, name: prefillName }));
    }
  }, [variant, prefillName, draftCheckComplete, draftRestored, formData.name]);

  // Tag autocomplete

  // Save draft to sessionStorage on changes
  useEffect(() => {
    if (!open) return;

    const saveDraft = () => {
      try {
        const draft = {
          formData,
          businessHours,
          contactInfo,
          selectedParent,
          uploadedMedia,
          otherTypeReason,
          primaryMediaUrl,
          selectedTagNames
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    };

    const timeoutId = setTimeout(saveDraft, 500);
    return () => clearTimeout(timeoutId);
  }, [formData, businessHours, contactInfo, selectedParent, uploadedMedia, open]);

  // Save URL metadata to localStorage whenever it changes
  useEffect(() => {
    if (urlMetadata && analyzeUrl) {
      saveUrlMetadataToStorage(analyzeUrl, urlMetadata);
    }
  }, [urlMetadata, analyzeUrl]);

  const handleInputChange = (field: string, value: string | null | Record<string, any>) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear AI-filled marker when manually edited
    if (aiFilledFields.has(field)) {
      setAiFilledFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }
    
    // Clear error when field is updated
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Validate field
  const validateField = (field: EntityFieldConfig, value: any): string | null => {
    if (field.required && !value) {
      return `${field.label} is required`;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Invalid email format';
    }
    if (field.type === 'url' && value && !/^https?:\/\/.+/.test(value)) {
      return 'Invalid URL format';
    }
    if (field.type === 'number' && value && isNaN(Number(value))) {
      return 'Must be a valid number';
    }
    return null;
  };
  
  // Handle type-specific field updates based on storage column
  const handleTypeSpecificFieldChange = (fieldKey: string, value: any, targetType?: string) => {
    const entityType = targetType ?? formData.type;
    const typeConfig = entityTypeConfig[entityType];
    if (!typeConfig) return;
    
    const fieldConfig = typeConfig.fields.find(f => f.key === fieldKey);
    if (!fieldConfig) return;
    
    const storageColumn = fieldConfig.storageColumn || 'metadata';
    
    setFormData(prev => {
      const updated: any = { ...prev };
      
      switch (storageColumn) {
        case 'metadata':
          updated.metadata = { ...prev.metadata, [fieldKey]: value };
          break;
        case 'cast_crew':
          updated.cast_crew = { ...prev.cast_crew, [fieldKey]: value };
          break;
        case 'specifications':
          updated.specifications = { ...prev.specifications, [fieldKey]: value };
          break;
        case 'price_info':
          updated.price_info = { ...prev.price_info, [fieldKey]: value };
          break;
        case 'nutritional_info':
          updated.nutritional_info = { ...prev.nutritional_info, [fieldKey]: value };
          break;
        case 'external_ratings':
          updated.external_ratings = { ...prev.external_ratings, [fieldKey]: value };
          break;
        default:
          // Direct column like authors, isbn, publication_year, etc.
          updated[storageColumn] = value;
      }
      
      return updated;
    });
    
    // Clear AI-filled marker when manually edited
    if (aiFilledFields.has(fieldKey)) {
      setAiFilledFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldKey);
        return newSet;
      });
    }
    
    // Validate and update errors
    const error = validateField(fieldConfig, value);
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[fieldKey] = error;
      } else {
        delete newErrors[fieldKey];
      }
      return newErrors;
    });
  };
  
  // Determine which tabs to show based on entity type
  const getVisibleTabs = () => {
    const typeConfig = entityTypeConfig[formData.type];
    const baseTabs = typeConfig ? typeConfig.showTabs : ['basic'];
    
    // Only add preview tab if explicitly allowed
    return showPreviewTab ? [...baseTabs, 'preview'] : baseTabs;
  };
  
  const shouldShowTab = (tabName: string) => {
    return getVisibleTabs().includes(tabName as any);
  };

  // ============= TAB NAVIGATION HELPERS =============

  // Get the ordered list of visible tabs
  const getTabOrder = () => {
    return getVisibleTabs();
  };

  // Get the index of current active tab
  const getCurrentTabIndex = () => {
    const order = getTabOrder();
    return order.indexOf(activeTab);
  };

  // Check if current tab is the last one
  const isLastTab = () => {
    const order = getTabOrder();
    return getCurrentTabIndex() === order.length - 1;
  };

  // Get the next tab in sequence
  const getNextTab = () => {
    const order = getTabOrder();
    const currentIndex = getCurrentTabIndex();
    return currentIndex < order.length - 1 ? order[currentIndex + 1] : null;
  };

  // Handle Next button click
  const handleNextTab = () => {
    const nextTab = getNextTab();
    if (nextTab) {
      setActiveTab(nextTab);
    }
  };

  // Handle Previous button click
  const handlePreviousTab = () => {
    const order = getTabOrder();
    const currentIndex = getCurrentTabIndex();
    if (currentIndex > 0) {
      setActiveTab(order[currentIndex - 1]);
    }
  };

  // ============= REAL-TIME VALIDATION STATE =============

  // Check if current tab has all required fields filled (no toasts)
  const isCurrentStepValid = useMemo(() => {
    switch (activeTab) {
      case 'basic':
        // Name is required
        if (!formData.name.trim()) return false;
        
        // Type is required
        if (!formData.type) return false;
        
        // Category is required
        if (!formData.category_id) return false;
        
        // "Others" type requires explanation
        if (formData.type === 'others' && !otherTypeReason.trim()) return false;
        
        return true;
        
      case 'details':
        // Validate type-specific required fields
        const typeConfig = entityTypeConfig[formData.type];
        if (!typeConfig?.requiredFields) return true;
        
        for (const fieldKey of typeConfig.requiredFields) {
          const fieldConfig = typeConfig.fields.find(f => f.key === fieldKey);
          if (!fieldConfig) continue;
          
          const storageColumn = fieldConfig.storageColumn || 'metadata';
          let value;
          
          switch (storageColumn) {
            case 'metadata':
              value = formData.metadata?.[fieldKey];
              break;
            case 'cast_crew':
              value = formData.cast_crew?.[fieldKey];
              break;
            case 'specifications':
              value = formData.specifications?.[fieldKey];
              break;
            case 'price_info':
              value = formData.price_info?.[fieldKey];
              break;
            case 'nutritional_info':
              value = formData.nutritional_info?.[fieldKey];
              break;
            case 'external_ratings':
              value = formData.external_ratings?.[fieldKey];
              break;
            default:
              value = formData[storageColumn as keyof typeof formData];
          }
          
          // Check if value is empty
          const isEmpty = !value || 
                         (Array.isArray(value) && value.length === 0) || 
                         value === '' ||
                         (typeof value === 'string' && value.trim() === '');
          
          if (isEmpty) return false;
        }
        
        return true;
        
      // Contact, hours, and preview tabs have no required fields
      case 'contact':
      case 'hours':
      case 'preview':
        return true;
        
      default:
        return true;
    }
  }, [activeTab, formData, otherTypeReason]);

  // ============= AUTO-RESET TAB ON TYPE CHANGE =============

  // Reset active tab if it becomes invalid when entity type changes
  useEffect(() => {
    const visibleTabs = getVisibleTabs();
    
    // If current tab is no longer in the visible tabs list, reset to first tab
    if (!visibleTabs.includes(activeTab as any)) {
      console.log(`⚠️ Tab "${activeTab}" no longer visible, resetting to "${visibleTabs[0]}"`);
      setActiveTab(visibleTabs[0]);
    }
  }, [formData.type, activeTab]);

  // Reset category ONLY when entity type changes (not on tab changes)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      category_id: null
    }));
  }, [formData.type]);

  // Phase 3.1: READ-ONLY pre-selection of an existing parent brand entity.
  // This function MUST NEVER call create-brand-entity or any other write.
  // If no match (or only ambiguous matches) is found it returns null and
  // leaves the parent selector untouched — admin picks/creates manually.
  // Auto-creation was removed in Phase 3.1; it will return in Phase 3.2
  // behind an explicit user-confirmed BrandPicker action.
  const autoSelectParentBrand = async (brandName: string) => {
    if (!brandName || brandName.length < 2) {
      console.log('⚠️ Brand name too short for auto-selection');
      return null;
    }

    console.log(`🔍 Auto-searching for parent brand: "${brandName}"`);

    try {
      const { data: brandEntities, error } = await supabase
        .from('entities')
        .select('id, name, type, image_url, slug, description')
        .eq('type', 'brand')
        .eq('is_deleted', false)
        .or(`name.ilike.%${brandName}%,slug.ilike.%${brandName.toLowerCase().replace(/\s+/g, '-')}%`)
        .limit(5);

      if (error) {
        console.error('❌ Error searching for parent brand:', error);
        return null;
      }

      if (!brandEntities || brandEntities.length === 0) {
        console.log(`❌ No parent brand found for "${brandName}"`);
        return null; // Will trigger Phase 2 auto-creation
      }

      // Try exact name match first (case-insensitive)
      const exactMatch = brandEntities.find(
        b => b.name.toLowerCase() === brandName.toLowerCase()
      );

      if (exactMatch) {
        console.log(`✅ Found exact parent match: "${exactMatch.name}" (${exactMatch.id})`);
        
        // Convert to Entity type for ParentEntitySelector
        const parentEntity: Entity = {
          id: exactMatch.id,
          name: exactMatch.name,
          type: EntityType.Brand,
          image_url: exactMatch.image_url,
          slug: exactMatch.slug,
          description: exactMatch.description,
          api_ref: null,
          api_source: null,
          metadata: {},
          venue: null,
          website_url: null,
          category_id: null,
          popularity_score: null,
          photo_reference: null,
          created_at: null,
          updated_at: null,
          authors: null,
          publication_year: null,
          isbn: null,
          languages: null,
          external_ratings: null,
          price_info: null,
          specifications: null,
          cast_crew: null,
          ingredients: null,
          nutritional_info: null,
          last_enriched_at: null,
          enrichment_source: null,
          data_quality_score: null
        };
        
        setSelectedParent(parentEntity);
        
        toast({
          title: "Parent Brand Auto-Selected",
          description: `Linked to ${exactMatch.name}`,
        });
        
        return exactMatch;
      }

      // If only one result, auto-select it
      if (brandEntities.length === 1) {
        console.log(`✅ Found single parent match: "${brandEntities[0].name}"`);
        
        const parentEntity: Entity = {
          id: brandEntities[0].id,
          name: brandEntities[0].name,
          type: EntityType.Brand,
          image_url: brandEntities[0].image_url,
          slug: brandEntities[0].slug,
          description: brandEntities[0].description,
          api_ref: null,
          api_source: null,
          metadata: {},
          venue: null,
          website_url: null,
          category_id: null,
          popularity_score: null,
          photo_reference: null,
          created_at: null,
          updated_at: null,
          authors: null,
          publication_year: null,
          isbn: null,
          languages: null,
          external_ratings: null,
          price_info: null,
          specifications: null,
          cast_crew: null,
          ingredients: null,
          nutritional_info: null,
          last_enriched_at: null,
          enrichment_source: null,
          data_quality_score: null
        };
        
        setSelectedParent(parentEntity);
        
        toast({
          title: "Parent Brand Auto-Selected",
          description: `Linked to ${brandEntities[0].name}`,
        });
        
        return brandEntities[0];
      }

      // Multiple matches - let user choose manually
      console.log(`⚠️ Found ${brandEntities.length} potential parents for "${brandName}"`);
      toast({
        title: "Multiple Brands Found",
        description: `Found ${brandEntities.length} similar brands. Please select the correct parent manually.`,
        variant: "default"
      });
      
      return null;
      
    } catch (error) {
      console.error('❌ Error in autoSelectParentBrand:', error);
      return null;
    }
  };

  // Phase 3.2 — `autoCreateParentBrand` has been removed. Brand creation
  // now flows exclusively through `DraftReviewBody` → `create-brand-entity`
  // with explicit `confirmCreate: true`. Analyze must never write.

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      image_url: '',
      website_url: '',
      venue: '',
      category_id: null,
      metadata: {},
      authors: [],
      languages: [],
      isbn: '',
      publication_year: null,
      cast_crew: {},
      ingredients: [],
      specifications: {},
      price_info: {},
      nutritional_info: {},
      external_ratings: {},
    });
    setBusinessHours({});
    setContactInfo({});
    setSelectedParent(null);
    setUploadedMedia([]);
    prefilledFromDraftRef.current = false;
    trackedBlobsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    trackedBlobsRef.current.clear();
    pendingFilesRef.current.clear();
    setShowMediaUploadModal(false);
    setDraftRestored(false);
    setDraftCheckComplete(false);
    setOtherTypeReason('');
    setPrimaryMediaUrl(null);
    setSelectedTagNames([]);
    setAnalyzeUrl('');
    setShowAnalyzeButton(false);
    setAiPredictions(null);
    setShowPreviewModal(false);
    setUrlMetadata(null);
    setFieldErrors({});
    setAiFilledFields(new Set());
    setPendingBrandForAtomic(null);
    searchSnapshotRef.current = null;
    setActiveTab('basic');
    
    // Reset progressive disclosure state (user variant only)
    if (variant === 'user') {
      setIsFormExpanded(false);
      setUrlAnalysisComplete(false);
    }
    
    // Clear draft from sessionStorage
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
    
    // Clear URL metadata from localStorage
    clearUrlMetadataFromStorage();
  };

  // Validate URL format
  const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Helper to add images to media gallery
  // Helper to add a SINGLE image to media gallery
  // Note: For multiple images, batch the state update instead of calling this in a loop
  const addImageToMediaGallery = (imageUrl: string, source: 'metadata' | 'ai') => {
    // Deduplicate - check if image already exists
    const exists = uploadedMedia.some(item => item.url === imageUrl);
    if (exists) {
      console.log('🖼️ Image already in gallery:', imageUrl);
      return;
    }
    
    const newMediaItem: MediaItem = {
      id: crypto.randomUUID(),
      url: imageUrl,
      type: 'image',
      order: uploadedMedia.length,
      caption: source === 'metadata' ? 'From URL metadata' : 'AI-extracted',
      source: 'external', // Mark as external URL (not uploaded file)
    };
    
    setUploadedMedia(prev => [...prev, newMediaItem]);
    
    // Set as primary if no primary exists
    if (!primaryMediaUrl && uploadedMedia.length === 0) {
      setPrimaryMediaUrl(imageUrl);
    }
    
    console.log(`🖼️ Added ${source} image to gallery:`, imageUrl);
  };

  // Phase 3.3A — add a batch of remote URLs + pending local uploads as
  // MediaItems. Pending uploads carry a blob: URL; pendingFilesRef holds the
  // real File and is consumed at host-form Save time.
  const addGalleryToMediaList = (
    remoteUrls: string[],
    pendingUploads: { file: File; previewUrl: string }[],
  ) => {
    const items: MediaItem[] = [];
    for (const url of remoteUrls) {
      if (!url) continue;
      items.push({
        id: crypto.randomUUID(), url, type: 'image',
        order: 0, caption: 'AI-extracted', source: 'external',
      });
    }
    for (const pu of pendingUploads) {
      pendingFilesRef.current.set(pu.previewUrl, pu.file);
      trackedBlobsRef.current.add(pu.previewUrl);
      items.push({
        id: crypto.randomUUID(), url: pu.previewUrl, type: 'image',
        order: 0, caption: 'User upload (pending)', source: 'external',
      });
    }
    if (items.length === 0) return;
    setUploadedMedia(prev => {
      const existing = new Set(prev.map(p => p.url));
      const additions = items.filter(it => !existing.has(it.url));
      return [...prev, ...additions.map((it, i) => ({ ...it, order: prev.length + i }))];
    });
  };

  // Revoke any tracked blob URLs on unmount as a safety net.
  useEffect(() => {
    const tracked = trackedBlobsRef.current;
    return () => {
      tracked.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
      tracked.clear();
      pendingFilesRef.current.clear();
    };
  }, []);


  // ─── Phase 2 helpers ────────────────────────────────────────────────────
  // Conservative URL normalizer: lowercases hostname, drops a single trailing
  // slash on non-root paths, strips the #hash fragment (fragments never
  // identify a page server-side). Does NOT strip query strings — a query
  // change is a genuinely different URL.
  const normalizeUrlForCompare = (input: string | null | undefined): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const u = new URL(trimmed);
      u.hostname = u.hostname.toLowerCase();
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }
      u.hash = '';
      return u.toString();
    } catch {
      return trimmed;
    }
  };

  // Filter raw metadata image entries down to safe, deduped http(s) URLs.
  const pickValidImages = (meta: any): string[] => {
    const raw: any[] = Array.isArray(meta?.images)
      ? meta.images
      : meta?.image
      ? [meta.image]
      : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      const url = typeof item === 'string' ? item : item?.url;
      if (typeof url !== 'string') continue;
      const trimmed = url.trim();
      if (!trimmed) continue;
      if (/^(data:|blob:|javascript:)/i.test(trimmed)) continue;
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        const key = parsed.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
        if (out.length >= 8) break;
      } catch {
        continue;
      }
    }
    return out;
  };

  // Build the Phase 2 metadata-only snapshot. Returns null unless the metadata
  // is fresh for the current analyze URL AND has at least a non-empty title
  // or one valid image. A website URL alone is not enough.
  const buildMetadataOnly = (): {
    title?: string;
    websiteUrl?: string;
    images?: string[];
  } | null => {
    const normalized = normalizeUrlForCompare(analyzeUrl);
    if (!metadataUrl || !normalized || metadataUrl !== normalized) return null;
    const title =
      typeof urlMetadata?.title === 'string' ? urlMetadata.title.trim() : '';
    const images = pickValidImages(urlMetadata);
    if (!title && images.length === 0) return null;
    return {
      title: title || undefined,
      // Snapshot the analyzed URL at render time so a post-render edit to
      // analyzeUrl cannot poison the applied website_url.
      websiteUrl: analyzeUrl.trim() || undefined,
      images,
    };
  };

  // Phase 2 v8: Runs only from the Apply handlers when the user commits a
  // different URL than `lastAppliedUrl`. Clears all entity form fields,
  // structured fields, and media so the new applied result fully replaces
  // the previous entity. Never runs from Analyze — Analyze is preview-only
  // and must not mutate form/media state.
  const resetEntityFormForNewAppliedUrl = () => {
    setFormData(prev => ({
      ...prev,
      name: '',
      website_url: '',
      type: '',
      description: '',
      category_id: null,
      authors: [],
      languages: [],
      isbn: '',
      publication_year: null,
      ingredients: [],
      metadata: {},
      cast_crew: {},
      specifications: {},
      price_info: {},
      nutritional_info: {},
      external_ratings: {},
      image_url: '',
    }));
    setSelectedTagNames([]);
    setSelectedParent(null);
    setAiFilledFields(new Set());
    setUploadedMedia([]);
    setPrimaryMediaUrl(null);
  };

  // Phase 3.5a — Search-to-Draft handlers.
  // "Open" on an existing CommonGroundz match → navigate + close dialog.
  const handleSearchOpenExisting = (match: SearchExistingMatch, intent: 'view' | 'review' = 'view') => {
    const base = match.slug ? `/entity/${match.slug}` : `/entity/${match.id}`;
    const url = intent === 'review' ? `${base}?compose=review` : base;
    navigate(url);
    onOpenChange(false);
  };

  // "Review & create" on a web candidate → enrich brand candidates against
  // the DB (upgrade suggested_new → matched_existing on hit), then reuse
  // the existing AutoFillPreviewModal draft-review path by shaping
  // aiPredictions to the same shape the URL flow uses.
  const handleSearchPick = async (payload: SearchCandidatePayload) => {
    // Search-origin drafts must not inherit URL-analysis metadata from a
    // previous run (e.g. a prior WishCare analyze leaking images into a
    // fresh Cetaphil search). Clear it before the preview modal opens.
    setUrlMetadata(null);
    let draft = payload.draft;
    try {
      const enriched = await enrichBrandCandidatesWithExistingMatch(draft.brandCandidates);
      draft = { ...draft, brandCandidates: enriched };
    } catch (e) {
      console.warn('[CreateEntityDialog] brand enrichment failed:', e);
    }
    const predictions = buildSearchPredictions({ ...payload, draft });
    setAiPredictions(predictions);
    // Intentionally leave predictionUrlSnapshot null — the citation URL
    // must NOT flow into website_url via buildEntityFormPatchFromPredictions.
    setPredictionUrlSnapshot(null);
    setShowPreviewModal(true);
    // Phase 3.5c — funnel: draft review opened from a search pick.
    void logFunnel({
      event: 'review_opened',
      source: 'search',
      entityType: payload.candidate.type,
      diagnostics: { hasImage: Boolean(draft.imageCandidates?.length) },
    });
  };

  // Call edge function to analyze URL
  const handleAnalyzeUrl = async () => {
    if (!analyzeUrl || !isValidUrl(analyzeUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP/HTTPS URL",
        variant: "destructive"
      });
      return;
    }

    // ─── Exact-URL preflight duplicate check ─────────────────────────────
    // Runs BEFORE any AI/scrape credits are spent. Only checks deterministic
    // URL equality (normalized website_url + metadata.created_from_url).
    // Bypassed once when the admin picks "Continue Anyway" on the dialog.
    if (skipEarlyDupCheckOnceRef.current) {
      skipEarlyDupCheckOnceRef.current = false;
    } else if (!preflightInFlightRef.current) {
      preflightInFlightRef.current = true;
      setAnalyzing(true); // reuse spinner while preflight round-trips
      try {
        const preflightPromise = supabase.functions.invoke('check-entity-duplicates', {
          body: {
            mode: 'exact_url_preflight',
            sourceUrl: analyzeUrl,
            websiteUrl: analyzeUrl,
          },
        });
        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('preflight timeout') }), 2000)
        );
        const { data, error } = await Promise.race([preflightPromise, timeoutPromise]) as any;
        if (!error && data?.candidates?.length > 0) {
          setPendingAnalyzeUrl(analyzeUrl);
          setPreflightDupCandidates(data.candidates as DuplicateCandidate[]);
          setPreflightDupOpen(true);
          setAnalyzing(false);
          preflightInFlightRef.current = false;
          return; // block pipeline — no AI/scrape credits spent
        }
        if (error) {
          console.warn('Exact-URL preflight failed (non-fatal, proceeding):', error);
        }
      } catch (e) {
        console.warn('Exact-URL preflight threw (non-fatal, proceeding):', e);
      } finally {
        preflightInFlightRef.current = false;
      }
      // preflight miss → fall through to normal Analyze (setAnalyzing already true)
    }

    setAnalyzing(true);


    // Phase 2 v8: Analyze is preview-only. Do NOT mutate form/media state
    // here. Only clear analysis-side state for a new normalized URL so the
    // preview modal doesn't surface stale predictions/metadata. The form
    // reset happens later, inside the Apply handlers, via
    // resetEntityFormForNewAppliedUrl().
    const normalizedAnalyze = normalizeUrlForCompare(analyzeUrl);
    if (normalizedAnalyze && normalizedAnalyze !== lastAnalyzedUrl) {
      setAiPredictions(null);
      setUrlMetadata(null);
      setMetadataUrl(null);
      setUrlMismatchMessage('');
      setPredictionUrlSnapshot(null);
    }
    setLastAnalyzedUrl(normalizedAnalyze);

    
    try {
      // Route to V1 or V2 based on admin engine flag. Never log the full URL (may contain tokens/PII).
      const fnName = analyzeEngine === 'v2' ? 'analyze-entity-url-v2' : 'analyze-entity-url';
      let urlHost = 'unknown';
      try { urlHost = new URL(analyzeUrl).host; } catch { /* ignore */ }
      console.log(`🔍 [engine=${analyzeEngine}] invoking ${fnName} (host=${urlHost})`);

      // Check cache first
      const cachedMetadata = getCachedMetadata(analyzeUrl);

      // Call AI analysis first to get product name AND brand
      const aiResult = await supabase.functions.invoke(fnName, { body: { url: analyzeUrl } });

      // V2 failure detection: both transport errors AND { success: false } envelopes.
      const v2Failed =
        analyzeEngine === 'v2' &&
        (!!aiResult.error || (aiResult.data && aiResult.data.success === false));

      // Extract product name and brand from AI analysis if available
      const aiProductName = aiResult.data?.predictions?.name;
      // AI returns brand in two possible locations depending on analysis type
      const aiBrandName = 
        aiResult.data?.predictions?.brand ?? 
        aiResult.data?.predictions?.additional_data?.brand ?? 
        null;
      
      console.log(`🤖 AI extracted: name="${aiProductName || 'none'}", brand="${aiBrandName || 'none'}"`);
      
      // Then call metadata function with AI-extracted product name AND brand.
      // Phase 1.8c.6-B: also pass the AI-predicted entity type so the function
      // picks the right image-priority path (brand → Google-first, others → page-first).
      // AI prediction is the source of truth at this moment; formData.type may be
      // stale draft state. If AI didn't return a type, fall back to a non-empty
      // formData.type, otherwise omit.
      const aiPredictedType = aiResult.data?.predictions?.type;
      const resolvedEntityType =
        (typeof aiPredictedType === 'string' && aiPredictedType.trim() !== '')
          ? aiPredictedType.trim()
          : (typeof formData.type === 'string' && formData.type.trim() !== ''
              ? formData.type.trim()
              : null);
      const metadataResult = cachedMetadata 
        ? { data: cachedMetadata, error: null }
        : await supabase.functions.invoke('fetch-url-metadata-lite', { 
            body: { 
              url: analyzeUrl,
              productName: aiProductName || null,
              brandName: aiBrandName || null,
              entityType: resolvedEntityType,
            } 
          });
      
      // Handle metadata
      if (metadataResult.error) {
        console.error('⚠️ Metadata fetch error:', metadataResult.error);
      } else if (metadataResult.data) {
        console.log('📄 Metadata:', metadataResult.data);
        setUrlMetadata(metadataResult.data);
        // Phase 2: bind the just-fetched metadata to the normalized URL it
        // belongs to, so the metadata-only modal's freshness guard refuses to
        // surface it under a different URL later.
        setMetadataUrl(normalizedAnalyze);
        if (!cachedMetadata) {
          setCachedMetadata(analyzeUrl, metadataResult.data);
        }
      }
      
      // Handle AI predictions
      if (v2Failed) {
        // V2-specific failure. Do NOT silently fall back to V1.
        console.error('⚠️ V2 analysis failed:', aiResult.error ?? aiResult.data);
        // Surface a structured failure envelope so the AI preview modal can
        // render an inline failure state with the server-side request_id.
        const failureRequestId =
          (aiResult.data && typeof aiResult.data === 'object' && (aiResult.data as any).request_id) ||
          (aiResult.data && typeof aiResult.data === 'object' && (aiResult.data as any).metadata?.request_id) ||
          null;
        const failureCode =
          (aiResult.data && typeof aiResult.data === 'object' && (aiResult.data as any).code) || null;
        setAiPredictions({
          __v2Failed: true,
          predictions: null,
          metadata: { request_id: failureRequestId },
          error: { code: failureCode },
        } as any);
        toast({
          title: "V2 engine failed",
          description: "analyze-entity-url-v2 returned an error. Not falling back to V1. Switch the engine flag to v1 to retry with the stable engine.",
          variant: "destructive"
        });
      } else if (aiResult.error) {
        // V1 path: keep existing generic behavior
        console.error('⚠️ AI analysis error:', aiResult.error);
        toast({
          title: "AI Analysis Unavailable",
          description: "Using basic metadata only. You can still create the entity.",
          variant: "default"
        });
      }
      
      if (aiResult.data && !v2Failed) {
        console.log('🤖 AI Analysis:', aiResult.data);
        setAiPredictions(aiResult.data);
        
        // Phase 3.1: auto-select existing parent brand only (READ-ONLY).
        // Auto-creation has been removed — `create-brand-entity` now
        // requires explicit confirmCreate from a user-confirmed code
        // path (planned in Phase 3.2 BrandPicker). If no exact match is
        // found here we deliberately do NOTHING so the admin can pick
        // or create a brand manually via the existing parent selector.
        if (aiBrandName && aiBrandName.length >= 2) {
          await autoSelectParentBrand(aiBrandName);
        }
        
        // V2 scaffold-only / no-predictions signal: success but null predictions.
        if (
          analyzeEngine === 'v2' &&
          aiResult.data.success === true &&
          aiResult.data.predictions == null
        ) {
          toast({
            title: "AI extraction returned no details",
            description: "You can fill the form manually. Request ID is shown in the preview.",
            variant: "default"
          });
        } else if (aiResult.data.success === false) {
          // V1 legacy soft-failure envelope
          toast({
            title: "AI Suggestions Unavailable",
            description: aiResult.data.message || "Using basic metadata. Images are still available.",
            variant: "default"
          });
        }
      }
      
      
      // Show preview modal if we have metadata OR any AI envelope (success or failure).
      if (metadataResult.data || aiResult.data || v2Failed) {
        // Phase 2 v8: capture the normalized URL the modal is opening for,
        // so Apply uses this snapshot — not the live analyzeUrl input —
        // when deciding whether to reset and what to commit.
        setPredictionUrlSnapshot(normalizedAnalyze);
        setShowPreviewModal(true);
      }
      
      // Auto-expand form after URL analysis (user variant)
      if (variant === 'user') {
        setUrlAnalysisComplete(true);
        setIsFormExpanded(true);
      }
      
    } catch (error: any) {
      console.error('❌ URL Analysis Error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze URL. Please try again.",
        variant: "destructive"
      });
      
      // Expand form even on error so user can proceed manually
      if (variant === 'user') {
        setIsFormExpanded(true);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Phase 2 v8: Single controlled gate for committing an analyzed URL's
  // result into the form. Compares the modal's captured snapshot URL
  // against lastAppliedUrl; if different, performs a full entity reset
  // before invoking the apply function. Always updates lastAppliedUrl
  // afterwards. Both Apply to Form and Use basic metadata go through this.
  const commitApply = (snapshotUrl: string | null | undefined, applyFn: () => void | Promise<void>) => {
    const normalized = snapshotUrl ? normalizeUrlForCompare(snapshotUrl) : null;
    const isDifferent = !!normalized && normalized !== lastAppliedUrl;
    if (isDifferent) {
      resetEntityFormForNewAppliedUrl();
    }
    // React 18 batches state updates inside this synchronous handler, so
    // the reset and the apply commit together. Apply functions use
    // functional setFormData/setUploadedMedia/setPrimaryMediaUrl updates
    // where they depend on post-reset state.
    const result = applyFn();
    if (normalized) setLastAppliedUrl(normalized);
    return result;
  };

  // Apply AI predictions to form
  const applyAiPredictions = async () => {
    // Check if we have ANY data to apply (AI predictions OR metadata)
    const hasPredictions = aiPredictions?.predictions;
    const hasMetadata = urlMetadata?.images?.length > 0 || urlMetadata?.image || urlMetadata?.title;
    
    if (!hasPredictions && !hasMetadata) {
      toast({
        title: "No Data Available",
        description: "No predictions or metadata available to apply",
        variant: "destructive"
      });
      return;
    }
    
    // If we have predictions, validate URL type matching
    if (hasPredictions) {
      const pred = aiPredictions.predictions;
      
      if (pred.type && analyzeUrl) {
        const validation = validateUrlForType(analyzeUrl, pred.type);
        if (!validation.isValid) {
          const suggestedType = getSuggestedEntityType(analyzeUrl);
          setUrlMismatchMessage(
            validation.message + 
            (suggestedType ? ` This URL appears to be for a ${suggestedType}.` : '')
          );
          setShowUrlMismatchDialog(true);
          return;
        }
      }
      
      // Apply AI predictions, gated by the URL-snapshot reset logic
      await commitApply(predictionUrlSnapshot, () => applyPredictionsToForm(pred));
    } else {
      // Apply metadata only (no AI predictions available)
      await commitApply(predictionUrlSnapshot, () => applyMetadataOnly());
    }
  };

  const applyMetadataOnly = async () => {
    let appliedCount = 0;
    let imagesApplied = 0;
    
    console.log('📄 Applying metadata without AI predictions');
    
    // Apply basic metadata fields
    if (urlMetadata?.title) {
      handleInputChange('name', urlMetadata.title);
      appliedCount++;
    }
    
    if (urlMetadata?.description) {
      handleInputChange('description', urlMetadata.description);
      appliedCount++;
    }
    
    // Apply images from metadata
    if (urlMetadata?.images && Array.isArray(urlMetadata.images) && urlMetadata.images.length > 0) {
      console.log(`🖼️ Processing ${urlMetadata.images.length} metadata images`);
      
      // Collect all new media items first (batch state update to avoid race condition)
      const newMediaItems: MediaItem[] = [];
      
      urlMetadata.images.forEach((imageItem: any) => {
        const imageUrl = typeof imageItem === 'string' ? imageItem : imageItem.url;
        
        // Check if image already exists
        const exists = uploadedMedia.some(item => item.url === imageUrl);
        if (!exists && !newMediaItems.some(item => item.url === imageUrl)) {
          const newMediaItem: MediaItem = {
            id: crypto.randomUUID(),
            url: imageUrl,
            type: 'image',
            order: uploadedMedia.length + newMediaItems.length,
            caption: 'From URL metadata',
            source: 'external',
          };
          newMediaItems.push(newMediaItem);
        }
      });
      
      // Batch update: Add all media items at once
      if (newMediaItems.length > 0) {
        setUploadedMedia(prev => [...prev, ...newMediaItems]);
        imagesApplied = newMediaItems.length;
        
        // Set primary if no primary exists
        if (!primaryMediaUrl) {
          setPrimaryMediaUrl(newMediaItems[0].url);
        }
        
        console.log(`✅ Batched ${imagesApplied} metadata images to gallery`);
      }
      
      // Set first image as primary
      handleInputChange('image_url', urlMetadata.images[0]);
      appliedCount++;
      
    } else if (urlMetadata?.image) {
      handleInputChange('image_url', urlMetadata.image);
      addImageToMediaGallery(urlMetadata.image, 'metadata');
      appliedCount++;
      imagesApplied = 1;
      console.log('🖼️ Applied single metadata image:', urlMetadata.image);
    }
    
    // Apply website URL
    if (analyzeUrl) {
      handleInputChange('website_url', analyzeUrl);
      appliedCount++;
    }
    
    // Close modal
    setShowPreviewModal(false);
    
    // Show success toast
    const imageCount = imagesApplied || 0;
    const mediaMessage = imageCount > 0 
      ? ` (including ${imageCount} image${imageCount > 1 ? 's' : ''} added to gallery)` 
      : '';

    toast({
      title: "Metadata Applied",
      description: `Applied ${appliedCount} fields${mediaMessage}. AI suggestions were unavailable, but you can fill remaining fields manually.`,
    });
    
    console.log('✅ Applied metadata-only (no AI predictions)');
  };

  /**
   * Phase 2: purely additive metadata-only apply. Receives the same snapshot
   * the modal rendered from — never re-reads live state like analyzeUrl, so a
   * user edit between Analyze and Apply cannot poison the write.
   *
   * Writes ONLY:
   *  - name (if currently empty)
   *  - website_url (if currently empty), from snapshot.websiteUrl
   *  - images: appended/deduped; primaryMediaUrl set only if currently empty
   *
   * Never writes or clears: type, category, brand, price, currency, tags,
   * description, structured product fields.
   */
  const applyMetadataOnlySafe = (snapshot: {
    title?: string;
    websiteUrl?: string;
    images?: string[];
  }) => {
    const title = (snapshot.title ?? '').trim();
    const website = (snapshot.websiteUrl ?? '').trim();
    const incoming = Array.isArray(snapshot.images) ? snapshot.images : [];

    // Phase 2 v8: use functional setFormData so the empty-guard reads the
    // post-reset state when this runs in the same handler as
    // resetEntityFormForNewAppliedUrl().
    if (title) {
      setFormData(prev => prev.name.trim() ? prev : { ...prev, name: title });
    }
    if (website) {
      setFormData(prev => prev.website_url.trim() ? prev : { ...prev, website_url: website });
    }

    if (incoming.length > 0) {
      let addedCount = 0;
      let firstAddedUrl: string | null = null;
      setUploadedMedia(prev => {
        const existing = new Set(prev.map(m => m.url));
        const toAdd: MediaItem[] = [];
        incoming.forEach(url => {
          if (existing.has(url)) return;
          existing.add(url);
          toAdd.push({
            id: crypto.randomUUID(),
            url,
            type: 'image',
            order: prev.length + toAdd.length,
            caption: 'From URL metadata',
            source: 'external',
          });
        });
        addedCount = toAdd.length;
        if (toAdd.length > 0) firstAddedUrl = toAdd[0].url;
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      // Phase 2 v8: functional update so a just-reset primary (null) is seen.
      if (firstAddedUrl) {
        setPrimaryMediaUrl(prev => prev || firstAddedUrl!);
      }
      console.log(`✅ Phase 2 applyMetadataOnlySafe: added ${addedCount} image(s)`);
    }

    setShowPreviewModal(false);
    toast({
      title: 'Basic metadata applied',
      description: 'Please review and fill the remaining fields.',
    });
  };

  
  const applyPredictionsToForm = async (pred: any) => {
    let appliedCount = 0;
    const filledFields = new Set<string>();
    
    // Helper: Get natural empty value by field type
    const getEmptyValueForFieldType = (fieldType: EntityFieldConfig['type']): any => {
      switch (fieldType) {
        case 'tags':
        case 'multi-select':
          return [];
        case 'number':
          return null;
        default:
          return '';
      }
    };

    // 1. CLEAR PREVIOUS TYPE-SPECIFIC DATA
    if (formData.type && formData.type !== pred.type) {
      console.log(`🧹 Clearing ${formData.type} data before switching to ${pred.type}`);
      
      const previousConfig = entityTypeConfig[formData.type];
      if (previousConfig?.fields) {
        previousConfig.fields.forEach(field => {
          const emptyValue = getEmptyValueForFieldType(field.type);
          const storageCol = field.storageColumn;
          
          if (storageCol === 'metadata') {
            setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, [field.key]: emptyValue } }));
          } else if (storageCol === 'specifications') {
            setFormData(prev => ({ ...prev, specifications: { ...prev.specifications, [field.key]: emptyValue } }));
          } else if (storageCol === 'cast_crew') {
            setFormData(prev => ({ ...prev, cast_crew: { ...prev.cast_crew, [field.key]: emptyValue } }));
          } else if (storageCol === 'price_info') {
            setFormData(prev => ({ ...prev, price_info: { ...prev.price_info, [field.key]: emptyValue } }));
          } else if (storageCol === 'nutritional_info') {
            setFormData(prev => ({ ...prev, nutritional_info: {} }));
          } else if (storageCol === 'ingredients') {
            setFormData(prev => ({ ...prev, ingredients: [] }));
          } else if (storageCol === 'external_ratings') {
            setFormData(prev => ({ ...prev, external_ratings: {} }));
          } else if (storageCol) {
            setFormData(prev => ({ ...prev, [storageCol]: emptyValue }));
          }
        });
      }
    }
    
    // 2. Apply type
    if (pred.type) {
      handleInputChange('type', pred.type);
      handleInputChange('category_id', null);
      filledFields.add('type');
      appliedCount++;
    }
    
    // Apply name
    if (pred.name) {
      handleInputChange('name', pred.name);
      filledFields.add('name');
      appliedCount++;
    }
    
    // Apply description
    if (pred.description) {
      handleInputChange('description', pred.description);
      filledFields.add('description');
      appliedCount++;
    }
    
    // Apply category
    if (pred.category_id) {
      handleInputChange('category_id', pred.category_id);
      filledFields.add('category_id');
      appliedCount++;
    }
    
    // Apply tags - Use tag service to get real tag IDs
    if (pred.tags && Array.isArray(pred.tags)) {
      if (pred.tags.length > 0) {
        console.log('🏷️ Creating/fetching tags:', pred.tags);
        
        try {
          // Just use tag names directly - no need to fetch Tag objects
          setSelectedTagNames(pred.tags); // Set tag names
          filledFields.add('tags');
          appliedCount++;
          
          console.log('✅ Tags ready:', pred.tags);
        } catch (tagError) {
          console.error('❌ Failed to set tags:', tagError);
          toast({
            title: "Tag Application Failed",
            description: "Some tags couldn't be applied. You can add them manually.",
            variant: "default"
          });
          // Continue without tags rather than failing entirely
        }
      } else {
        setSelectedTagNames([]); // Clear when empty array
      }
    }
    
    // Apply images - prefer metadata images over AI prediction
    let imagesApplied = 0;

    // Priority 1: URL metadata images (from og:image, JSON-LD, etc.)
    if (urlMetadata?.images && Array.isArray(urlMetadata.images) && urlMetadata.images.length > 0) {
      console.log(`🖼️ Processing ${urlMetadata.images.length} metadata images`);
      
      // Collect all new media items first (batch state update to avoid race condition)
      const newMediaItems: MediaItem[] = [];
      
      urlMetadata.images.forEach((imageItem: any) => {
        const imageUrl = typeof imageItem === 'string' ? imageItem : imageItem.url;
        
        // Check if image already exists
        const exists = uploadedMedia.some(item => item.url === imageUrl);
        if (!exists && !newMediaItems.some(item => item.url === imageUrl)) {
          const newMediaItem: MediaItem = {
            id: crypto.randomUUID(),
            url: imageUrl,
            type: 'image',
            order: uploadedMedia.length + newMediaItems.length,
            caption: 'From URL metadata',
            source: 'external',
          };
          newMediaItems.push(newMediaItem);
        }
      });
      
      // Batch update: Add all media items at once
      if (newMediaItems.length > 0) {
        setUploadedMedia(prev => [...prev, ...newMediaItems]);
        imagesApplied = newMediaItems.length;
        
        // Phase 2 v8: functional update so a just-reset primary (null) is seen.
        setPrimaryMediaUrl(prev => prev || newMediaItems[0].url);
        
        console.log(`✅ Batched ${imagesApplied} metadata images to gallery`);
      }
      
      // Set first image as primary
      handleInputChange('image_url', urlMetadata.images[0]);
      filledFields.add('image_url');
      appliedCount++;
      
    } 
    // Fallback 1: Single metadata image (backward compatibility)
    else if (urlMetadata?.image) {
      handleInputChange('image_url', urlMetadata.image);
      addImageToMediaGallery(urlMetadata.image, 'metadata');
      filledFields.add('image_url');
      appliedCount++;
      imagesApplied = 1;
      console.log('🖼️ Applied single metadata image:', urlMetadata.image);
    } 
    // Fallback 2: AI-predicted images
    else if (pred.images && Array.isArray(pred.images) && pred.images.length > 0) {
      console.log(`🖼️ Processing ${pred.images.length} AI-predicted images`);
      
      // Collect all new media items first (batch state update to avoid race condition)
      const newMediaItems: MediaItem[] = [];
      
      pred.images.forEach((imageObj: any) => {
        const imageUrl = imageObj.url || imageObj;
        
        // Check if image already exists
        const exists = uploadedMedia.some(item => item.url === imageUrl);
        if (!exists && !newMediaItems.some(item => item.url === imageUrl)) {
          const newMediaItem: MediaItem = {
            id: crypto.randomUUID(),
            url: imageUrl,
            type: 'image',
            order: uploadedMedia.length + newMediaItems.length,
            caption: 'AI-extracted',
            source: 'external',
          };
          newMediaItems.push(newMediaItem);
        }
      });
      
      // Batch update: Add all media items at once
      if (newMediaItems.length > 0) {
        setUploadedMedia(prev => [...prev, ...newMediaItems]);
        imagesApplied = newMediaItems.length;
        
        // Phase 2 v8: functional update so a just-reset primary (null) is seen.
        setPrimaryMediaUrl(prev => prev || newMediaItems[0].url);
        
        console.log(`✅ Batched ${imagesApplied} AI images to gallery`);
      }
      
      // Set first image as primary
      const firstImageUrl = pred.images[0].url || pred.images[0];
      handleInputChange('image_url', firstImageUrl);
      filledFields.add('image_url');
      appliedCount++;
      
    }
    
    // Apply website URL from analyzed URL
    if (aiPredictions.metadata?.analyzed_url) {
      handleInputChange('website_url', aiPredictions.metadata.analyzed_url);
      filledFields.add('website_url');
    }
    
    // 3. MAP TYPE-SPECIFIC FIELDS FROM ADDITIONAL_DATA
    if (pred.additional_data && pred.type) {
      const typeConfig = entityTypeConfig[pred.type];
      
      if (typeConfig?.fields) {
        console.log(`📋 Mapping additional fields for ${pred.type}`);
        
        typeConfig.fields.forEach(fieldConfig => {
          const aiValue = pred.additional_data[fieldConfig.key];
          
          if (aiValue !== undefined && aiValue !== null) {
            handleTypeSpecificFieldChange(fieldConfig.key, aiValue, pred.type);
            filledFields.add(fieldConfig.key);
            appliedCount++;
          }
        });
      }
    }
    
    // Update AI-filled fields tracker
    setAiFilledFields(filledFields);
    
    // Close modal
    setShowPreviewModal(false);
    
    // Show success toast with image count
    const imageCount = imagesApplied || 0;
    const mediaMessage = imageCount > 0 
      ? ` (including ${imageCount} image${imageCount > 1 ? 's' : ''} added to gallery)` 
      : '';

    toast({
      title: "Form Updated",
      description: `Applied ${appliedCount} fields${mediaMessage} from URL analysis`,
    });
    
    console.log('✅ Applied predictions:', pred);
  };


  /**
   * Phase 3.2 — accepts optional `overrides` so callers (e.g. DraftReviewBody)
   * can pass an explicit parent, metadata patch, and primary image without
   * round-tripping through React state. When overrides are omitted, behavior
   * is identical to the pre-Phase-3.2 implementation.
   */
  const handleSubmit = async (overrides?: {
    parentOverride?: Entity | null;
    metadataOverride?: Record<string, any>;
    imageOverride?: string | null;
    /** Phase 3.2 bugfix — full-field patch from DraftReviewBody. When
     *  present, its values take precedence over current React form state
     *  for validation, slug generation, and insert. Avoids state races. */
    formPatch?: import('./entity-create/buildEntityFormPatch').EntityFormPatch;
    tagsOverride?: string[];
    /** Phase 3.3A — set true when the user has already chosen
     *  "It's different, continue" in the duplicate dialog, so we skip the
     *  pre-insert duplicate check on this re-submit. */
    _duplicateConfirmed?: boolean;
    /** Phase 3.3A — telemetry: marks this submit as coming from URL/draft flow. */
    _fromDraftFlow?: boolean;
  }) => {
    // Gate submission for user variant
    if (variant === 'user' && !user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create entities',
        variant: 'destructive'
      });
      return;
    }

    // Resolve effective field values: explicit formPatch wins, then state.
    const patch = overrides?.formPatch ?? {};
    const eff = {
      name: (patch.name ?? formData.name ?? '') as string,
      type: (patch.type ?? formData.type ?? '') as string,
      description: (patch.description ?? formData.description ?? '') as string,
      website_url: (patch.website_url ?? formData.website_url ?? '') as string,
      image_url: (patch.image_url ?? formData.image_url ?? '') as string,
      category_id: (patch.category_id !== undefined ? patch.category_id : formData.category_id) as string | null,
      authors: (patch.authors ?? formData.authors) as string[],
      languages: (patch.languages ?? formData.languages) as string[],
      isbn: (patch.isbn ?? formData.isbn) as string,
      publication_year: (patch.publication_year ?? formData.publication_year) as number | null,
      ingredients: (patch.ingredients ?? formData.ingredients) as string[],
      metadata: patch.metadata ? { ...formData.metadata, ...patch.metadata } : formData.metadata,
      cast_crew: patch.cast_crew ? { ...formData.cast_crew, ...patch.cast_crew } : formData.cast_crew,
      specifications: patch.specifications ? { ...formData.specifications, ...patch.specifications } : formData.specifications,
      price_info: patch.price_info ? { ...formData.price_info, ...patch.price_info } : formData.price_info,
      nutritional_info: patch.nutritional_info ? { ...formData.nutritional_info, ...patch.nutritional_info } : formData.nutritional_info,
      external_ratings: patch.external_ratings ? { ...formData.external_ratings, ...patch.external_ratings } : formData.external_ratings,
    };
    const effTags = overrides?.tagsOverride ?? selectedTagNames;

    if (!eff.name.trim() || !eff.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required',
        variant: 'destructive'
      });
      return;
    }

    // Validate "others" type requires explanation
    if (eff.type === 'others' && !otherTypeReason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please explain why this entity doesn\'t fit existing types',
        variant: 'destructive'
      });
      return;
    }

    // Validate type-specific required fields from config (uses effective values)
    const typeConfig = entityTypeConfig[eff.type];
    if (typeConfig?.requiredFields) {
      for (const fieldKey of typeConfig.requiredFields) {
        const fieldConfig = typeConfig.fields.find(f => f.key === fieldKey);
        if (!fieldConfig) continue;

        const storageColumn = fieldConfig.storageColumn || 'metadata';
        let value: any;

        switch (storageColumn) {
          case 'metadata':
            value = eff.metadata?.[fieldKey]; break;
          case 'cast_crew':
            value = eff.cast_crew?.[fieldKey]; break;
          case 'specifications':
            value = eff.specifications?.[fieldKey]; break;
          case 'price_info':
            value = eff.price_info?.[fieldKey]; break;
          default:
            value = (eff as any)[storageColumn];
        }

        const isEmpty = !value || (Array.isArray(value) && value.length === 0) || value === '';

        if (isEmpty) {
          toast({
            title: 'Validation Error',
            description: `${fieldConfig.label} is required for ${getEntityTypeLabel(eff.type)}`,
            variant: 'destructive'
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      // Check for duplicate website URL if provided (only among non-deleted entities)
      if (eff.website_url.trim()) {
        const { data: existingEntity, error: checkError } = await supabase
          .from('entities')
          .select('id, name')
          .eq('website_url', eff.website_url.trim())
          .eq('is_deleted', false)
          .maybeSingle();

        if (existingEntity && !checkError) {
          toast({
            title: 'Duplicate Website URL',
            description: `An entity "${existingEntity.name}" already exists with this website URL.`,
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }
      }

    // Resolve effective parent / metadata / primary image from overrides.
    // `undefined` means "no override" — fall back to React state. `null` is
    // a valid override meaning "no parent / no image".
    const resolvedParent =
      overrides && 'parentOverride' in overrides
        ? overrides.parentOverride ?? null
        : selectedParent;
    const overrideMetadata = overrides?.metadataOverride ?? {};
    const overridePrimaryImage =
      overrides && 'imageOverride' in overrides ? overrides.imageOverride : undefined;

      // ─── Phase 3.3A-2 — pre-insert duplicate check ───────────────────
      // Read-only fuzzy-name/website/slug match; only runs once per submit.
      if (!overrides?._duplicateConfirmed) {
        try {
          const fromSearch = Boolean(aiPredictions?.__fromSearch);
          const searchSourceUrl = fromSearch
            ? ((aiPredictions as any)?.searchSourceUrl
                ?? (aiPredictions as any)?.metadata?.search_source_url
                ?? null)
            : null;
          const { data: dupData, error: dupErr } = await supabase.functions.invoke(
            'check-entity-duplicates',
            {
              body: {
                name: eff.name.trim(),
                type: eff.type,
                parentId: resolvedParent?.id ?? null,
                websiteUrl: eff.website_url.trim() || null,
                sourceUrl: searchSourceUrl,
              },
            }
          );
          if (!dupErr && dupData?.candidates?.length > 0) {
            console.log('🔎 Duplicate candidates found:', dupData.candidates.length);
            pendingSubmitOverridesRef.current = overrides;
            // Phase 3.5c — capture origin so "Use this" can route search-origin
            // duplicates into ?compose=review while keeping URL/manual behavior.
            pendingDuplicateOriginRef.current =
              aiPredictions?.__fromSearch ? 'search' : 'other';
            setDupCandidates(dupData.candidates as DuplicateCandidate[]);
            setDupDialogOpen(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Duplicate check failed (non-fatal):', e);
        }
      }

      // ─── Phase 3.3A-1 — resolve pending uploads (blob:) → CDN URLs ────
      // Required BEFORE entity insert so entities.image_url is never a blob:.
      const blobPrefix = 'blob:';
      const hasPending =
        uploadedMedia.some(m => m.url.startsWith(blobPrefix)) ||
        (typeof primaryMediaUrl === 'string' && primaryMediaUrl.startsWith(blobPrefix));
      const resolvedUrlByBlob = new Map<string, string>();
      if (hasPending) {
        if (!user?.id) {
          toast({ title: 'Sign-in required to upload images', variant: 'destructive' });
          setLoading(false);
          return;
        }
        try {
          for (const m of uploadedMedia) {
            if (!m.url.startsWith(blobPrefix)) continue;
            const file = pendingFilesRef.current.get(m.url);
            if (!file) continue;
            const result = await uploadEntityImage(file, user.id);
            if (!result?.success || !result.url) {
              throw new Error(result?.error || 'Upload failed');
            }
            resolvedUrlByBlob.set(m.url, result.url);
          }
        } catch (uErr) {
          console.error('Pending upload failed:', uErr);
          toast({
            title: 'Image upload failed',
            description: uErr instanceof Error ? uErr.message : 'Try again.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }
      const resolvePrimary = (u: string | null | undefined) =>
        (u && u.startsWith(blobPrefix) && resolvedUrlByBlob.get(u)) || u || null;
      const resolvedPrimaryMedia = resolvePrimary(primaryMediaUrl);
      const resolvedFirstMedia = resolvePrimary(uploadedMedia[0]?.url);
      const resolvedOverridePrimary = overridePrimaryImage !== undefined
        ? resolvePrimary(overridePrimaryImage as string | null)
        : undefined;

    // Phase 3.3A / 3.5c telemetry: stamp creation_source.
    // Search-to-Draft creations are stamped as 'search' (not 'url').
    // The URL analyze flow stays 'url'. Manual creations stay 'manual'.
    const fromSearch = Boolean(aiPredictions?.__fromSearch);
    const creationSource = fromSearch
      ? 'search'
      : overrides?._fromDraftFlow ? 'url' : 'manual';
    const telemetryStamp: Record<string, unknown> = { creation_source: creationSource };
    if (!fromSearch && overrides?._fromDraftFlow && (analyzeUrl || lastAppliedUrl)) {
      telemetryStamp.created_from_url = analyzeUrl || lastAppliedUrl;
    }
    if (fromSearch) {
      const searchSourceUrl = (aiPredictions as any)?.searchSourceUrl;
      if (typeof searchSourceUrl === 'string' && searchSourceUrl.length > 0) {
        // Never overwrites website_url or created_from_url — separate key.
        telemetryStamp.search_source_url = searchSourceUrl;
      }
    }

    const metadata = {
      ...eff.metadata,
      ...overrideMetadata,
      business_hours: businessHours,
      contact: contactInfo,
      ...(eff.type === 'others' && otherTypeReason.trim() && {
        other_type_reason: otherTypeReason.trim()
      }),
      ...telemetryStamp,
    };



      // Generate slug based on parent context — use effective name
      const baseSlug = eff.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');

      const hierarchicalSlug = resolvedParent
        ? `${resolvedParent.slug || resolvedParent.id}-${baseSlug}`
        : baseSlug;

      // ─── Phase 3.4C — non-admin preflight + atomic RPC branch ────────
      // Quota is authoritatively enforced by the DB trigger and
      // create_brand_and_entity_atomic. This client preflight only
      // gives users a friendly early-exit instead of a raw DB error.
      let atomicNewEntity: any | null = null;
      if (!isAdmin && user?.id) {
        const requiredSlots = pendingBrandForAtomic ? 2 : 1;
        const { data: quotaData, error: quotaErr } = await supabase.rpc(
          'get_entity_creation_quota_status',
          {
            _user_id: user.id,
            _max_entities: 10,
            _window_hours: 24,
            _required_count: requiredSlots,
          },
        );
        if (quotaErr) {
          toast({
            title: 'Could not verify your daily limit',
            description: quotaErr.message || 'Please try again in a moment.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        const quota = (quotaData ?? {}) as {
          allowed?: boolean; used?: number; max?: number; remaining?: number;
        };
        if (!quota.allowed) {
          toast({
            title: 'Daily limit reached',
            description:
              requiredSlots === 2
                ? `You have ${quota.remaining ?? 0} slot(s) left today and need 2 to create a brand + product. Try "Not sure" for the brand.`
                : 'You can create up to 10 new entities per day.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Atomic brand + entity path
        if (pendingBrandForAtomic) {
          const brandC = pendingBrandForAtomic;
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'create_brand_and_entity_atomic',
            {
              _brand_name: brandC.name,
              _entity_name: eff.name.trim(),
              _entity_type: eff.type as any,
              _brand_website_url: brandC.websiteUrl ?? null,
              _brand_image_url: brandC.logoUrl ?? null,
              _brand_description: brandC.reason ?? null,
              _entity_category_id: eff.category_id || null,
              _entity_description: eff.description || null,
              _entity_website_url: eff.website_url.trim() || null,
              _entity_image_url:
                (resolvedOverridePrimary !== undefined
                  ? resolvedOverridePrimary
                  : null) ||
                resolvedPrimaryMedia ||
                resolvedFirstMedia ||
                eff.image_url.trim() ||
                null,
              _entity_metadata: metadata,
            },
          );
          if (rpcErr) {
            const msg = rpcErr.message || '';
            const description =
              msg.includes('entity_creation_quota_exceeded')
                ? 'You can create up to 10 new entities per day.'
                : msg.includes('conflict_requires_admin')
                ? 'This brand needs admin review. Try "Not sure" for the brand for now.'
                : msg.includes('non_admin_entity_creation_disabled')
                ? "Entity creation isn't available for your account right now."
                : msg.includes('invalid_url')
                ? 'One of the URLs looks invalid. Please check and try again.'
                : msg.includes('metadata_too_large')
                ? 'Additional data is too large. Please simplify and retry.'
                : msg.includes('slug_generation_failed')
                ? 'Could not generate a unique URL slug. Try a different name.'
                : msg || 'Could not create the entity.';
            toast({ title: 'Create failed', description, variant: 'destructive' });
            setLoading(false);
            return;
          }
          const result = (rpcData ?? {}) as { entity?: any; brand?: any };
          atomicNewEntity = result.entity ?? null;
          if (!atomicNewEntity) {
            toast({
              title: 'Create failed',
              description: 'Unexpected empty response.',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
        }
      }

      const { data: newEntity, error } = atomicNewEntity
        ? { data: atomicNewEntity, error: null as any }
        : await supabase
        .from('entities')
        .insert([{
          name: eff.name.trim(),
          type: eff.type as any,
          description: eff.description || null,
          image_url: (() => {
            const candidate =
              (resolvedOverridePrimary !== undefined ? resolvedOverridePrimary : null) ||
              resolvedPrimaryMedia ||
              resolvedFirstMedia ||
              eff.image_url.trim() ||
              null;
            // Hard guarantee: never persist blob: URLs.
            if (typeof candidate === 'string' && candidate.startsWith('blob:')) {
              throw new Error('Internal: unresolved pending upload reached insert');
            }
            return candidate;
          })(),
          website_url: eff.website_url.trim() || null,
          venue: formData.venue.trim() || null,
          metadata,
          created_by: user?.id || null,
          slug: hierarchicalSlug,
          parent_id: resolvedParent?.id || null,
          category_id: eff.category_id || null,
          // Type-specific columns (effective values)
          authors: eff.authors.length > 0 ? eff.authors : null,
          languages: eff.languages.length > 0 ? eff.languages : null,
          isbn: eff.isbn || null,
          publication_year: eff.publication_year || null,
          cast_crew: Object.keys(eff.cast_crew).length > 0 ? eff.cast_crew : null,
          ingredients: eff.ingredients.length > 0 ? eff.ingredients : null,
          specifications: Object.keys(eff.specifications).length > 0 ? eff.specifications : null,
          price_info: Object.keys(eff.price_info).length > 0 ? eff.price_info : null,
          nutritional_info: Object.keys(eff.nutritional_info).length > 0 ? eff.nutritional_info : null,
          external_ratings: Object.keys(eff.external_ratings).length > 0 ? eff.external_ratings : null,
        }])
        .select()
        .single();

      if (error) throw error;

      // Convert tag names to Tag objects and save (effective tags)
      if (newEntity && effTags.length > 0) {
        try {
          // Convert all tag names to Tag objects (creates if needed)
          const tagObjects = await Promise.all(
            effTags.map(name => getOrCreateTag(name))
          );

          
          // Create tag assignments
          const tagAssignments = tagObjects.map(tag => ({
            entity_id: newEntity.id,
            tag_id: tag.id,
            created_by: user?.id
          }));
          
          const { error: tagsError } = await supabase
            .from('entity_tags')
            .insert(tagAssignments);
          
          if (tagsError) {
            console.error('Error saving tags:', tagsError);
          }
        } catch (tagError) {
          console.error('Error creating tags:', tagError);
          // Non-fatal - entity already created, just log the error
        }
      }

      // Upload media if any
      if (newEntity && uploadedMedia.length > 0) {
        if (!user?.id) {
          console.error('No authenticated user for media upload');
        } else {
          try {
            // Phase 3.3A — rewrite any blob: URLs to their resolved CDN URLs.
            const rewrittenMedia: MediaItem[] = uploadedMedia.map(m =>
              m.url.startsWith('blob:') && resolvedUrlByBlob.has(m.url)
                ? { ...m, url: resolvedUrlByBlob.get(m.url)!, source: 'external' as const }
                : m
            );
            // Separate external URLs from uploaded files
            const externalMedia = rewrittenMedia.filter(item => item.source === 'external');
            const uploadedFiles = rewrittenMedia.filter(item => item.source !== 'external');
            
            const uploadedPhotos: any[] = [];
            
            // Handle uploaded files (existing logic)
            if (uploadedFiles.length > 0) {
              console.log('📤 Uploading file-based media:', uploadedFiles.length);
              const filePhotos = await uploadEntityMediaBatch(
                uploadedFiles,
                newEntity.id,
                user.id,
                (progress, total) => {
                  console.log(`Uploading files: ${progress}/${total}`);
                }
              );
              uploadedPhotos.push(...filePhotos);
            }
            
            // Handle external URLs separately - insert directly into entity_photos
            if (externalMedia.length > 0) {
              console.log('🌐 Inserting external media URLs:', externalMedia.length);
              
              for (const mediaItem of externalMedia) {
                const { data: photoData, error: photoError } = await supabase
                  .from('entity_photos')
                  .insert({
                    entity_id: newEntity.id,
                    user_id: user.id,
                    url: mediaItem.url,
                    caption: mediaItem.caption || null,
                    alt_text: mediaItem.alt || null,
                    category: mediaItem.category || 'general',
                    status: 'approved',
                    moderation_status: 'approved',
                    width: mediaItem.width || null,
                    height: mediaItem.height || null,
                    content_type: 'image/*'
                  })
                  .select()
                  .single();
                
                if (photoError) {
                  console.error('❌ Failed to insert external media:', photoError);
                  throw photoError;
                }
                
                if (photoData) {
                  uploadedPhotos.push(photoData);
                  console.log('✅ External media inserted:', mediaItem.url);
                }
              }
            }

            // Set first media item as primary image
            if (uploadedPhotos.length > 0 && uploadedMedia[0]) {
              await supabase
                .from('entities')
                .update({ image_url: uploadedMedia[0].url })
                .eq('id', newEntity.id);
            }
          } catch (mediaError: any) {
            console.error('Error uploading media:', mediaError);
            
            // Show detailed error message
            const errorMessage = mediaError?.message || 
                                mediaError?.error_description || 
                                'Some media failed to upload';
            
            toast({
              title: 'Warning',
              description: `Entity created, but media upload failed: ${errorMessage}`,
              variant: 'default'
            });
          }
        }
      }

      // Phase 3.3A-2 — persist suspected duplicate pairs (idempotent).
      // Only runs if the user clicked "It's different, continue".
      if (overrides?._duplicateConfirmed && newEntity && dupCandidates.length > 0) {
        try {
          const rows = dupCandidates.map(c => ({
            entity_a_id: newEntity.id,
            entity_b_id: c.id,
            similarity_score: c.score,
            detection_method: (c.reasons[0] || 'fuzzy_name').slice(0, 40),
            status: 'pending' as const,
          }));
          const { error: dupInsErr } = await supabase
            .from('duplicate_entities')
            .upsert(rows, { onConflict: 'entity_a_id,entity_b_id,detection_method', ignoreDuplicates: true });
          if (dupInsErr) console.warn('duplicate_entities persist failed:', dupInsErr);
        } catch (e) {
          console.warn('duplicate_entities persist error:', e);
        }
        setDupCandidates([]);
      }

      // Phase 3.3A — revoke blob URLs we created during this submit.
      trackedBlobsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
      trackedBlobsRef.current.clear();
      pendingFilesRef.current.clear();

      toast({
        title: 'Success',
        description: 'Entity created successfully',
      });

      // Phase 3.5c — funnel: entity_created (search-origin only).
      if (fromSearch && newEntity) {
        // Phase 3.5c v2 — compute finalization diff from immutable snapshot.
        let diff: SearchFinalizationDiff | undefined;
        const snap = searchSnapshotRef.current;
        if (snap) {
          const finalImageUrl = (newEntity.image_url as string | null | undefined) ?? null;
          let finalImageSource: FinalImageSource;
          if (!finalImageUrl) {
            finalImageSource = 'none';
          } else if (snap.imageCandidatesByUrl[finalImageUrl]) {
            finalImageSource = snap.imageCandidatesByUrl[finalImageUrl] as FinalImageSource;
          } else if (finalImageUrl === snap.imageUrlAtPrefill) {
            // Same as prefill but not a candidate → treat as initial (or unknown).
            finalImageSource = snap.initialImageSource as FinalImageSource;
          } else {
            finalImageSource = 'user_replaced';
          }
          const finalRawSource = snap.imageCandidatesByRawSource[finalImageUrl ?? ''];
          const finalMethod =
            finalImageSource === 'google_images'
              ? mapCandidateSourceToMethod(finalRawSource) ?? 'unknown'
              : undefined;
          const imageMethod: ImageMethod | undefined =
            finalMethod ??
            (snap.initialImageSource === 'google_images' ? snap.initialImageMethod ?? 'unknown' : undefined);

          const finalMeta = pickUserRelevantMetadata((newEntity as any).metadata ?? {});
          diff = {
            nameChanged: normalizeText(newEntity.name) !== normalizeText(snap.nameGuess),
            categoryChanged:
              ((newEntity as any).category_id ?? null) !== (snap.categoryIdGuess ?? null),
            brandChanged: (resolvedParent?.id ?? null) !== snap.brandId,
            imageChanged: (finalImageUrl ?? null) !== (snap.imageUrlAtPrefill ?? null),
            descriptionChanged:
              normalizeText((newEntity as any).description ?? '') !==
              normalizeText(snap.descriptionGuess),
            websiteChanged:
              normalizeText((newEntity as any).website_url ?? '') !==
              normalizeText(snap.websiteGuess),
            metadataChanged: JSON.stringify(finalMeta) !== JSON.stringify(snap.metadataGuess),
            imageUserReplaced: finalImageSource === 'user_replaced',
            initialImageSource: snap.initialImageSource,
            finalImageSource,
            brandDecisionType: snap.brandDecisionType,
            ...(imageMethod ? { imageMethod } : {}),
          };
        }
        void logFunnel({
          event: 'entity_created',
          source: 'search',
          entityType: newEntity.type,
          diagnostics: { latencyMs: consumePickLatency(), ...(diff ? { diff } : {}) },
        });
      }

      resetForm();
      onOpenChange(false);
      onEntityCreated(newEntity ? {
        id: newEntity.id,
        name: newEntity.name,
        type: newEntity.type,
        image_url: newEntity.image_url || undefined,
      } : undefined);

      // Phase 3.4D — for non-admin (variant === 'user') creations, show the
      // post-create continuation prompt instead of auto-navigating. Admin
      // behavior (auto-navigate to the entity page) is preserved.
      if (newEntity) {
        if (variant === 'user') {
          setContinuationEntity({
            id: newEntity.id,
            name: newEntity.name,
            slug: newEntity.slug,
            type: newEntity.type,
            isPending: !isAdmin,
          });
        } else {
          navigate(`/entity/${newEntity.slug}`);
        }
      }
    } catch (error: any) {
      console.error('Error creating entity:', error);
      
      // Extract detailed error information
      let errorMessage = 'Unknown error';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Special handling for common errors
      if (errorMessage.includes('duplicate key') && errorMessage.includes('website_url')) {
        errorMessage = 'An entity with this website URL already exists. Please use a different URL or update the existing entity.';
      } else if (errorMessage.includes('storage.policies')) {
        errorMessage = 'Storage configuration error. Please contact support.';
      }
      
      toast({
        title: 'Failed to Create Entity',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="bg-gradient-to-r from-brand-orange to-brand-orange/80 bg-clip-text text-transparent">
              {variant === 'user' ? 'Add to CommonGroundz' : 'Create New Entity'}
            </span>
            {draftRestored && <span className="text-sm text-muted-foreground ml-2">(Draft restored)</span>}
          </DialogTitle>
          <DialogDescription>
            {variant === 'user' 
              ? 'Share what you love with the community'
              : 'Add a new entity with business hours and contact information'
            }
          </DialogDescription>
        </DialogHeader>

        {/* URL Hero Section - Available for both variants */}
        <div className="space-y-4 animate-fade-in">
            <Tabs value={createEntityTab} onValueChange={(v) => setCreateEntityTab(v as 'url' | 'search')}>
              {searchToDraftEnabled && (
                <TabsList className="grid w-full grid-cols-2 mb-3">
                  <TabsTrigger value="url" className="gap-2">
                    <Link2 className="h-4 w-4" /> Paste URL
                  </TabsTrigger>
                  <TabsTrigger value="search" className="gap-2">
                    <SearchIcon className="h-4 w-4" /> Search
                  </TabsTrigger>
                </TabsList>
              )}
              <TabsContent value="url" className="mt-0">
            {/* URL Auto-Fill Hero Card */}
            <div className="relative overflow-hidden rounded-lg border-2 border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 to-transparent p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    ✨ Quick Add from URL
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Paste a link from Goodreads, IMDb, Amazon, App Store, or any website to instantly fill details
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="analyze_url_hero"
                    value={analyzeUrl}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setAnalyzeUrl(newUrl);
                      setShowAnalyzeButton(isValidUrl(newUrl));
                      if (urlMetadata && newUrl !== urlMetadata.url) {
                        setUrlMetadata(null);
                      }
                    }}
                    placeholder="https://www.goodreads.com/book/show/..."
                    disabled={loading || analyzing}
                    className="bg-background pr-10"
                  />
                  {analyzeUrl && (
                    <button
                      onClick={() => {
                        setAnalyzeUrl('');
                        setShowAnalyzeButton(false);
                        setUrlMetadata(null);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                      type="button"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleAnalyzeUrl}
                  disabled={!showAnalyzeButton || analyzing || loading || engineLoading}
                  className="gap-2 min-w-[100px]"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
              
              {/* Rich URL Preview */}
              {urlMetadata && (
                <div className="mt-3 p-3 bg-background/80 rounded-lg border border-border shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* Favicon */}
                    {urlMetadata.favicon && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        <img 
                          src={urlMetadata.favicon} 
                          alt="Site icon"
                          className="w-6 h-6 object-contain"
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Site Name with External Link */}
                      <a 
                        href={urlMetadata.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 mb-1 hover:opacity-80 transition-opacity group"
                      >
                        <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                          {urlMetadata.siteName || getSafeDomain(urlMetadata.url)}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
                      </a>
                      
                      {/* Product Title */}
                      {urlMetadata.title && (
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {urlMetadata.title}
                        </p>
                      )}
                    </div>
                    
                    {/* Thumbnail Image */}
                    {urlMetadata.image && (
                      <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-muted">
                        <img 
                          src={urlMetadata.image}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
              </TabsContent>
              {searchToDraftEnabled && (
                <TabsContent value="search" className="mt-0">
                  <SearchEntryPanel
                    onPick={handleSearchPick}
                    onOpenExisting={handleSearchOpenExisting}
                  />
                </TabsContent>
              )}
            </Tabs>
            
            {/* Manual Entry Button - Only show for user variant when form is collapsed */}
            {variant === 'user' && !isFormExpanded && !urlAnalysisComplete && (
              <div className="flex items-center justify-center py-2">
                <button
                  onClick={() => setIsFormExpanded(true)}
                  className="text-sm text-brand-orange hover:text-brand-orange/80 transition-colors relative after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-px after:bg-brand-orange after:scale-x-0 after:transition-transform after:duration-200 hover:after:scale-x-100"
                  type="button"
                >
                  Or Enter Details Manually
                </button>
              </div>
            )}
        </div>

        {/* Show tabs immediately for admin, or after expansion/analysis for users */}
        {(variant === 'admin' || isFormExpanded || urlAnalysisComplete) && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 animate-fade-in">
            <TabsList className="relative flex overflow-x-auto overflow-y-hidden scrollbar-hide w-full bg-transparent border-b border-border min-h-[48px]">
            {shouldShowTab('basic') && (
              <TabsTrigger value="basic" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                ℹ️ Basic Info
              </TabsTrigger>
            )}
            {shouldShowTab('contact') && (
              <TabsTrigger value="contact" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                📞 Contact
              </TabsTrigger>
            )}
            {shouldShowTab('hours') && (
              <TabsTrigger value="hours" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                🕐 Business Hours
              </TabsTrigger>
            )}
            {shouldShowTab('details') && formData.type && formData.type !== 'others' && (
              <TabsTrigger value="details" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                {(() => {
                  const typeConfig = entityTypeConfig[formData.type];
                  const icon = typeConfig?.fieldGroups?.[0]?.icon || '📋';
                  return `${icon} ${getEntityTypeLabel(formData.type)} Details`;
                })()}
              </TabsTrigger>
            )}
            {shouldShowTab('preview') && (
              <TabsTrigger value="preview" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                👁️ Preview
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Entity name"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => handleInputChange('type', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getActiveEntityTypes().map(type => (
                      <SelectItem key={type} value={type}>
                        {getEntityTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category Selector */}
            {formData.type && (
              <CategorySelector
                entityType={formData.type as EntityType}
                value={formData.category_id}
                onChange={(id) => handleInputChange('category_id', id)}
                filterByEntityType={formData.type}
                disabled={loading}
                mode="drill-down"
                required={true}
              />
            )}

            {/* Tag Input */}
            <SimpleTagInput
              value={selectedTagNames}
              onChange={setSelectedTagNames}
              disabled={loading}
              onClearAll={() => setSelectedTagNames([])}
              label="Tags"
              placeholder="Type a tag and press Enter"
              maxTags={10}
            />

            {formData.type === 'others' && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="otherTypeReason">
                  Explain why this entity doesn't fit existing types <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="otherTypeReason"
                  value={otherTypeReason}
                  onChange={(e) => setOtherTypeReason(e.target.value)}
                  placeholder="Provide a brief explanation..."
                  rows={2}
                  disabled={loading}
                  className="resize-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <RichTextEditor
                value={formData.description}
                onChange={(json, html) => handleInputChange('description', html)}
                placeholder="Describe this entity..."
                editable={!loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Entity Media</Label>
              
              {uploadedMedia.length > 0 && (
                <CompactMediaGrid
                  media={uploadedMedia}
                  onRemove={(mediaToRemove) => {
                    setUploadedMedia(prev => {
                      const filtered = prev.filter(m => m.url !== mediaToRemove.url);
                      
                      // If removed media was primary, fall back to next available
                      if (primaryMediaUrl === mediaToRemove.url) {
                        const newPrimary = filtered[0]?.url ?? null;
                        setPrimaryMediaUrl(newPrimary);
                        
                        // Persist updated primary to session storage
                        const currentDraft = sessionStorage.getItem(DRAFT_KEY);
                        if (currentDraft) {
                          const draft = JSON.parse(currentDraft);
                          draft.primaryMediaUrl = newPrimary;
                          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                        }
                      }
                      
                      return filtered;
                    });
                  }}
                  maxVisible={4}
                  className="mb-4"
                  primaryMediaUrl={primaryMediaUrl}
                  onSetPrimary={(url) => {
                    setPrimaryMediaUrl(url);
                    
                    // Persist updated primary to session storage
                    const currentDraft = sessionStorage.getItem(DRAFT_KEY);
                    if (currentDraft) {
                      const draft = JSON.parse(currentDraft);
                      draft.primaryMediaUrl = url;
                      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                    }
                  }}
                />
              )}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMediaUploadModal(true)}
                disabled={loading || uploadedMedia.length >= 4}
                className="w-full border-2 border-dashed border-brand-orange/40 bg-brand-orange/5 hover:bg-brand-orange/10 hover:border-brand-orange/60 text-brand-orange hover:text-brand-orange transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                {uploadedMedia.length === 0 ? 'Add Photos & Videos' : `Add More Media (${uploadedMedia.length}/4)`}
              </Button>
              
              {uploadedMedia.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add up to 4 photos or videos for this entity
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                value={formData.website_url}
                onChange={(e) => handleInputChange('website_url', e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">Official website (visible to all users)</p>
            </div>

            {shouldShowTab('businessHours') && (
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                  placeholder="Venue or location"
                  disabled={loading}
                />
              </div>
            )}

            <ParentEntitySelector
              selectedParent={selectedParent}
              onParentChange={setSelectedParent}
              className="pt-4 border-t"
            />
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <ContactInfoEditor
              value={contactInfo}
              onChange={setContactInfo}
              disabled={loading}
            />
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <BusinessHoursEditor
              value={businessHours}
              onChange={setBusinessHours}
              disabled={loading}
            />
          </TabsContent>

          {/* Dynamic Details Tab */}
          {formData.type && formData.type !== 'others' && (
            <TabsContent value="details" className="space-y-4">
              {(() => {
                const typeConfig = entityTypeConfig[formData.type];
                if (!typeConfig || !typeConfig.fieldGroups) return null;

                return typeConfig.fieldGroups.map((group, index) => {
                  const groupFields = typeConfig.fields.filter(f => 
                    group.fields.includes(f.key)
                  );
                  
                  return (
                    <DynamicFieldGroup
                      key={index}
                      title={group.title}
                      icon={group.icon}
                      fields={groupFields}
                      formData={formData}
                      onChange={handleTypeSpecificFieldChange}
                      disabled={loading}
                      errors={fieldErrors}
                      aiFilledFields={aiFilledFields}
                    />
                  );
                });
              })()}
            </TabsContent>
          )}
          
          {/* Preview JSON Tab */}
          <TabsContent value="preview" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Final Data Structure</Label>
              <p className="text-sm text-muted-foreground">
                Review the data that will be saved to the database. Check for any missing or incorrect values.
              </p>
            </div>
            <div className="bg-muted rounded-md overflow-auto max-h-[500px]">
              <pre className="text-xs p-4 font-mono">
                {JSON.stringify({
                  // Basic fields
                  name: formData.name || '(empty)',
                  type: formData.type || '(empty)',
                  description: formData.description || '(empty)',
                  category_id: formData.category_id || null,
                  image_url: primaryMediaUrl || uploadedMedia[0]?.url || formData.image_url || null,
                  website_url: formData.website_url || null,
                  venue: formData.venue || null,
                  
                  // Type-specific direct columns (only if not empty)
                  ...(formData.authors.length > 0 && { authors: formData.authors }),
                  ...(formData.isbn && { isbn: formData.isbn }),
                  ...(formData.publication_year && { publication_year: formData.publication_year }),
                  ...(formData.languages.length > 0 && { languages: formData.languages }),
                  ...(formData.ingredients.length > 0 && { ingredients: formData.ingredients }),
                  
                  // JSONB columns (only if not empty)
                  ...(Object.keys(formData.metadata).length > 0 && { metadata: formData.metadata }),
                  ...(Object.keys(formData.cast_crew).length > 0 && { cast_crew: formData.cast_crew }),
                  ...(Object.keys(formData.specifications).length > 0 && { specifications: formData.specifications }),
                  ...(Object.keys(formData.price_info).length > 0 && { price_info: formData.price_info }),
                  ...(Object.keys(formData.nutritional_info).length > 0 && { nutritional_info: formData.nutritional_info }),
                  ...(Object.keys(formData.external_ratings).length > 0 && { external_ratings: formData.external_ratings }),
                  
                  // Contact & Business Hours
                  ...(Object.keys(contactInfo).length > 0 && { contact_info: contactInfo }),
                  ...(Object.keys(businessHours).length > 0 && { business_hours: businessHours }),
                  
                  // Parent entity
                  ...(selectedParent && { parent_id: selectedParent.id, parent_name: selectedParent.name }),
                  
                  // Tags
                  ...(selectedTagNames.length > 0 && { tags: selectedTagNames }),
                  
                  // Media
                  ...(uploadedMedia.length > 0 && { uploaded_media_count: uploadedMedia.length }),
                }, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
        )}

        <div className="flex justify-between items-center gap-4 pt-4 border-t">
          {/* Left side: Cancel or Back */}
          <div>
            {getCurrentTabIndex() === 0 ? (
              <Button 
                variant="outline" 
                onClick={() => { 
                  resetForm(); 
                  onOpenChange(false); 
                }} 
                disabled={loading}
              >
                Cancel
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={handlePreviousTab} 
                disabled={loading}
                className="border-brand-orange/30 hover:bg-brand-orange/5 hover:text-brand-orange transition-all duration-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          
          {/* Right side: Next or Create Entity (DISABLED WHEN INVALID) */}
          <div className="flex gap-2">
            {isLastTab() ? (
              <Button 
                onClick={() => handleSubmit({ _fromDraftFlow: prefilledFromDraftRef.current })} 
                disabled={loading || !isCurrentStepValid}
                className={`bg-gradient-to-r from-brand-orange to-brand-orange/90 hover:from-brand-orange/90 hover:to-brand-orange text-white shadow-md hover:shadow-lg transition-all duration-300 ${
                  !isCurrentStepValid && "opacity-50 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Entity'
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleNextTab}
                disabled={loading || !isCurrentStepValid}
                className={`bg-gradient-to-r from-brand-orange to-brand-orange/90 hover:from-brand-orange/90 hover:to-brand-orange text-white shadow-md hover:shadow-lg transition-all duration-300 ${
                  !isCurrentStepValid && "opacity-50 cursor-not-allowed"
                }`}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      
      <SimpleMediaUploadModal
        isOpen={showMediaUploadModal}
        onClose={() => setShowMediaUploadModal(false)}
        maxItems={4 - uploadedMedia.length}
        onSave={(mediaItems) => {
          // Enforce the cap by slicing to remaining slots
          const remainingSlots = MAX_MEDIA_ITEMS - uploadedMedia.length;
          const itemsToAdd = mediaItems.slice(0, remainingSlots);
          
          setUploadedMedia(prev => [...prev, ...itemsToAdd]);
          
          // Default primary to first item if none is set
          setPrimaryMediaUrl(prev => {
            const newPrimary = prev ?? itemsToAdd[0]?.url ?? null;
            
            // Persist updated primary to session storage
            const currentDraft = sessionStorage.getItem(DRAFT_KEY);
            if (currentDraft) {
              const draft = JSON.parse(currentDraft);
              draft.primaryMediaUrl = newPrimary;
              sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            }
            
            return newPrimary;
          });
          
          setShowMediaUploadModal(false);
        }}
      />
      
      {/* AI Preview Modal */}
      <AutoFillPreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        predictions={aiPredictions}
        onApply={applyAiPredictions}
        metadataOnly={!aiPredictions?.predictions ? buildMetadataOnly() : null}
        onApplyMetadataOnly={(snapshot) => commitApply(snapshot.websiteUrl, () => applyMetadataOnlySafe(snapshot))}
        useDraftReview={useDraftReviewFlag || Boolean(aiPredictions?.__fromSearch)}
        entityDraft={(() => {
          // Phase 3.2 bugfix — merge urlMetadata.images into the draft's
          // imageCandidates so the picker shows the lite-metadata images
          // that the AI/V2 path may have missed.
          //
          // v3 fix — for search-origin drafts, skip this merge entirely.
          // Stale urlMetadata from a prior URL analyze would otherwise
          // bleed images from another entity into the search draft.
          const baseDraft = aiPredictions?.entityDraft ?? null;
          if (!baseDraft) return null;
          if ((aiPredictions as any)?.__fromSearch) return baseDraft;
          const metaImgs = pickValidImages(urlMetadata);
          if (metaImgs.length === 0) return baseDraft;
          const existing = new Set(
            (baseDraft.imageCandidates ?? []).map((c: any) => c.url)
          );
          const extras = metaImgs
            .filter((u) => !existing.has(u))
            .map((u) => ({ url: u, source: 'page_metadata' as const, confidence: 0.55 }));
          return { ...baseDraft, imageCandidates: [...(baseDraft.imageCandidates ?? []), ...extras] };
        })()}
        urlMetadata={(aiPredictions as any)?.__fromSearch ? null : urlMetadata}
        analyzedUrlSnapshot={predictionUrlSnapshot}
        deferBrandCreationForAtomic={!isAdmin}
        onDeferBrandCreation={setPendingBrandForAtomic}
        onPrefillForm={async (overrides) => {
          prefilledFromDraftRef.current = true;
          const isFromSearch = Boolean((aiPredictions as any)?.__fromSearch);
          // v7 — Search Apply must clear previous form/media (URL Analyze
          // already does this inside commitApply). Prevents old images from
          // a prior search/URL analysis leaking into the next entity.
          if (isFromSearch) {
            resetEntityFormForNewAppliedUrl();
          }
          // Phase 3.5c v2 — Capture immutable Search-draft snapshot for
          // finalization diff. Only for Search-origin drafts.
          if (isFromSearch) {
            const draft = (aiPredictions as any)?.entityDraft;
            const cand = draft?.imageCandidates ?? [];
            const rec = cand[draft?.recommendedImageIndex ?? 0];
            const patchLocal = overrides.formPatch ?? {};
            const primaryAtPrefill = overrides.noImageChosen
              ? null
              : overrides.primaryPending
                ? overrides.primaryPending.previewUrl
                : (overrides.imageOverride ?? patchLocal.image_url ?? null);
            const primaryWasUpload = !!overrides.primaryPending;
            const byRaw: Record<string, string> = {};
            const byInitial: Record<string, ReturnType<typeof mapCandidateSourceToInitial>> = {};
            for (const c of cand) {
              if (c?.url && c?.source) {
                byRaw[c.url] = c.source;
                byInitial[c.url] = mapCandidateSourceToInitial(c.source);
              }
            }
            searchSnapshotRef.current = {
              nameGuess: patchLocal.name ?? draft?.nameGuess ?? '',
              descriptionGuess: patchLocal.description ?? draft?.descriptionGuess ?? '',
              websiteGuess: patchLocal.website_url ?? '',
              categoryIdGuess: (patchLocal.category_id !== undefined
                ? patchLocal.category_id
                : draft?.categoryHint?.id) ?? null,
              metadataGuess: pickUserRelevantMetadata({
                ...(draft?.structuredHints ?? {}),
                ...(patchLocal.metadata ?? {}),
                ...(overrides.metadataOverride ?? {}),
              }),
              brandId: overrides.parentOverride?.id ?? null,
              brandDecisionType: overrides.brandDecisionType ?? 'not_applicable',
              imageUrlAtPrefill: primaryAtPrefill,
              initialImageSource: primaryWasUpload
                ? 'unknown'
                : mapCandidateSourceToInitial(rec?.source),
              initialImageMethod: primaryWasUpload
                ? undefined
                : mapCandidateSourceToMethod(rec?.source),
              imageCandidatesByUrl: byInitial,
              imageCandidatesByRawSource: byRaw,
            };
          }
          // Phase 3.2 v6 — Stage 2 "Apply to Form": prefill host form state,
          // do NOT create the entity. The host form's Save button is the
          // only entity write path.
          const patch = overrides.formPatch ?? {};
          if (patch.type) handleInputChange('type', patch.type);
          if (patch.name) handleInputChange('name', patch.name);
          if (patch.description) handleInputChange('description', patch.description);
          if (patch.website_url) handleInputChange('website_url', patch.website_url);
          if (patch.category_id !== undefined) handleInputChange('category_id', patch.category_id);
          if (Array.isArray(overrides.tagsOverride)) {
            setSelectedTagNames(overrides.tagsOverride);
          }
          // Structured columns — merge so we never wipe existing manual edits.
          if (patch.metadata) {
            setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, ...patch.metadata, ...overrides.metadataOverride } }));
          } else if (overrides.metadataOverride && Object.keys(overrides.metadataOverride).length > 0) {
            setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, ...overrides.metadataOverride } }));
          }
          if (patch.cast_crew) setFormData(prev => ({ ...prev, cast_crew: { ...prev.cast_crew, ...patch.cast_crew } }));
          if (patch.specifications) setFormData(prev => ({ ...prev, specifications: { ...prev.specifications, ...patch.specifications } }));
          if (patch.price_info) setFormData(prev => ({ ...prev, price_info: { ...prev.price_info, ...patch.price_info } }));
          if (patch.nutritional_info) setFormData(prev => ({ ...prev, nutritional_info: { ...prev.nutritional_info, ...patch.nutritional_info } }));
          if (patch.external_ratings) setFormData(prev => ({ ...prev, external_ratings: { ...prev.external_ratings, ...patch.external_ratings } }));
          if (Array.isArray(patch.authors) && patch.authors.length) setFormData(prev => ({ ...prev, authors: patch.authors! }));
          if (Array.isArray(patch.languages) && patch.languages.length) setFormData(prev => ({ ...prev, languages: patch.languages! }));
          if (patch.isbn) setFormData(prev => ({ ...prev, isbn: patch.isbn! }));
          if (patch.publication_year != null) setFormData(prev => ({ ...prev, publication_year: patch.publication_year! }));
          if (Array.isArray(patch.ingredients) && patch.ingredients.length) setFormData(prev => ({ ...prev, ingredients: patch.ingredients! }));

          // Parent (brand) — resolved during Stage 1.
          setSelectedParent(overrides.parentOverride);

          // Phase 3.3A — handle "No image" first.
          if (overrides.noImageChosen) {
            handleInputChange('image_url', '');
            setPrimaryMediaUrl(null);
          } else {
            // Primary image (remote URL or pending blob: preview).
            const primaryPending = overrides.primaryPending ?? null;
            const primary = primaryPending
              ? primaryPending.previewUrl
              : (overrides.imageOverride ?? patch.image_url ?? null);
            if (primary) {
              handleInputChange('image_url', primary);
              if (primaryPending) {
                pendingFilesRef.current.set(primaryPending.previewUrl, primaryPending.file);
                trackedBlobsRef.current.add(primaryPending.previewUrl);
                // Add primary itself to media list as a pending item.
                addGalleryToMediaList([], [primaryPending]);
              } else {
                addImageToMediaGallery(primary, 'ai');
              }
              setPrimaryMediaUrl(primary);
            }
            // Gallery (remote + pending) — primary already added above.
            const galleryRemote = (overrides.galleryOverride ?? [])
              .filter(u => !primary || u !== primary);
            const galleryPending = (overrides.pendingUploads ?? [])
              .filter(p => !primaryPending || p.previewUrl !== primaryPending.previewUrl);
            if (galleryRemote.length > 0 || galleryPending.length > 0) {
              addGalleryToMediaList(galleryRemote, galleryPending);
            }
          }

          // Mark this URL as the last applied so the analyze-reset guard
          // doesn't wipe the prefill if the user re-analyzes the same URL.
          if (predictionUrlSnapshot) {
            setLastAppliedUrl(normalizeUrlForCompare(predictionUrlSnapshot));
          }

          // v3 — auto-expand the form for non-admin users, matching URL
          // Analysis "Apply to Form" behavior. Admin variant is always
          // expanded, so this is a no-op there.
          if (variant === 'user') {
            setUrlAnalysisComplete(true);
            setIsFormExpanded(true);
          }

          toast({
            title: 'Draft applied',
            description: 'Review the form and click Save to create the entity.',
          });
        }}
      />

      
      
      {/* URL Mismatch Warning Dialog */}
      <AlertDialog open={showUrlMismatchDialog} onOpenChange={setShowUrlMismatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              URL Type Mismatch
            </AlertDialogTitle>
            <AlertDialogDescription>
              {urlMismatchMessage}
              <br /><br />
              Would you like to proceed anyway or adjust the entity type?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (aiPredictions?.predictions) {
                commitApply(predictionUrlSnapshot, () => applyPredictionsToForm(aiPredictions.predictions));
              }
              setShowUrlMismatchDialog(false);
            }}>
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 3.3A-2 — "Did you mean?" pre-insert duplicate dialog */}
      <DuplicateConfirmDialog
        open={dupDialogOpen}
        candidates={dupCandidates}
        onCancel={() => {
          setDupDialogOpen(false);
          pendingSubmitOverridesRef.current = undefined;
          pendingDuplicateOriginRef.current = 'other';
        }}
        onUseExisting={(c) => {
          // Phase 3.5c — search-origin duplicates route into the deep-link
          // review composer. URL/manual origins keep their previous behavior.
          const isSearchOrigin = pendingDuplicateOriginRef.current === 'search';
          setDupDialogOpen(false);
          pendingSubmitOverridesRef.current = undefined;
          pendingDuplicateOriginRef.current = 'other';
          resetForm();
          onOpenChange(false);
          const base = `/entity/${c.slug || c.id}`;
          navigate(isSearchOrigin ? `${base}?compose=review` : base);
        }}
        onContinueNew={() => {
          setDupDialogOpen(false);
          const prev = pendingSubmitOverridesRef.current || {};
          pendingSubmitOverridesRef.current = undefined;
          pendingDuplicateOriginRef.current = 'other';
          // Re-submit, skipping the duplicate check this time.
          void handleSubmit({ ...prev, _duplicateConfirmed: true, _fromDraftFlow: prefilledFromDraftRef.current });
        }}
      />

      {/* Exact-URL preflight duplicate dialog (fires before Analyze spends credits) */}
      <ExactUrlDuplicateDialog
        open={preflightDupOpen}
        candidates={preflightDupCandidates}
        onCancel={() => {
          setPreflightDupOpen(false);
          setPreflightDupCandidates([]);
          setPendingAnalyzeUrl(null);
        }}
        onOpenExisting={(c) => {
          setPreflightDupOpen(false);
          setPreflightDupCandidates([]);
          setPendingAnalyzeUrl(null);
          resetForm();
          onOpenChange(false);
          
          navigate(`/entity/${c.slug || c.id}`);
        }}
        onContinueAnyway={() => {
          setPreflightDupOpen(false);
          setPreflightDupCandidates([]);
          setPendingAnalyzeUrl(null);
          skipEarlyDupCheckOnceRef.current = true;
          void handleAnalyzeUrl();
        }}
      />
    </Dialog>
    <PostCreateContinuation
      open={!!continuationEntity}
      entity={continuationEntity}
      onClose={() => setContinuationEntity(null)}
    />
    </>
  );
};