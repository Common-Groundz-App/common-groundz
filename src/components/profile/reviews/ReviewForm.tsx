import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createReview, updateReview, Review } from '@/services/reviewService';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import { Entity } from '@/services/recommendation/types';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';

// Import step components
import StepOne from './steps/StepOne';
import StepTwo from './steps/StepTwo';
import StepThree from './steps/StepThree';
import StepFour from './steps/StepFour';
import StepIndicator from './StepIndicator';
import StepNavigation from './StepNavigation';

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  review?: Review;
  isEditMode?: boolean;
}

const ReviewForm = ({
  isOpen,
  onClose,
  onSubmit,
  review,
  isEditMode = false
}: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleImageUpload } = useRecommendationUploads();
  
  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Exit confirmation state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Form data
  const [rating, setRating] = useState(review?.rating || 0);
  const [category, setCategory] = useState(review?.category || 'food');
  const [title, setTitle] = useState(review?.title || '');
  const [venue, setVenue] = useState(review?.venue || '');
  const [entityId, setEntityId] = useState(review?.entity_id || '');
  const [description, setDescription] = useState(review?.description || '');
  const [imageUrl, setImageUrl] = useState(review?.image_url || '');
  const [selectedImage, setSelectedImage] = useState<string | null>(review?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [experienceDate, setExperienceDate] = useState<Date | undefined>(
    review?.experience_date ? new Date(review.experience_date) : undefined
  );
  const [visibility, setVisibility] = useState<"public" | "circle_only" | "private">(
    (review?.visibility as "public" | "circle_only" | "private") || "public"
  );
  const [foodTags, setFoodTags] = useState<string[]>(review?.metadata?.food_tags || []);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  
  // If in edit mode, populate entity once review is available
  useEffect(() => {
    if (isEditMode && review?.entity) {
      setSelectedEntity(review.entity);
    }
  }, [review, isEditMode]);
  
  // Track form changes
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    
    // Check if form has non-default values
    const hasChanges = 
      (rating > 0) || 
      (title !== '') || 
      (venue !== '') || 
      (description !== '') || 
      (selectedImage !== null) || 
      (foodTags.length > 0) ||
      (entityId !== '');
      
    setHasUnsavedChanges(hasChanges);
  }, [isOpen, rating, title, venue, description, selectedImage, foodTags, entityId]);
  
  // Reset form on close or when switching to a different review in edit mode
  useEffect(() => {
    if (!isOpen) {
      if (!isEditMode) {
        resetForm();
      }
    } else if (isEditMode && review) {
      // Populate form with review data
      setRating(review.rating);
      setCategory(review.category);
      setTitle(review.title);
      setVenue(review.venue || '');
      setEntityId(review.entity_id || '');
      setDescription(review.description || '');
      setImageUrl(review.image_url || '');
      setSelectedImage(review.image_url || null);
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
    setTitle('');
    setVenue('');
    setEntityId('');
    setDescription('');
    setImageUrl('');
    setSelectedImage(null);
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
  
  const handleImageUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const url = await handleImageUpload(file);
      if (url) {
        setImageUrl(url);
        setSelectedImage(url);
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
  
  const handleEntitySelect = (entity: Entity) => {
    console.log("Entity selected in ReviewForm:", entity);
    setSelectedEntity(entity);
    setEntityId(entity.id);
    
    // For food category, only update the venue field (restaurant name)
    if (category === 'food') {
      console.log("Food category in ReviewForm: Setting venue");
      
      // For Google Places, always use the name as restaurant name, never address
      if (entity.api_source === 'google_places') {
        console.log("Using Google Places source: setting venue to name only:", entity.name);
        setVenue(entity.name);
      } else {
        // For other sources, use venue or fallback to name
        setVenue(entity.venue || entity.name || '');
      }
      
      // Do not set title or description for food category
    } else {
      // For other categories, auto-fill title from entity
      if (entity.name) setTitle(entity.name);
      if (entity.venue) setVenue(entity.venue);
      // Do not auto-fill description for any category
    }
    
    // Use entity image if no user image has been selected
    if (entity.image_url && !selectedImage) {
      setImageUrl(entity.image_url);
      setSelectedImage(entity.image_url);
    }
  };
  
  const handleNext = () => {
    // Validate current step
    if (currentStep === 1 && rating === 0) {
      toast({
        title: 'Rating required',
        description: 'Please select a rating before proceeding.',
        variant: 'destructive'
      });
      return;
    }
    
    if (currentStep === 3 && !title) {
      toast({
        title: 'Title required',
        description: `Please provide a name for the ${category} you're reviewing.`,
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
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add reviews'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare metadata based on category
      const metadata = category === 'food' ? { food_tags: foodTags } : undefined;
      
      // Convert Date to ISO string for API submission
      const formattedExperienceDate = experienceDate ? experienceDate.toISOString() : undefined;
      
      if (isEditMode && review) {
        await updateReview(review.id, {
          title,
          venue,
          description,
          rating,
          image_url: imageUrl,
          category,
          visibility,
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
          title,
          venue,
          description,
          rating,
          image_url: imageUrl,
          category,
          visibility,
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
  
  // Determine if the next button should be disabled
  const isNextDisabled = () => {
    if (isSubmitting) return true;
    
    switch (currentStep) {
      case 1: return rating === 0;
      case 3: return title === '';
      default: return false;
    }
  };
  
  // Get dialog title based on current step
  const getDialogTitle = () => {
    const emoji = category === 'food' ? '🍽️' : 
                 category === 'movie' ? '🎬' : 
                 category === 'book' ? '📚' : 
                 category === 'place' ? '📍' : '🛍️';
                 
    switch (currentStep) {
      case 1: return 'Rate your experience';
      case 2: return 'Select a category';
      case 3: return `Tell us about your ${category} ${emoji}`;
      case 4: return 'Add final details';
      default: return isEditMode ? 'Edit your review' : 'Create a review';
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
              <span className="bg-gradient-to-r from-brand-orange to-brand-orange/80 bg-clip-text text-transparent">
                {getDialogTitle()}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {/* Step indicator */}
            <StepIndicator 
              currentStep={currentStep} 
              totalSteps={4}
              completedSteps={completedSteps} 
            />
            
            {/* Step content */}
            <div className="min-h-[400px]">
              {currentStep === 1 && (
                <StepOne rating={rating} onChange={setRating} />
              )}
              
              {currentStep === 2 && (
                <StepTwo category={category} onChange={setCategory} />
              )}
              
              {currentStep === 3 && (
                <StepThree 
                  category={category}
                  title={title}
                  onTitleChange={setTitle}
                  venue={venue}
                  onVenueChange={setVenue}
                  entityId={entityId}
                  onEntitySelect={handleEntitySelect}
                  selectedEntity={selectedEntity}
                  selectedImage={selectedImage}
                  onImageChange={handleImageUploadChange}
                  onImageRemove={() => {
                    setImageUrl('');
                    setSelectedImage(null);
                  }}
                  isUploading={isUploading}
                />
              )}
              
              {currentStep === 4 && (
                <StepFour 
                  category={category}
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
