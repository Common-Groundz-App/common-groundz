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
import { isOfferingType, getOfferingContextLine } from '@/services/entityRelationshipRegistry';
import {
  LEGACY_UNLINKED_QUESTIONNAIRE,
} from './questionnaire/registry';
import {
  resolveQuestionnaire,
  blocksSubmission,
  invalidSubjectMessage,
} from './questionnaire/resolve';
import { resolveReviewIdentity } from './questionnaire/identityPersistence';
import { mergeReviewMetadata } from './questionnaire/metadata';
import type { QuestionnaireAnswers } from './questionnaire/QuestionnaireSections';


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

  
  /**
   * Phase 3A — identity is no longer a review question for linked subjects.
   * These two pieces of state exist ONLY for the legacy-UNLINKED edit path,
   * where the historical title/venue must stay editable. Phase 3D removes the
   * remaining machinery around them.
   */
  const [legacyTitle, setLegacyTitle] = useState(review?.title || '');
  const [legacyVenue, setLegacyVenue] = useState(review?.venue || '');
  const [reviewTitle, setReviewTitle] = useState(review?.subtitle || ''); // Review headline (subtitle) in Step 4
  /** Provider (parent) name resolved from the hierarchy, for the venue snapshot. */
  const [resolvedProviderName, setResolvedProviderName] = useState<string | null>(null);
  
  const [entityId, setEntityId] = useState(review?.entity_id || entity?.id || '');
  const [description, setDescription] = useState(review?.description || '');

  
  // Flag to determine if the form was opened from an entity page.
  // Declared early because the subject requirement policy depends on it.
  const isFromEntityPage = !!entity && !isEditMode;
  
  /**
   * Phase 2.4 — the original persisted entity_id for the review being edited,
   * scoped to the loaded review id. This prevents a mounted form from carrying
   * a previous review's legacy status into a different review.
   */
  const [originalEntityId, setOriginalEntityId] = useState<string | null>(
    review?.entity_id ?? null
  );
  const [originalReviewId, setOriginalReviewId] = useState<string | null>(
    review?.id ?? null
  );
  
  const requirement: SubjectRequirement = subjectRequirement({
    isEditMode,
    originalEntityId,
    isFromEntityPage,
  });
  
  // Updated media handling
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
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
  
  /**
   * Phase 3A — questionnaire resolution. Three explicit modes; a linked subject
   * whose type does not parse is an invariant failure, never a generic or
   * product questionnaire.
   *
   * Type source order: the live subject → the loaded review's entity → the
   * stored canonical `category` (Phase 2.1 persists canonical types), so a
   * failed subject lookup is not mistaken for an unusable subject.
   */
  const subjectTypeSource =
    selectedSubject?.type ?? review?.entity?.type ?? review?.category ?? null;
  const resolution = React.useMemo(
    () => resolveQuestionnaire({ entityId, subjectType: subjectTypeSource }),
    [entityId, subjectTypeSource],
  );
  const questionnaireConfig =
    resolution.mode === 'invalid' ? LEGACY_UNLINKED_QUESTIONNAIRE : resolution.config;
  const invalidMessage = invalidSubjectMessage(resolution);
  
  const questionnaireAnswers: QuestionnaireAnswers = React.useMemo(
    () => ({ tags: { food_tags: foodTags }, text: {} }),
    [foodTags],
  );
  
  const handleAddAnswerTag = (fieldId: string, tag: string) => {
    if (fieldId !== 'food_tags') return;
    setFoodTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };
  const handleRemoveAnswerTag = (fieldId: string, tag: string) => {
    if (fieldId !== 'food_tags') return;
    setFoodTags((prev) => prev.filter((t) => t !== tag));
  };
  // No text answers exist until the Phase 3B matrix is approved.
  const handleAnswerTextChange = (_fieldId: string, _value: string) => {};

  
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
      
      // Scope originalEntityId to the loaded review id.
      setOriginalReviewId(review.id);
      setOriginalEntityId(review.entity_id ?? null);
      
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
    setOriginalEntityId(null);
    setOriginalReviewId(null);
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
    
    if (currentStep === 2 && !allowsMissingSubject(requirement) && !selectedSubject) {
      toast({
        title: 'Subject required',
        description: 'Choose what you\'re reviewing before continuing.',
        variant: 'destructive'
      });
      return;
    }
    
    // A linked subject we cannot classify is unusable — send the user back to
    // Step 2 instead of letting them progress with a broken subject.
    if (resolution.mode === 'invalid') {
      toast({
        title: "We can't review this subject",
        description: 'Go back and pick a different one.',
        variant: 'destructive'
      });
      setCurrentStep(2);
      return;
    }
    
    if (currentStep === 3 && resolution.mode === 'legacy-unlinked' && !legacyTitle.trim()) {
      toast({
        title: 'Name required',
        description: 'Tell us what this review is about.',
        variant: 'destructive'
      });
      return;
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
    if (!requireAuth({ action: 'review', surface: 'review_form', entityId, entityName: selectedSubject?.name || legacyTitle })) return;
    
    // Phase 2.4 — new reviews and linked edits must have a real subject.
    if (!allowsMissingSubject(requirement) && !entityId) {
      toast({
        title: 'Subject required',
        description: 'Choose what you\'re reviewing before publishing.',
        variant: 'destructive'
      });
      setCurrentStep(2);
      return;
    }
    
    // Phase 3A — a linked subject with an unusable type can never be published.
    if (blocksSubmission(resolution)) {
      toast({
        title: "We can't review this subject",
        description: 'Go back and pick a different one.',
        variant: 'destructive'
      });
      setCurrentStep(2);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      /**
       * Phase 3A — metadata is MERGED, never replaced. Writing a fresh object
       * here used to wipe provenance and every other stored key on a food edit.
       * Non-object stored values are ignored rather than spread.
       */
      const metadata = mergeReviewMetadata(
        review?.metadata,
        questionnaireConfig.sections.some((s) => s.fields.some((f) => f.id === 'food_tags'))
          ? { food_tags: foodTags }
          : undefined,
      );
      
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
      
      /**
       * Phase 3A — identity is derived from the subject, never re-typed, and
       * `subjectOrigin` protects historical rows from a silent rewrite.
       */
      const identity = resolveReviewIdentity({
        subjectOrigin,
        subject: selectedSubject
          ? {
              name: selectedSubject.name,
              type: resolution.mode === 'canonical' ? resolution.type : null,
              venue: (selectedSubject as any).venue ?? null,
              metadata: (selectedSubject as any).metadata ?? null,
            }
          : null,
        providerName: resolvedProviderName,
        storedTitle: review?.title ?? null,
        storedVenue: review?.venue ?? null,
        legacyTitle,
        legacyVenue,
        isLegacyUnlinked: resolution.mode === 'legacy-unlinked',
      });
      const finalTitle = identity.title;
      const finalVenue = identity.venue;

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
          title: finalTitle, // Subject identity
          subtitle: reviewTitle, // Store the review headline in the subtitle field
          venue: finalVenue,
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
          title: finalTitle, // Subject identity
          subtitle: reviewTitle, // Store the review headline in the subtitle field
          venue: finalVenue,
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

      // Phase 2.4 telemetry.
      if (isEditMode && allowsMissingSubject(requirement) && !entityId) {
        logFunnel({ event: 'review_subject_legacy_unlinked', source: 'review_form' });
      }
      if (
        !isEditMode &&
        entityId &&
        canonicalCategory &&
        persistedCategory !== canonicalCategory
      ) {
        logFunnel({
          event: 'review_subject_type_divergence',
          source: 'review_form',
          entityType: canonicalCategory,
          category: persistedCategory,
        });
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

  // Legacy unlinked reviews may continue without a subject.
  const handleContinueWithoutSubject = () => {
    logFunnel({ event: 'review_subject_legacy_unlinked', source: 'review_form' });
    handleNext();
  };

  // Determine if the next button should be disabled
  const isNextDisabled = () => {
    if (isSubmitting) return true;
    // A linked subject with an unusable type is not a questionnaire with zero
    // required fields — it is an unusable subject and blocks the whole wizard.
    if (resolution.mode === 'invalid' && currentStep >= 2) return true;
    
    switch (currentStep) {
      case 1: return rating === 0;
      // Step 2: Next requires a subject unless this is a legacy-optional edit.
      case 2: return !allowsMissingSubject(requirement) && !selectedSubject;
      case 3:
        // Only legacy unlinked reviews still carry an editable identity field.
        return resolution.mode === 'legacy-unlinked' && !legacyTitle.trim();
      default: return false;
    }
  };

  
  // Get dialog title based on current step
  const getDialogTitle = () => {
    switch (currentStep) {
      case 1: return { emoji: '', text: 'Rate your experience' };
      case 2: return { emoji: '', text: 'What are you reviewing?' };
      case 3: return { emoji: '', text: `Tell us about your ${questionnaireConfig.subjectLabel}` };
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
                  requirement={requirement}
                  onContinueWithoutSubject={
                    allowsMissingSubject(requirement) ? handleContinueWithoutSubject : undefined
                  }
                  contextLine={subjectContextLine}
                  isResolvingContext={isResolvingSubjectContext}
                />
              )}
              
              {currentStep === 3 && (
                <StepThree
                  config={questionnaireConfig}
                  subjectType={resolution.mode === 'canonical' ? resolution.type : null}
                  selectedEntity={selectedEntity}
                  contextLine={subjectContextLine}
                  invalidMessage={invalidMessage}
                  legacyMode={resolution.mode === 'legacy-unlinked'}
                  legacyTitle={legacyTitle}
                  onLegacyTitleChange={setLegacyTitle}
                  legacyVenue={legacyVenue}
                  onLegacyVenueChange={setLegacyVenue}
                  selectedMedia={selectedMedia}
                  onMediaAdd={handleAddMedia}
                  onMediaRemove={handleRemoveMedia}
                  isUploading={isUploading}
                />
              )}

              
              {currentStep === 4 && (
                <StepFour
                  config={questionnaireConfig}
                  answers={questionnaireAnswers}
                  onAddTag={handleAddAnswerTag}
                  onRemoveTag={handleRemoveAnswerTag}
                  onAnswerTextChange={handleAnswerTextChange}
                  title={reviewTitle}
                  onTitleChange={setReviewTitle}
                  description={description}
                  onDescriptionChange={setDescription}
                  experienceDate={experienceDate}
                  onExperienceDateChange={setExperienceDate}
                  visibility={visibility}
                  onVisibilityChange={(value: "public" | "circle_only" | "private") => setVisibility(value)}
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
