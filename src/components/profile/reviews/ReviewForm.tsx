
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import StepOne from './steps/StepOne';
import StepTwo from './steps/StepTwo';
import StepThree from './steps/StepThree';
import StepFour from './steps/StepFour';
import { Entity } from '@/services/recommendation/types';
import { useRecommendationUploads } from '@/hooks/use-recommendation-uploads';
import { supabase } from '@/integrations/supabase/client';

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: any) => Promise<void>;
  review?: any;
  isEditMode?: boolean; // Added isEditMode prop
}

const ReviewForm = ({ isOpen, onClose, onSubmit, review = null, isEditMode = false }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleImageUpload: uploadImage } = useRecommendationUploads(); // Renamed to avoid conflict
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  // Added state to track where the image came from - entity or user
  const [isEntityImage, setIsEntityImage] = useState(false);
  
  const formSchema = z.object({
    category: z.string().min(1, { message: 'Please select a category' }),
    rating: z.number().min(1, { message: 'Please select a rating' }).max(5),
    title: z.string().min(1, { message: 'Title is required' }),
    venue: z.string().optional(),
    content: z.string().min(10, { message: 'Please write at least 10 characters' }),
    entity_id: z.string().optional(),
    visibility: z.enum(['public', 'circle_only', 'private']),
  });
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: review?.category || 'food',
      rating: review?.rating || 0,
      title: review?.title || '',
      venue: review?.venue || '',
      content: review?.content || '',
      entity_id: review?.entity_id || '',
      visibility: review?.visibility || 'public',
    },
  });
  
  const { watch, setValue, trigger, getValues } = form;
  
  const category = watch('category');
  const rating = watch('rating');
  const title = watch('title');
  const venue = watch('venue');
  const content = watch('content');
  const entity_id = watch('entity_id');
  
  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      form.reset();
      setSelectedImage(null);
      setSelectedEntity(null);
      setIsEntityImage(false);
    }
  }, [isOpen, form]);
  
  // Updated image upload handler - renamed to processImageUpload to avoid conflict
  const processImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // Upload custom user image
      const imageUrl = await uploadImage(file);
      
      if (imageUrl) {
        // Since we're uploading a user image, this is not an entity image
        setSelectedImage(imageUrl);
        setIsEntityImage(false);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // New handler to use entity image without uploading
  const handleUseEntityImage = useCallback((imageUrl: string) => {
    if (imageUrl) {
      setSelectedImage(imageUrl);
      setIsEntityImage(true);
    }
  }, []);
  
  const handleNext = async () => {
    let isValid = false;
    
    switch (step) {
      case 1:
        isValid = await trigger(['category']);
        break;
      case 2:
        isValid = await trigger(['rating']);
        break;
      case 3:
        isValid = await trigger(['title']);
        break;
      case 4:
        isValid = await trigger(['content']);
        break;
      default:
        isValid = true;
    }
    
    if (isValid) {
      setStep(prev => Math.min(prev + 1, 5));
    }
  };
  
  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };
  
  const handleEntitySelect = (entity: Entity) => {
    setSelectedEntity(entity);
    setValue('entity_id', entity.id);
  };
  
  // Modify the form submit handler to handle the image source correctly
  const handleFormSubmit = async (values: any) => {
    try {
      setIsSubmitting(true);
      
      // Create a payload with the form values
      const payload = {
        ...values,
        // If it's an entity image, pass it directly without triggering a new upload
        image_url: selectedImage,
        is_entity_image: isEntityImage, // Pass this flag to backend if needed
      };
      
      // Call the parent's onSubmit handler
      await onSubmit(payload);
      
      // Reset form
      form.reset();
      setSelectedImage(null);
      setSelectedEntity(null);
      setIsEntityImage(false);
      setStep(1);
      
      // Close dialog
      onClose();
      
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Submission failed',
        description: 'Failed to submit your review. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepOne 
            selectedCategory={category} 
            onCategoryChange={(value) => setValue('category', value)} 
          />
        );
      case 2:
        return (
          <StepTwo 
            selectedRating={rating} 
            onRatingChange={(value) => setValue('rating', value)} 
          />
        );
      case 3:
        return (
          <StepThree
            category={category}
            title={title}
            onTitleChange={(value) => setValue('title', value)}
            venue={venue}
            onVenueChange={(value) => setValue('venue', value)}
            entityId={entity_id}
            onEntitySelect={handleEntitySelect}
            selectedEntity={selectedEntity}
            selectedImage={selectedImage}
            onImageChange={processImageUpload}
            onImageRemove={() => {
              setSelectedImage(null);
              setIsEntityImage(false);
            }}
            isUploading={isUploading}
            isEntityImage={isEntityImage}
            onUseEntityImage={handleUseEntityImage}
          />
        );
      case 4:
        return (
          <StepFour
            reviewContent={content}
            onContentChange={(value) => setValue('content', value)}
            selectedVisibility={watch('visibility')}
            onVisibilityChange={(value) => setValue('visibility', value)}
          />
        );
      default:
        return null;
    }
  };
  
  const isLastStep = step === 4;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {isEditMode ? 'Edit Review' : 'Create Review'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {renderStep()}
        </div>
        
        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? onClose : handleBack}
            disabled={isSubmitting}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          <Button
            type="button"
            onClick={isLastStep ? form.handleSubmit(handleFormSubmit) : handleNext}
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : isLastStep ? (
              'Submit Review'
            ) : (
              'Next'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;
