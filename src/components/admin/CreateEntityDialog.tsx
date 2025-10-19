import React, { useState, useEffect } from 'react';
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
import { entityTypeConfig } from '@/config/entityTypeConfig';
import { validateUrlForType, getSuggestedEntityType } from '@/config/urlPatterns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const MAX_MEDIA_ITEMS = 4;
import { Plus, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

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

  const handleInputChange = (field: string, value: string | null | Record<string, any>) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle type-specific field updates based on storage column
  const handleTypeSpecificFieldChange = (fieldKey: string, value: any) => {
    const typeConfig = entityTypeConfig[formData.type];
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
  };
  
  // Determine which tabs to show based on entity type
  const getVisibleTabs = () => {
    const typeConfig = entityTypeConfig[formData.type];
    if (!typeConfig) return ['basic'];
    return typeConfig.showTabs;
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
    
    // Clear draft from sessionStorage
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
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
      console.log('Analyzing URL:', analyzeUrl);
      
      const { data, error } = await supabase.functions.invoke('analyze-entity-url', {
        body: { url: analyzeUrl }
      });
      
      if (error) throw error;
      
      console.log('AI Analysis Result:', data);
      
      setAiPredictions(data);
      setShowPreviewModal(true);
      
    } catch (error: any) {
      console.error('URL Analysis Error:', error);
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
  const applyAiPredictions = () => {
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
    
    applyPredictionsToForm(pred);
  };
  
  const applyPredictionsToForm = (pred: any) => {
    let appliedCount = 0;
    
    // Apply type
    if (pred.type) {
      handleInputChange('type', pred.type);
      // Clear category when type changes to avoid orphaned selections
      handleInputChange('category_id', null);
      appliedCount++;
    }
    
    // Apply name
    if (pred.name) {
      handleInputChange('name', pred.name);
      appliedCount++;
    }
    
    // Apply description
    if (pred.description) {
      handleInputChange('description', pred.description);
      appliedCount++;
    }
    
    // Apply category
    if (pred.category_id) {
      handleInputChange('category_id', pred.category_id);
      appliedCount++;
    }
    
    // Apply tags
    if (pred.tags && Array.isArray(pred.tags) && pred.tags.length > 0) {
      const newTags = pred.tags.map((tagName: string) => ({
        id: crypto.randomUUID(),
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      setSelectedTags(prev => {
        const existingNames = prev.map(t => t.name.toLowerCase());
        const filtered = newTags.filter(t => !existingNames.includes(t.name.toLowerCase()));
        return [...prev, ...filtered];
      });
      
      if (newTags.length > 0) appliedCount++;
    }
    
    // Apply primary image
    if (pred.images && pred.images.length > 0) {
      handleInputChange('image_url', pred.images[0]);
      appliedCount++;
    }
    
    // Apply website URL from analyzed URL
    if (aiPredictions.metadata?.analyzed_url) {
      handleInputChange('website_url', aiPredictions.metadata.analyzed_url);
    }
    
    // Apply additional metadata
    if (pred.additional_data && Object.keys(pred.additional_data).length > 0) {
      handleInputChange('metadata', {
        ...formData.metadata,
        ai_extracted_data: pred.additional_data
      });
    }
    
    // Close modal
    setShowPreviewModal(false);
    
    // Clear analyze URL input
    setAnalyzeUrl('');
    setShowAnalyzeButton(false);
    
    // Show success toast
    toast({
      title: "Form Updated",
      description: `Successfully applied ${appliedCount} fields from URL analysis`,
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

    setLoading(true);
    try {
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
          category_id: formData.category_id || null
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
            const uploadedPhotos = await uploadEntityMediaBatch(
              uploadedMedia,
              newEntity.id,
              user.id,
              (progress, total) => {
                console.log(`Uploading media: ${progress}/${total}`);
              }
            );

            // Set first media item as primary image
            if (uploadedPhotos.length > 0 && uploadedMedia[0]) {
              await supabase
                .from('entities')
                .update({ image_url: uploadedMedia[0].url })
                .eq('id', newEntity.id);
            }
          } catch (mediaError) {
            console.error('Error uploading media:', mediaError);
            toast({
              title: 'Warning',
              description: 'Entity created, but some media failed to upload.',
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
    } catch (error) {
      console.error('Error creating entity:', error);
      toast({
        title: 'Error',
        description: `Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          <TabsList className={`grid w-full ${getVisibleTabs().length === 4 ? 'grid-cols-4' : getVisibleTabs().length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {shouldShowTab('basic') && <TabsTrigger value="basic">Basic Info</TabsTrigger>}
            {shouldShowTab('contact') && <TabsTrigger value="contact">Contact</TabsTrigger>}
            {shouldShowTab('businessHours') && <TabsTrigger value="hours">Business Hours</TabsTrigger>}
            {shouldShowTab('details') && formData.type && formData.type !== 'others' && (
              <TabsTrigger value="details">{getEntityTypeLabel(formData.type)} Details</TabsTrigger>
            )}
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
                    setAnalyzeUrl(e.target.value);
                    setShowAnalyzeButton(isValidUrl(e.target.value));
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
                disabled={loading}
                mode="drill-down"
              />
            )}

            {/* Tag Input */}
            <TagInput
              value={selectedTags}
              onChange={setSelectedTags}
              disabled={loading}
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

            {/* Type-Specific Metadata Fields */}
            {formData.type === EntityType.Product && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-sm">Product Metadata</h4>
                
                <div className="space-y-2">
                  <Label>Brand Origin</Label>
                  <Input
                    placeholder="e.g., Korea, USA, France"
                    value={formData.metadata?.brand_origin || ''}
                    onChange={(e) => handleInputChange('metadata', {
                      ...formData.metadata,
                      brand_origin: e.target.value
                    })}
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Price Tier</Label>
                  <Select
                    value={formData.metadata?.price_tier || ''}
                    onValueChange={(value) => handleInputChange('metadata', {
                      ...formData.metadata,
                      price_tier: value
                    })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select price tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget (&lt;$20)</SelectItem>
                      <SelectItem value="mid-range">Mid-Range ($20-$50)</SelectItem>
                      <SelectItem value="luxury">Luxury ($50+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Product Characteristics</Label>
                  <div className="flex flex-wrap gap-3">
                    {['cruelty-free', 'vegan', 'organic', 'hypoallergenic'].map(trait => (
                      <label key={trait} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.metadata?.characteristics?.includes(trait) || false}
                          onChange={(e) => {
                            const current = formData.metadata?.characteristics || [];
                            const updated = e.target.checked
                              ? [...current, trait]
                              : current.filter((t: string) => t !== trait);
                            handleInputChange('metadata', {
                              ...formData.metadata,
                              characteristics: updated
                            });
                          }}
                          disabled={loading}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{trait.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.type === EntityType.Food && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-sm">Food Metadata</h4>
                
                <div className="space-y-2">
                  <Label>Cuisines</Label>
                  <Input
                    placeholder="e.g., Italian, Korean, Mexican (comma-separated)"
                    value={formData.metadata?.cuisines?.join(', ') || ''}
                    onChange={(e) => handleInputChange('metadata', {
                      ...formData.metadata,
                      cuisines: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    })}
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Dietary Tags</Label>
                  <div className="flex flex-wrap gap-3">
                    {['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher'].map(diet => (
                      <label key={diet} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.metadata?.dietary_tags?.includes(diet) || false}
                          onChange={(e) => {
                            const current = formData.metadata?.dietary_tags || [];
                            const updated = e.target.checked
                              ? [...current, diet]
                              : current.filter((t: string) => t !== diet);
                            handleInputChange('metadata', {
                              ...formData.metadata,
                              dietary_tags: updated
                            });
                          }}
                          disabled={loading}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{diet.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.type === EntityType.Place && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-sm">Place Metadata</h4>
                
                <div className="space-y-2">
                  <Label>Location Type</Label>
                  <Select
                    value={formData.metadata?.location_type || ''}
                    onValueChange={(value) => handleInputChange('metadata', {
                      ...formData.metadata,
                      location_type: value
                    })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Accessibility Features</Label>
                  <div className="flex flex-wrap gap-3">
                    {['wheelchair-accessible', 'parking-available', 'pet-friendly'].map(feature => (
                      <label key={feature} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.metadata?.accessibility?.includes(feature) || false}
                          onChange={(e) => {
                            const current = formData.metadata?.accessibility || [];
                            const updated = e.target.checked
                              ? [...current, feature]
                              : current.filter((f: string) => f !== feature);
                            handleInputChange('metadata', {
                              ...formData.metadata,
                              accessibility: updated
                            });
                          }}
                          disabled={loading}
                          className="rounded"
                        />
                        <span className="text-sm">{feature.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(formData.type === EntityType.TVShow || formData.type === EntityType.Movie) && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-sm">Media Metadata</h4>
                
                <div className="space-y-2">
                  <Label>Genres</Label>
                  <Input
                    placeholder="e.g., Action, Drama, Comedy (comma-separated)"
                    value={formData.metadata?.genres?.join(', ') || ''}
                    onChange={(e) => handleInputChange('metadata', {
                      ...formData.metadata,
                      genres: e.target.value.split(',').map(g => g.trim()).filter(Boolean)
                    })}
                    disabled={loading}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Release Year</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2024"
                      value={formData.metadata?.release_year || ''}
                      onChange={(e) => handleInputChange('metadata', {
                        ...formData.metadata,
                        release_year: parseInt(e.target.value) || null
                      })}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Content Rating</Label>
                    <Select
                      value={formData.metadata?.content_rating || ''}
                      onValueChange={(value) => handleInputChange('metadata', {
                        ...formData.metadata,
                        content_rating: value
                      })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="G">G</SelectItem>
                        <SelectItem value="PG">PG</SelectItem>
                        <SelectItem value="PG-13">PG-13</SelectItem>
                        <SelectItem value="R">R</SelectItem>
                        <SelectItem value="TV-MA">TV-MA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                    />
                  );
                });
              })()}
            </TabsContent>
          )}
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