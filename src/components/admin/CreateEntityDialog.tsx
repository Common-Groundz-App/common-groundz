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

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated: () => void;
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
  const { toast } = useToast();
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
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false);
  const [aiPredictions, setAiPredictions] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showUrlMismatchDialog, setShowUrlMismatchDialog] = useState(false);
  const [urlMismatchMessage, setUrlMismatchMessage] = useState('');
  const [urlMetadata, setUrlMetadata] = useState<any>(null);
  
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
    
    // Reset category when type changes to prevent mismatches
    setFormData(prev => ({
      ...prev,
      category_id: null
    }));
  }, [formData.type, activeTab]);

  // Auto-search and select parent brand entity based on AI-extracted brand name
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

  // Auto-create parent brand entity if it doesn't exist
  const autoCreateParentBrand = async (brandName: string, sourceUrl: string) => {
    if (!brandName || brandName.length < 2) {
      console.log('⚠️ Brand name too short for auto-creation');
      return null;
    }

    console.log(`🚀 Auto-creating brand entity: "${brandName}"`);
    
    // Show loading toast
    toast({
      title: "Creating Brand",
      description: `Enriching ${brandName} data...`,
    });

    try {
      // Step 1: Enrich brand data first (logo, website, description)
      console.log(`🔍 Enriching brand data for: "${brandName}"`);
      const { data: enrichedData, error: enrichError } = await supabase.functions.invoke('enrich-brand-data', {
        body: { brandName }
      });

      if (enrichError) {
        console.warn('⚠️ Brand enrichment failed, creating with minimal data:', enrichError);
      }

      const enrichmentResult = enrichedData || { logo: null, website: null, description: null };
      console.log(`✅ Brand enrichment complete:`, enrichmentResult);

      // Step 2: Create brand with enriched data
      toast({
        title: "Creating Brand",
        description: `Setting up ${brandName}...`,
      });

      const { data, error } = await supabase.functions.invoke('create-brand-entity', {
        body: {
          brandName: brandName,
          sourceUrl: sourceUrl,
          userId: user?.id || null,
          logo: enrichmentResult.logo,
          website: enrichmentResult.website,
          description: enrichmentResult.description
        }
      });

      if (error) throw error;

      if (!data?.brandEntity) {
        throw new Error('No brand entity returned from creation');
      }

      const createdBrand = data.brandEntity;
      const alreadyExisted = data.alreadyExisted;

      console.log(`✅ Brand entity ${alreadyExisted ? 'found' : 'created'}: ${createdBrand.id}`);

      // Convert to Entity type and set as parent
      const parentEntity: Entity = {
        id: createdBrand.id,
        name: createdBrand.name,
        type: EntityType.Brand,
        image_url: createdBrand.image_url,
        slug: createdBrand.slug,
        description: createdBrand.description,
        api_ref: null,
        api_source: null,
        metadata: createdBrand.metadata || {},
        venue: null,
        website_url: createdBrand.website_url,
        category_id: null,
        popularity_score: null,
        photo_reference: null,
        created_at: createdBrand.created_at,
        updated_at: createdBrand.updated_at,
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
        title: alreadyExisted ? "Brand Linked" : "Brand Created",
        description: alreadyExisted 
          ? `Linked to existing ${createdBrand.name}` 
          : `Created and linked ${createdBrand.name}`,
      });

      return createdBrand;

    } catch (error: any) {
      console.error('❌ Failed to auto-create brand:', error);
      toast({
        title: "Brand Creation Failed",
        description: `Couldn't create ${brandName}. You can select parent manually.`,
        variant: "destructive"
      });
      return null;
    }
  };

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

    setAnalyzing(true);
    
    // Clear old state before analyzing new URL
    setUrlMetadata(null);
    setAiPredictions(null);
    setUploadedMedia([]);
    setPrimaryMediaUrl(null);
    
    try {
      console.log('🔍 Analyzing URL:', analyzeUrl);
      
      // Check cache first
      const cachedMetadata = getCachedMetadata(analyzeUrl);
      
      // Call AI analysis first to get product name AND brand
      const aiResult = await supabase.functions.invoke('analyze-entity-url', { body: { url: analyzeUrl } });
      
      // Extract product name and brand from AI analysis if available
      const aiProductName = aiResult.data?.predictions?.name;
      // AI returns brand in two possible locations depending on analysis type
      const aiBrandName = 
        aiResult.data?.predictions?.brand ?? 
        aiResult.data?.predictions?.additional_data?.brand ?? 
        null;
      
      console.log(`🤖 AI extracted: name="${aiProductName || 'none'}", brand="${aiBrandName || 'none'}"`);
      
      // Then call metadata function with AI-extracted product name AND brand
      const metadataResult = cachedMetadata 
        ? { data: cachedMetadata, error: null }
        : await supabase.functions.invoke('fetch-url-metadata-lite', { 
            body: { 
              url: analyzeUrl,
              productName: aiProductName || null,
              brandName: aiBrandName || null
            } 
          });
      
      // Handle metadata
      if (metadataResult.error) {
        console.error('⚠️ Metadata fetch error:', metadataResult.error);
      } else if (metadataResult.data) {
        console.log('📄 Metadata:', metadataResult.data);
        setUrlMetadata(metadataResult.data);
        if (!cachedMetadata) {
          setCachedMetadata(analyzeUrl, metadataResult.data);
        }
      }
      
      // Handle AI predictions
      if (aiResult.error) {
        console.error('⚠️ AI analysis error:', aiResult.error);
        // Don't throw - show warning but continue with metadata
        toast({
          title: "AI Analysis Unavailable",
          description: "Using basic metadata only. You can still create the entity.",
          variant: "default"
        });
      }
      
      if (aiResult.data) {
        console.log('🤖 AI Analysis:', aiResult.data);
        setAiPredictions(aiResult.data);
        
        // NEW: Auto-select parent brand if extracted by AI (use already-extracted aiBrandName)
        if (aiBrandName && aiBrandName.length >= 2) {
          const foundParent = await autoSelectParentBrand(aiBrandName);
          
          // If no parent found, trigger Phase 2 (auto-creation)
          if (!foundParent) {
            console.log(`🚀 No parent found, will auto-create brand: "${aiBrandName}"`);
            await autoCreateParentBrand(aiBrandName, analyzeUrl);
          }
        }
        
        // Show different toast based on success status
        if (aiResult.data.success === false) {
          toast({
            title: "AI Suggestions Unavailable",
            description: aiResult.data.message || "Using basic metadata. Images are still available.",
            variant: "default"
          });
        }
      }
      
      // Show preview modal if we have metadata OR AI predictions
      if (metadataResult.data || aiResult.data) {
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
      
      // Apply AI predictions
      await applyPredictionsToForm(pred);
    } else {
      // Apply metadata only (no AI predictions available)
      await applyMetadataOnly();
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
        
        // Set primary if no primary exists
        if (!primaryMediaUrl) {
          setPrimaryMediaUrl(newMediaItems[0].url);
        }
        
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
        
        // Set primary if no primary exists
        if (!primaryMediaUrl) {
          setPrimaryMediaUrl(newMediaItems[0].url);
        }
        
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


  const handleSubmit = async () => {
    // Gate submission for user variant
    if (variant === 'user' && !user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create entities',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.name.trim() || !formData.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required',
        variant: 'destructive'
      });
      return;
    }

    // Validate "others" type requires explanation
    if (formData.type === 'others' && !otherTypeReason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please explain why this entity doesn\'t fit existing types',
        variant: 'destructive'
      });
      return;
    }
    
    // Validate type-specific required fields from config
    const typeConfig = entityTypeConfig[formData.type];
    if (typeConfig?.requiredFields) {
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
          default:
            value = formData[storageColumn as keyof typeof formData];
        }
        
        // Check if value is empty (handles strings, arrays, null, undefined)
        const isEmpty = !value || (Array.isArray(value) && value.length === 0) || value === '';
        
        if (isEmpty) {
          toast({
            title: 'Validation Error',
            description: `${fieldConfig.label} is required for ${getEntityTypeLabel(formData.type)}`,
            variant: 'destructive'
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      // Check for duplicate website URL if provided (only among non-deleted entities)
      if (formData.website_url.trim()) {
        const { data: existingEntity, error: checkError } = await supabase
          .from('entities')
          .select('id, name')
          .eq('website_url', formData.website_url.trim())
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

    const metadata = {
      ...formData.metadata,
      business_hours: businessHours,
      contact: contactInfo,
      ...(formData.type === 'others' && otherTypeReason.trim() && {
        other_type_reason: otherTypeReason.trim()
      })
    };

      // Generate slug based on parent context
      const baseSlug = formData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const hierarchicalSlug = selectedParent 
        ? `${selectedParent.slug || selectedParent.id}-${baseSlug}`
        : baseSlug;

      const { data: newEntity, error } = await supabase
        .from('entities')
        .insert([{
          name: formData.name.trim(),
          type: formData.type as any,
          description: formData.description || null,
          image_url: primaryMediaUrl || uploadedMedia[0]?.url || formData.image_url.trim() || null,
          website_url: formData.website_url.trim() || null,
          venue: formData.venue.trim() || null,
          metadata,
          created_by: user?.id || null,
          slug: hierarchicalSlug,
          parent_id: selectedParent?.id || null,
          category_id: formData.category_id || null,
          // Type-specific columns
          authors: formData.authors.length > 0 ? formData.authors : null,
          languages: formData.languages.length > 0 ? formData.languages : null,
          isbn: formData.isbn || null,
          publication_year: formData.publication_year || null,
          cast_crew: Object.keys(formData.cast_crew).length > 0 ? formData.cast_crew : null,
          ingredients: formData.ingredients.length > 0 ? formData.ingredients : null,
          specifications: Object.keys(formData.specifications).length > 0 ? formData.specifications : null,
          price_info: Object.keys(formData.price_info).length > 0 ? formData.price_info : null,
          nutritional_info: Object.keys(formData.nutritional_info).length > 0 ? formData.nutritional_info : null,
          external_ratings: Object.keys(formData.external_ratings).length > 0 ? formData.external_ratings : null,
        }])
        .select()
        .single();

      if (error) throw error;

      // Convert tag names to Tag objects and save
      if (newEntity && selectedTagNames.length > 0) {
        try {
          // Convert all tag names to Tag objects (creates if needed)
          const tagObjects = await Promise.all(
            selectedTagNames.map(name => getOrCreateTag(name))
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
            // Separate external URLs from uploaded files
            const externalMedia = uploadedMedia.filter(item => item.source === 'external');
            const uploadedFiles = uploadedMedia.filter(item => item.source !== 'external');
            
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

      toast({
        title: 'Success',
        description: 'Entity created successfully',
      });

      resetForm();
      onOpenChange(false);
      onEntityCreated();
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
                  disabled={!showAnalyzeButton || analyzing || loading}
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
                Basic Info
              </TabsTrigger>
            )}
            {shouldShowTab('contact') && (
              <TabsTrigger value="contact" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                Contact
              </TabsTrigger>
            )}
            {shouldShowTab('hours') && (
              <TabsTrigger value="hours" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                Business Hours
              </TabsTrigger>
            )}
            {shouldShowTab('details') && formData.type && formData.type !== 'others' && (
              <TabsTrigger value="details" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                {getEntityTypeLabel(formData.type)} Details
              </TabsTrigger>
            )}
            {shouldShowTab('preview') && (
              <TabsTrigger value="preview" className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center">
                Preview
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Entity name"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
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
                  Explain why this entity doesn't fit existing types *
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
                onClick={handleSubmit} 
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
                applyPredictionsToForm(aiPredictions.predictions);
              }
              setShowUrlMismatchDialog(false);
            }}>
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};