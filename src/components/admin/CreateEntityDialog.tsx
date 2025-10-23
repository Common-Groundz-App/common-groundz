import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, Sparkles, Loader2, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { getOrCreateTag } from '@/services/tagService';

import { EntityType } from '@/services/recommendation/types';
import { getEntityTypeLabel, getActiveEntityTypes } from '@/services/entityTypeHelpers';
import { Database } from '@/integrations/supabase/types';
import { CategorySelector } from './CategorySelector';
import { TagInput } from './TagInput';
import { AutoFillPreviewModal } from './AutoFillPreviewModal';

type Tag = Database['public']['Tables']['tags']['Row'];

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated: () => void;
}

export const CreateEntityDialog: React.FC<CreateEntityDialogProps> = ({
  open,
  onOpenChange,
  onEntityCreated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  
  const DRAFT_KEY = 'create-entity-draft';
  
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
  
  // Tag input state
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  
  // URL analysis state
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false);
  const [aiPredictions, setAiPredictions] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showUrlMismatchDialog, setShowUrlMismatchDialog] = useState(false);
  const [urlMismatchMessage, setUrlMismatchMessage] = useState('');
  const [urlMetadata, setUrlMetadata] = useState<any>(null);
  
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

  // URL metadata persistence constants
  const METADATA_STORAGE_KEY = 'entity_url_metadata_preview';
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
          setSelectedTags(draft.selectedTags || []);
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
      }
    };

    if (open) {
      loadDraft();
    }
  }, [open]);

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
          selectedTags
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
    // Always add preview tab at the end
    return [...baseTabs, 'preview'];
  };
  
  const shouldShowTab = (tabName: string) => {
    return getVisibleTabs().includes(tabName as any);
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
    setOtherTypeReason('');
    setPrimaryMediaUrl(null);
    setSelectedTags([]);
    setAnalyzeUrl('');
    setShowAnalyzeButton(false);
    setAiPredictions(null);
    setShowPreviewModal(false);
    setUrlMetadata(null);
    setFieldErrors({});
    setAiFilledFields(new Set());
    
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
    
    try {
      console.log('🔍 Analyzing URL:', analyzeUrl);
      
      // Check cache first
      const cachedMetadata = getCachedMetadata(analyzeUrl);
      
      // Call both functions in parallel (skip metadata if cached)
      const [metadataResult, aiResult] = await Promise.all([
        cachedMetadata 
          ? Promise.resolve({ data: cachedMetadata, error: null })
          : supabase.functions.invoke('fetch-url-metadata', { body: { url: analyzeUrl } }),
        supabase.functions.invoke('analyze-entity-url', { body: { url: analyzeUrl } })
      ]);
      
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
        throw aiResult.error;
      }
      
      console.log('🤖 AI Analysis:', aiResult.data);
      
      setAiPredictions(aiResult.data);
      setShowPreviewModal(true);
      
    } catch (error: any) {
      console.error('❌ URL Analysis Error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze URL. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply AI predictions to form
  const applyAiPredictions = async () => {
    if (!aiPredictions?.predictions) {
      toast({
        title: "No Predictions",
        description: "No predictions available to apply",
        variant: "destructive"
      });
      return;
    }
    
    const pred = aiPredictions.predictions;
    
    // Validate URL matches entity type if type is predicted
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
    
    await applyPredictionsToForm(pred);
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
          // Fetch or create all tags in parallel
          const tagPromises = pred.tags.map((tagName: string) => 
            getOrCreateTag(tagName)
          );
          
          const realTags = await Promise.all(tagPromises);
          
          setSelectedTags(realTags); // Set with real database IDs
          filledFields.add('tags');
          appliedCount++;
          
          console.log('✅ Tags ready with real IDs:', realTags.map(t => t.id));
        } catch (tagError) {
          console.error('❌ Failed to create/fetch tags:', tagError);
          toast({
            title: "Tag Creation Failed",
            description: "Some tags couldn't be created. You can add them manually.",
            variant: "default"
          });
          // Continue without tags rather than failing entirely
        }
      } else {
        setSelectedTags([]); // Clear when empty array
      }
    }
    
    // Apply image - prefer metadata og:image over AI prediction
    if (urlMetadata?.image) {
      handleInputChange('image_url', urlMetadata.image);
      addImageToMediaGallery(urlMetadata.image, 'metadata');
      filledFields.add('image_url');
      appliedCount++;
      console.log('🖼️ Applied metadata image:', urlMetadata.image);
    } else if (pred.images && pred.images.length > 0) {
      // CRITICAL: pred.images contains objects with .url field, not strings
      const imageUrl = pred.images[0].url;
      handleInputChange('image_url', imageUrl);
      addImageToMediaGallery(imageUrl, 'ai');
      filledFields.add('image_url');
      appliedCount++;
      console.log('🖼️ Applied AI image:', imageUrl);
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
    
    // Show success toast
    const mediaAdded = urlMetadata?.image || (pred.images && pred.images.length > 0);
    toast({
      title: "Form Updated",
      description: `Applied ${appliedCount} fields${mediaAdded ? ' (including image to gallery)' : ''} from URL analysis`,
    });
    
    console.log('✅ Applied predictions:', pred);
  };


  const handleSubmit = async () => {
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

      // Save tags
      if (newEntity && selectedTags.length > 0) {
        const tagAssignments = selectedTags.map(tag => ({
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
            Create New Entity
            {draftRestored && <span className="text-sm text-muted-foreground ml-2">(Draft restored)</span>}
          </DialogTitle>
          <DialogDescription>
            Add a new entity with business hours and contact information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className={`grid w-full grid-cols-${Math.min(getVisibleTabs().length, 5)}`}>
            {shouldShowTab('basic') && <TabsTrigger value="basic">Basic Info</TabsTrigger>}
            {shouldShowTab('contact') && <TabsTrigger value="contact">Contact</TabsTrigger>}
            {shouldShowTab('businessHours') && <TabsTrigger value="hours">Business Hours</TabsTrigger>}
            {shouldShowTab('details') && formData.type && formData.type !== 'others' && (
              <TabsTrigger value="details">{getEntityTypeLabel(formData.type)} Details</TabsTrigger>
            )}
            {shouldShowTab('preview') && <TabsTrigger value="preview">Preview</TabsTrigger>}
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            {/* Analyze URL Input - Placed first for quick access */}
            <div className="space-y-2 p-4 border-2 border-dashed border-primary/20 rounded-lg bg-primary/5">
              <div className="flex items-center gap-2">
                <Label htmlFor="analyze_url" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Auto-Fill from URL (Optional)</span>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste any URL (Goodreads, IMDb, Amazon, App Store, etc.) to automatically extract entity details
              </p>
              <div className="flex gap-2">
                <Input
                  id="analyze_url"
                  value={analyzeUrl}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setAnalyzeUrl(newUrl);
                    setShowAnalyzeButton(isValidUrl(newUrl));
                    
                    // Clear preview only if URL is different from current metadata URL
                    if (urlMetadata && newUrl !== urlMetadata.url) {
                      setUrlMetadata(null);
                    }
                  }}
                  placeholder="https://www.goodreads.com/book/show/5907..."
                  disabled={loading || analyzing}
                  className="flex-1"
                />
                {showAnalyzeButton && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleAnalyzeUrl}
                    disabled={loading || analyzing}
                    className="shrink-0"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* URL Preview Card */}
              {urlMetadata && (
                <a 
                  href={urlMetadata.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block mt-3 border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors group relative"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUrlMetadata(null);
                      setAnalyzeUrl('');
                      setShowAnalyzeButton(false);
                      clearUrlMetadataFromStorage();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="flex items-start gap-3">
                    {urlMetadata.favicon && (
                      <img 
                        src={urlMetadata.favicon} 
                        alt="Site icon"
                        className="w-6 h-6 rounded flex-shrink-0"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">{urlMetadata.siteName}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-sm mb-1 line-clamp-1">{urlMetadata.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{urlMetadata.description}</p>
                    </div>
                    {urlMetadata.image && (
                      <img 
                        src={urlMetadata.image} 
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded flex-shrink-0"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                  </div>
                </a>
              )}
            </div>
            
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
              />
            )}

            {/* Tag Input */}
            <TagInput
              value={selectedTags}
              onChange={setSelectedTags}
              disabled={loading}
              onClearAll={() => setSelectedTags([])}
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
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
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
                  ...(selectedTags.length > 0 && { tags: selectedTags.map(t => t.name) }),
                  
                  // Media
                  ...(uploadedMedia.length > 0 && { uploaded_media_count: uploadedMedia.length }),
                }, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => {
            resetForm();
            onOpenChange(false);
          }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Entity'}
          </Button>
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