import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { createReview, updateReview, Review } from '@/services/reviewService';
import { EntityType, Entity as RecommendationEntity } from '@/services/recommendation/types'; 
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import { ensureHttps } from '@/utils/urlUtils';
import { MediaItem } from '@/types/media';
import { DeleteConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { mapStringToEntityType } from '@/hooks/feed/api/types';
import { parseEntityType, type CanonicalEntityType } from '@/services/entityType';
import { EntityAdapter } from '@/components/profile/circles/types';
import {
  deriveSubjectPrefill,
  mapCanonicalToLegacyCategory,
  resolveQuestionnaireKind,
  type LegacyReviewCategory,
} from './subjectSelection';
import {
  subjectRequirement,
  allowsMissingSubject,
  type SubjectRequirement,
} from './reviewSubjectPolicy';
import { getParentEntity } from '@/services/entityHierarchyService';
import { useSearchFunnel } from '@/hooks/useSearchFunnel';

// Import step components
import StepOne from './steps/StepOne';
import SubjectSelectStep from './steps/SubjectSelectStep';
import StepThree from './steps/StepThree';
import StepFour from './steps/StepFour';
import StepIndicator from './StepIndicator';
import StepNavigation from './StepNavigation';


// Define the entity interface for pre-populating entity data - now includes type property
interface EntityData {
  id: string;
  name: string;
  type: string; // Added missing type property
  venue?: string;
  image_url?: string;
  description?: string;
  metadata?: {
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    types?: string[];
    business_status?: string;
  };
}

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  review?: Review;
  isEditMode?: boolean;
  entity?: EntityData; // New prop to pre-populate entity data
}

const ReviewForm = ({
  isOpen,
  onClose,
  onSubmit,
  review,
  isEditMode = false,
  entity // New prop
}: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();
  const { handleImageUpload } = useRecommendationUploads();
  // Fire-and-forget funnel telemetry. Never blocks or toasts.
  const { log: logFunnel } = useSearchFunnel();
  
  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form validation error state
  const [showRatingError, setShowRatingError] = useState(false);
  
  // Exit confirmation state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  /**
   * Phase 2.1 — two separate ideas that used to share one `category` field:
   *
   *  - `category`          → questionnaire kind. One of the five legacy buckets.
   *                          Drives Steps 3/4 UI ONLY. Unchanged behaviour.
   *  - `canonicalCategory` → the real canonical entity type of the subject.
   *                          This is what gets PERSISTED to `reviews.category`
   *                          when the user deliberately chose the subject.
   *
   * `subjectOrigin` decides which one is written on save, so merely opening and
   * re-saving an old review can never silently rewrite its stored category.
   */
  type SubjectOrigin = 'none' | 'loaded' | 'entity-page' | 'user-selected';

  const initialCanonical = entity ? parseEntityType(entity.type) : null;

  const [canonicalCategory, setCanonicalCategory] = useState<CanonicalEntityType | null>(
    !isEditMode ? initialCanonical : null,
  );
  const [subjectOrigin, setSubjectOrigin] = useState<SubjectOrigin>(() => {
    if (isEditMode && review) return 'loaded';
    if (entity) return 'entity-page';
    return 'none';
  });

  // Form data
  const [rating, setRating] = useState(review?.rating || 0);
  // Questionnaire kind (five legacy buckets) — never persisted directly unless
  // the review has no deliberately chosen subject.
  const [category, setCategory] = useState<LegacyReviewCategory>(
    resolveQuestionnaireKind(review?.category) ??
    (initialCanonical ? mapCanonicalToLegacyCategory(initialCanonical) : 'food')
  );

  
  // Separate state variables for different fields
  const [foodName, setFoodName] = useState(''); // For "What did you eat?" in food category
  const [contentName, setContentName] = useState(entity?.name || ''); // For movie/book/place/product name
  const [reviewTitle, setReviewTitle] = useState(review?.subtitle || ''); // For review title/subtitle in Step 4
  
  // Initialize venue properly based on entity type and metadata
  const [venue, setVenue] = useState(() => {
    // For place category with Google Places metadata, use formatted_address
    if (entity?.type?.toLowerCase() === 'place' && entity?.metadata?.formatted_address) {
      return entity.metadata.formatted_address;
    }
    // Otherwise use standard venue or empty string
    return review?.venue || entity?.venue || '';
  });
  
  const [entityId, setEntityId] = useState(review?.entity_id || entity?.id || '');
  const [description, setDescription] = useState(review?.description || '');
  
  // Updated media handling
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Flag to determine if the form was opened from an entity page
  const isFromEntityPage = !!entity && !isEditMode;

  // Step 2 subject (Phase 2.0). Pre-filled when opened from an entity page.
  const [selectedSubject, setSelectedSubject] = useState<EntityAdapter | null>(
    entity ? { id: entity.id, name: entity.name, type: entity.type, venue: entity.venue, image_url: entity.image_url, description: entity.description, metadata: entity.metadata } : null
  );
  const [subjectContextLine, setSubjectContextLine] = useState<string | null>(null);
  const [isResolvingSubjectContext, setIsResolvingSubjectContext] = useState(false);
  // Guards against a slow parent lookup overwriting a newer subject.
  const subjectRequestRef = React.useRef(0);

  
  const [experienceDate, setExperienceDate] = useState<Date | undefined>(
    review?.experience_date ? new Date(review.experience_date) : undefined
  );
  const [visibility, setVisibility] = useState<"public" | "circle_only" | "private">(
    (review?.visibility as "public" | "circle_only" | "private") || "public"
  );
  const [foodTags, setFoodTags] = useState<string[]>(review?.metadata?.food_tags || []);
  
  // Update the type of selectedEntity to be compatible with both Entity types
  const [selectedEntity, setSelectedEntity] = useState<RecommendationEntity | null>(null);
  
  // Initialize media from legacy image_url or new media array - but only in edit mode or when we have review data
  useEffect(() => {
    if (isEditMode && review) {
      // Initialize from existing media if available
      if (review.media && Array.isArray(review.media) && review.media.length > 0) {
        setSelectedMedia(review.media as MediaItem[]);
      } 
      // Fallback to legacy image_url
      else if (review.image_url) {
        setSelectedMedia([{
          url: ensureHttps(review.image_url),
          type: 'image',
          order: 0,
          id: review.id
        }]);
      }
    }
    // Do not automatically set entity image in selectedMedia when opening from entity page
    // This prevents duplicate images and unnecessary storage use
  }, [review, isEditMode]);
  
  // If in edit mode, populate entity once review is available, or use provided entity
  useEffect(() => {
    if (isEditMode && review?.entity) {
      // Process the entity to ensure image_url is properly formatted
      const processedEntity = { ...review.entity };
      if (processedEntity.image_url) {
        processedEntity.image_url = ensureHttps(processedEntity.image_url);
      }
      
      // Convert the string type to EntityType enum if possible
      if (typeof processedEntity.type === 'string') {
        // Map from string to EntityType enum using imported helper
        const mappedType = mapStringToEntityType(processedEntity.type as any);
        processedEntity.type = mappedType;
      }
      
      setSelectedEntity(processedEntity as RecommendationEntity);
    } else if (entity && !selectedEntity) {
      // Convert provided entity to expected format
      const entityToUse: any = {
        ...entity,
        type: mapStringToEntityType(entity.type as any) ?? entity.type
      };
      
      setSelectedEntity(entityToUse);
    }
  }, [review, isEditMode, entity, selectedEntity]);

  
  // Ensure proper initialization when entity is provided
  useEffect(() => {
    if (entity && isOpen && !isEditMode) {
      // Set initial values from the entity. Strict parsing only: an unparseable
      // type never becomes `product`/`others`.
      const canonical = parseEntityType(entity.type);
      setCanonicalCategory(canonical);
      setSubjectOrigin('entity-page');
      if (canonical) setCategory(mapCanonicalToLegacyCategory(canonical));

      
      // IMPORTANT: Handle the foodName vs contentName differently based on category
      if (entity.type.toLowerCase() === 'food') {
        // For food entity, leave the foodName empty since it's what the user ate
        // and set the venue to the restaurant name
        setFoodName(''); // Don't set food name - user needs to specify what they ate
        setVenue(entity.name || ''); // Use entity name as the restaurant name
      } else if (entity.type.toLowerCase() === 'place') {
        // For place entity, set the contentName to the place name
        setContentName(entity.name || '');
        
        // For venue/location field, prefer formatted_address from metadata if entity originated from Google Places
        if (entity.metadata?.formatted_address) {
          setVenue(entity.metadata.formatted_address || '');
        } else {
          setVenue(entity.venue || '');
        }
      } else {
        // For other categories, use name as contentName
        setContentName(entity.name || '');
        setVenue(entity.venue || '');
      }
      
      setEntityId(entity.id);

      // Only auto-complete step 2 since we have an entity
      // Step 1 (rating) is still required
      if (!completedSteps.includes(2)) {
        setCompletedSteps(prev => [...prev, 2]);
      }
    }
  }, [entity, isOpen, isEditMode, completedSteps]);
  
  // Track form changes
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    
    // Check if form has non-default values
    const hasChanges = 
      (rating > 0) || 
      (reviewTitle !== '') || 
      (foodName !== '') || 
      (contentName !== '') || 
      (venue !== '') || 
      (description !== '') || 
      (selectedMedia.length > 0) || 
      (foodTags.length > 0) ||
      (entityId !== '');
      
    setHasUnsavedChanges(hasChanges);
  }, [isOpen, rating, reviewTitle, foodName, contentName, venue, description, selectedMedia, foodTags, entityId]);
  
  // Reset form on close or when switching to a different review in edit mode
  useEffect(() => {
    if (!isOpen) {
      if (!isEditMode) {
        resetForm();
      }
    } else if (isEditMode && review) {
      // Update with new data structure - cleanly separate title and subtitle
      setRating(review.rating);
      // The stored value may be a legacy bucket OR (post-2.1) a canonical type.
      // Either way it only resolves the questionnaire kind here; the stored
      // value itself is preserved on save unless the subject is changed.
      const loadedKind = resolveQuestionnaireKind(review.category) ?? 'product';
      setCategory(loadedKind);
      setCanonicalCategory(null);
      setSubjectOrigin('loaded');
      
      // For food category, use the main title field for the food name
      if (loadedKind === 'food') {

        setFoodName(review.title || '');
        setContentName(''); // Clear the other category field
      } else {
        // For other categories, use the main title for the content name
        setContentName(review.title || '');
        setFoodName(''); // Clear the food category field
      }
      
      // Always use subtitle field for the review title/headline
      setReviewTitle(review.subtitle || '');
      
      setVenue(review.venue || '');
      setEntityId(review.entity_id || '');
      setDescription(review.description || '');
      setVisibility((review.visibility as "public" | "circle_only" | "private") || "public");
      
      if (review.experience_date) {
        setExperienceDate(new Date(review.experience_date));
      }
      if (review.metadata?.food_tags) {
        setFoodTags(review.metadata.food_tags);
      }
      
      // Set all steps to completed in edit mode
      setCompletedSteps([1, 2, 3, 4]);
      
      // Start at step 1 in edit mode
      setCurrentStep(1);
    }
  }, [isOpen, review, isEditMode]);
  
  const resetForm = () => {
    setRating(0);
    setCategory('food');
    setCanonicalCategory(null);
    setSubjectOrigin('none');

    setReviewTitle('');
    setFoodName('');
    setContentName('');
    setVenue('');
    setEntityId('');
    setDescription('');
    setSelectedMedia([]);
    setExperienceDate(undefined);
    setVisibility('public');
    setFoodTags([]);
    setSelectedEntity(null);
    setCurrentStep(1);
    setCompletedSteps([]);
    setHasUnsavedChanges(false);
  };
  
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmation(true);
    } else {
      onClose();
    }
  };
  
  const handleConfirmExit = () => {
    setShowExitConfirmation(false);
    resetForm();
    onClose();
  };
  
  const handleCancelExit = () => {
    setShowExitConfirmation(false);
  };
  
  // Handle adding a new media item
  const handleAddMedia = (media: MediaItem) => {
    setSelectedMedia(prev => [...prev, media]);
  };
  
  // Handle removing a media item
  const handleRemoveMedia = (mediaUrl: string) => {
    setSelectedMedia(prev => prev.filter(item => item.url !== mediaUrl));
  };
  
  const handleImageUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const url = await handleImageUpload(file);
      console.log("Image uploaded, received URL:", url);
      
      if (url) {
        const secureUrl = ensureHttps(url);
        console.log("Setting image URL to:", secureUrl);
        
        // Add as a media item instead of setting single image URL
        handleAddMedia({
          url: secureUrl,
          type: 'image',
          order: selectedMedia.length,
          id: `new-${Date.now()}`
        });
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  /**
   * Step 2 subject selection (Phase 2.0).
   *
   * The subject is authoritative: it derives the legacy `category` and every
   * Step 3 field. Unlike `handleEntitySelect` below, it never reads the stale
   * `category` state — the category is computed FROM the subject.
   */
  const handleSubjectChange = (subject: EntityAdapter | null) => {
    subjectRequestRef.current += 1;
    const requestId = subjectRequestRef.current;

    if (!subject) {
      setSelectedSubject(null);
      setSelectedEntity(null);
      setEntityId('');
      setSubjectContextLine(null);
      setIsResolvingSubjectContext(false);
      setCanonicalCategory(null);
      setSubjectOrigin(isEditMode ? 'loaded' : 'none');
      return;
    }

    const prefill = deriveSubjectPrefill(subject);
    if (!prefill.canonicalType || !prefill.category) {
      // Unknown/unparseable type — never coerced to `others` or `product`.
      toast({
        title: "We can't use this one yet",
        description: 'Pick something else to review for now.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedSubject(subject);
    setCategory(prefill.category);
    // The canonical type is what will be persisted, because the user picked it.
    setCanonicalCategory(prefill.canonicalType);
    setSubjectOrigin('user-selected');
    setEntityId(subject.id);
    setSelectedEntity({
      ...(subject as any),
      type: prefill.canonicalType as unknown as EntityType,
    } as RecommendationEntity);

    logFunnel({
      event: isEditMode ? 'review_subject_attached_late' : 'review_subject_selected',
      source: 'review_form',
      entityType: prefill.canonicalType,
    });


    // Step 3 fields come from the subject, not from the previous category.
    setFoodName(prefill.foodName);
    setContentName(prefill.contentName);
    if (prefill.venue) setVenue(prefill.venue);

    setSubjectContextLine(null);

    // Offerings (dishes etc.) get their venue from the parent place. Resolved
    // asynchronously; stale responses are discarded.
    if (prefill.category === 'food') {
      setIsResolvingSubjectContext(true);
      getParentEntity(subject.id)
        .then((parent) => {
          if (requestId !== subjectRequestRef.current) return;
          if (parent?.name) {
            setVenue(parent.name);
            setSubjectContextLine(`Dish at ${parent.name}`);
          }
        })
        .catch((err) => console.error('Subject parent lookup failed:', err))
        .finally(() => {
          if (requestId === subjectRequestRef.current) {
            setIsResolvingSubjectContext(false);
          }
        });
    }
  };

  // Handle entity selection, ensuring type compatibility
  const handleEntitySelect = (entity: any) => {
    console.log("Entity selected in ReviewForm:", entity);
    
    // Process the entity to ensure type compatibility
    const processedEntity = { ...entity };
    
    // Convert string type to EntityType if needed
    if (typeof processedEntity.type === 'string') {
      // Keep the original value when it is not a canonical type: never coerce to `product`.
      processedEntity.type = mapStringToEntityType(processedEntity.type) ?? processedEntity.type;
    }
    
    setSelectedEntity(processedEntity as RecommendationEntity);
    setEntityId(entity.id);
    
    // For food category, handle differently
    if (category === 'food') {
      console.log("Food category in ReviewForm");
      
      // For Google Places, always use the name as restaurant name, never address
      if (entity.api_source === 'google_places') {
        console.log("Using Google Places source: setting venue to name only:", entity.name);
        setVenue(entity.name);
      } else {
        // For other sources, use venue or fallback to name
        setVenue(entity.venue || entity.name || '');
      }
    } else if (category === 'place') {
      // For place category, use name as contentName but formatted address as venue
      setContentName(entity.name);
      
      if (entity.api_source === 'google_places' && entity.metadata?.formatted_address) {
        console.log("Using Google Places formatted_address for venue:", entity.metadata.formatted_address);
        setVenue(entity.metadata.formatted_address);
      } else {
        // For non-Google Place sources or if no formatted address
        setVenue(entity.venue || '');
      }
    } else {
      // For other categories, set contentName from entity
      if (entity.name) setContentName(entity.name);
      if (entity.venue) setVenue(entity.venue);
    }
  };

  
  // Handle step navigation by clicking on step indicators
  const handleStepClick = (step: number) => {
    // First check if user has selected a rating when trying to navigate away from step 1
    if (currentStep === 1 && step !== 1 && rating === 0) {
      setShowRatingError(true);
      // Add a small shake animation to indicate error
      setTimeout(() => setShowRatingError(false), 1500);
      return;
    }
    
    // Only allow navigation to completed steps or current step
    if (completedSteps.includes(step) || step === currentStep) {
      setCurrentStep(step);
    } else {
      // Show toast explaining why navigation is restricted
      toast({
        title: "Cannot skip steps",
        description: "Please complete the current step before proceeding.",
        variant: "destructive"
      });
    }
  };
  
  const handleNext = () => {
    // Validate current step
    if (currentStep === 1 && rating === 0) {
      setShowRatingError(true);
      // Add a small shake animation to indicate error
      setTimeout(() => setShowRatingError(false), 1500);
      toast({
        title: 'Rating required',
        description: 'Please select a rating before proceeding.',
        variant: 'destructive'
      });
      return;
    }
    
    if (currentStep === 3) {
      // Validate based on category
      if (category === 'food' && !foodName) {
        toast({
          title: 'Food name required',
          description: 'Please specify what you ate.',
          variant: 'destructive'
        });
        return;
      } else if (category !== 'food' && !contentName) {
        toast({
          title: `${category} name required`,
          description: `Please provide a name for the ${category} you're reviewing.`,
          variant: 'destructive'
        });
        return;
      }
    }
    
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    
    // If last step, submit the form
    if (currentStep === 4) {
      handleFormSubmit();
      return;
    }
    
    // Move to next step
    setCurrentStep(prev => prev + 1);
  };
  
  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };
  
  const handleFormSubmit = async () => {
    if (!requireAuth({ action: 'review', surface: 'review_form', entityId, entityName: contentName || foodName })) return;
    
    setIsSubmitting(true);
    
    try {
      // Prepare metadata based on category
      const metadata = category === 'food' ? { food_tags: foodTags } : undefined;
      
      // Convert Date to ISO string for API submission
      const formattedExperienceDate = experienceDate ? experienceDate.toISOString() : undefined;
      
      // For backward compatibility, use the first image as the main image_url,
      // but if no user-uploaded images and we're from entity page, use entity image as fallback
      let image_url: string | undefined = undefined;
      
      if (selectedMedia.length > 0) {
        // Use the first uploaded image as the main image
        image_url = selectedMedia[0].url;
      } else if (isFromEntityPage && entity?.image_url) {
        // If no user-uploaded images and we're from entity page, use entity image as fallback
        image_url = entity.image_url;
        
        // Also add it to the media array so it shows in the review
        const entityMedia: MediaItem = {
          url: ensureHttps(entity.image_url),
          type: 'image',
          order: 0,
          id: `entity-${entity.id}`
        };
        setSelectedMedia([entityMedia]);
      }
      
      // Determine final title based on the content type
      // For food category: always use foodName as the main title
      // For other categories: use contentName as the main title
      const finalTitle = category === 'food' ? foodName : contentName;

      /**
       * Phase 2.1 — what actually gets written to `reviews.category`:
       *  - the canonical entity type, when the user deliberately chose the
       *    subject (search pick, or opening the form from an entity page);
       *  - otherwise the previously stored raw value, untouched, so opening and
       *    re-saving an old review never rewrites its category;
       *  - otherwise the questionnaire bucket (subject-less new review).
       */
      const canonicalWins =
        subjectOrigin === 'user-selected' || (subjectOrigin === 'entity-page' && !isEditMode);
      const persistedCategory =
        canonicalWins && canonicalCategory
          ? canonicalCategory
          : (isEditMode && review?.category ? review.category : category);

      
      if (isEditMode && review) {
        await updateReview(review.id, {
          title: finalTitle, // Use the content name as the title
          subtitle: reviewTitle, // Store the review headline in the subtitle field
          venue,
          description,
          rating,
          image_url,
          media: selectedMedia,
          category: persistedCategory,
          visibility: visibility as "public" | "private" | "circle_only", // Match what the API expects
          entity_id: entityId,
          experience_date: formattedExperienceDate,
          metadata,
        });
        toast({
          title: 'Success',
          description: 'Review has been updated successfully'
        });
      } else {
        await createReview({
          title: finalTitle, // Use the content name as the title
          subtitle: reviewTitle, // Store the review headline in the subtitle field
          venue,
          description,
          rating,
          image_url,
          media: selectedMedia,
          category: persistedCategory,
          visibility: visibility as "public" | "private" | "circle_only", // Match what the API expects
          entity_id: entityId,
          experience_date: formattedExperienceDate,
          metadata,
          user_id: user.id
        });
        toast({
          title: 'Success',
          description: 'Review has been added successfully'
        });
        resetForm();
      }
      logFunnel({
        event: 'review_submitted',
        source: 'review_form',
        entityType: canonicalWins && canonicalCategory ? canonicalCategory : undefined,
      });
      await onSubmit();
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      console.error('Error saving review:', error);
      toast({
        title: 'Error',
        description: 'Failed to save review. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Fires once per time the subject step becomes visible.
  useEffect(() => {
    if (isOpen && currentStep === 2) {
      logFunnel({ event: 'review_subject_step_shown', source: 'review_form' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStep]);

  // Explicit skip of subject selection — logged so we can see how often people
  // review something we can't link yet.
  const handleSubjectSkip = () => {
    logFunnel({ event: 'review_subject_skipped', source: 'review_form' });
    handleNext();
  };

  // Determine if the next button should be disabled
  const isNextDisabled = () => {
    if (isSubmitting) return true;
    
    switch (currentStep) {
      case 1: return rating === 0;
      // Step 2: Next requires a subject. Users without one use "Skip for now".
      case 2: return !selectedSubject;
      case 3: 
        if (category === 'food') return !foodName;
        return !contentName;
      default: return false;
    }
  };

  
  // Get dialog title based on current step
  const getDialogTitle = () => {
    // Get category-specific emoji
    const getEmoji = () => {
      switch(category) {
        case 'food': return '🍽️';
        case 'movie': return '🎬';
        case 'book': return '📚';
        case 'place': return '📍';
        case 'product': return '🛍️';
        default: return '✨';
      }
    };
    
    // Get step-specific text without emoji
    let titleText;
    switch (currentStep) {
      case 1: return { emoji: '', text: 'Rate your experience' };
      case 2: return { emoji: '', text: 'What are you reviewing?' };
      case 3: return { emoji: getEmoji(), text: `Tell us about your ${category}` };
      case 4: return { emoji: '', text: 'Add final details' };
      default: return { emoji: '', text: isEditMode ? 'Edit your review' : 'Create a review' };
    }
  };

  return (
    <>
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            handleClose();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {/* Separate emoji from text so emoji retains original color */}
              {getDialogTitle().emoji && (
                <span className="text-inherit">{getDialogTitle().emoji}</span>
              )}
              <span className="bg-gradient-to-r from-brand-orange to-brand-orange/80 bg-clip-text text-transparent">
                {getDialogTitle().text}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {/* Step indicator - now with click handler */}
            <StepIndicator 
              currentStep={currentStep} 
              totalSteps={4}
              completedSteps={completedSteps} 
              onStepClick={handleStepClick}
            />
            
            {/* Step content */}
            <div className="min-h-[400px]">
              {currentStep === 1 && (
                <StepOne 
                  rating={rating} 
                  onChange={setRating} 
                  showError={showRatingError}
                />
              )}
              
              {currentStep === 2 && (
                <SubjectSelectStep
                  subject={selectedSubject}
                  onSubjectChange={handleSubjectChange}
                  disabled={isFromEntityPage}
                  onSkip={handleSubjectSkip}
                  contextLine={subjectContextLine}
                  isResolvingContext={isResolvingSubjectContext}
                />
              )}
              
              {currentStep === 3 && (
                <StepThree 
                  category={category}
                  title={category === 'food' ? foodName : contentName}
                  onTitleChange={category === 'food' ? setFoodName : setContentName}
                  venue={venue}
                  onVenueChange={setVenue}
                  entityId={entityId}
                  onEntitySelect={handleEntitySelect}
                  selectedEntity={selectedEntity}
                  selectedMedia={selectedMedia}
                  onMediaAdd={handleAddMedia}
                   onMediaRemove={handleRemoveMedia}
                   isUploading={isUploading}
                   disableEntityChange={isFromEntityPage || !!selectedSubject}
                   disableEntityFields={isFromEntityPage || !!selectedSubject}

                />
              )}

              
              {currentStep === 4 && (
                <StepFour 
                  category={category}
                  title={reviewTitle}
                  onTitleChange={setReviewTitle}
                  description={description}
                  onDescriptionChange={setDescription}
                  experienceDate={experienceDate}
                  onExperienceDateChange={setExperienceDate}
                  visibility={visibility}
                  onVisibilityChange={(value: "public" | "circle_only" | "private") => setVisibility(value)}
                  foodTags={foodTags}
                  onAddFoodTag={(tag) => setFoodTags([...foodTags, tag])}
                  onRemoveFoodTag={(tag) => setFoodTags(foodTags.filter(t => t !== tag))}
                />
              )}
            </div>
            
            {/* Navigation buttons */}
            <StepNavigation 
              currentStep={currentStep}
              totalSteps={4}
              isFirstStep={currentStep === 1}
              isLastStep={currentStep === 4}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isNextDisabled={isNextDisabled()}
              isSubmitting={isSubmitting}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Exit Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showExitConfirmation}
        onClose={handleCancelExit}
        onConfirm={handleConfirmExit}
        title="Discard this review?"
        description="Your changes will not be saved."
        isLoading={false}
      />
    </>
  );
};

export default ReviewForm;
