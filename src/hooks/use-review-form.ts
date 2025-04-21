import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createReview, updateReview, Review } from '@/services/reviewService';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';

interface UseReviewFormProps {
  review?: Review;
  isEditMode?: boolean;
  onSuccess: () => Promise<void>;
  onClose: () => void;
}

export const useReviewForm = ({ review, isEditMode = false, onSuccess, onClose }: UseReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleImageUpload } = useRecommendationUploads();
  
  const [selectedImage, setSelectedImage] = useState<string | null>(review?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [foodTags, setFoodTags] = useState<string[]>(review?.metadata?.food_tags || []);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [showEntitySearch, setShowEntitySearch] = useState(false);

  const form = useForm({
    defaultValues: {
      title: review?.title || '',
      venue: review?.venue || '',
      description: review?.description || '',
      rating: review?.rating || 0,
      image_url: review?.image_url || '',
      category: review?.category || 'food',
      visibility: review?.visibility || 'public',
      entity_id: review?.entity_id || '',
      experience_date: review?.experience_date ? new Date(review.experience_date) : undefined,
    }
  });

  const { watch, setValue, reset, handleSubmit, control, formState } = form;
  const selectedCategory = watch('category');
  const watchImageUrl = watch('image_url');

  useEffect(() => {
    if (watchImageUrl !== selectedImage) {
      setSelectedImage(watchImageUrl || null);
    }
  }, [watchImageUrl, selectedImage]);

  useEffect(() => {
    if (!isEditMode && review?.entity && review.entity_id) {
      setSelectedEntity(review.entity);
      setShowEntitySearch(false);
    }
  }, [review, isEditMode]);

  useEffect(() => {
    if (isEditMode && review) {
      setValue('title', review.title);
      setValue('venue', review.venue || '');
      setValue('description', review.description || '');
      setValue('rating', review.rating);
      setValue('image_url', review.image_url || '');
      setValue('category', review.category);
      setValue('visibility', review.visibility);
      setValue('entity_id', review.entity_id || '');
      if (review.experience_date) {
        setValue('experience_date', new Date(review.experience_date));
      }
      setSelectedImage(review.image_url || null);
      if (review.metadata?.food_tags) {
        setFoodTags(review.metadata.food_tags);
      }
    }
  }, [review, isEditMode, setValue]);

  const handleImageUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const url = await handleImageUpload(file);
      if (url) {
        setValue('image_url', url);
        setSelectedImage(url);
        
        console.log('Image uploaded successfully:', url);
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

  const handleFormSubmit = async (values: any) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add reviews'
      });
      return;
    }
    
    try {
      const metadata = values.category === 'food' ? { food_tags: foodTags } : undefined;
      
      console.log('Creating review with metadata:', metadata);
      console.log('Review data being submitted:', {
        ...values,
        image_url: values.image_url || selectedImage,
      });
      
      if (isEditMode && review) {
        await updateReview(review.id, {
          ...values,
          image_url: values.image_url || selectedImage,
          metadata,
        });
        toast({
          title: 'Success',
          description: 'Review has been updated successfully'
        });
      } else {
        await createReview({
          title: values.title,
          rating: values.rating,
          user_id: user.id,
          category: values.category,
          visibility: values.visibility,
          description: values.description,
          venue: values.venue,
          entity_id: values.entity_id,
          image_url: values.image_url || selectedImage,
          experience_date: values.experience_date ? values.experience_date.toISOString().split('T')[0] : undefined,
          metadata
        });
        toast({
          title: 'Success',
          description: 'Review has been added successfully'
        });
        if (!isEditMode) {
          reset();
          setSelectedImage(null);
          setFoodTags([]);
        }
      }
      await onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving review:', error);
      toast({
        title: 'Error',
        description: 'Failed to save review. Please try again.'
      });
    }
  };

  const handleEntitySelect = (entity: any) => {
    setSelectedEntity(entity);
    setShowEntitySearch(false);
    setValue('title', entity.name);
    setValue('entity_id', entity.id);
    if (entity.venue) setValue('venue', entity.venue);
    if (entity.description) setValue('description', entity.description);
    if (entity.image_url) {
      setValue('image_url', entity.image_url);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedEntity(null);
    setShowEntitySearch(false);
    setValue('entity_id', '');
  };

  const addFoodTag = (tag: string) => {
    if (!foodTags.includes(tag)) {
      setFoodTags([...foodTags, tag]);
    }
  };

  const removeFoodTag = (tag: string) => {
    setFoodTags(foodTags.filter(t => t !== tag));
  };

  return {
    form,
    control,
    watch,
    handleSubmit,
    formState,
    selectedCategory,
    selectedImage,
    isUploading,
    datePickerOpen,
    setDatePickerOpen,
    foodTags,
    selectedEntity,
    setSelectedEntity,
    showEntitySearch,
    setShowEntitySearch,
    handleImageUploadChange,
    handleFormSubmit,
    handleEntitySelect,
    handleCategoryChange,
    addFoodTag,
    removeFoodTag,
    setValue,
  };
};
