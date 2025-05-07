
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Clock, Tag as TagIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createReview, updateReview, Review } from '@/services/reviewService';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import EntitySearch from '@/components/recommendations/EntitySearch';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';

// Import our custom components
import RatingStarsEnhanced from './RatingStarsEnhanced';
import CategorySelector from './CategorySelector';
import ImageUploader from './ImageUploader';
import FoodTagSelector from './FoodTagSelector';
import DateSelector from './DateSelector';

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
  
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
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
      food_tags: review?.metadata?.food_tags || [],
    }
  });
  
  const selectedCategory = watch('category');
  const watchImageUrl = watch('image_url');
  const [selectedImage, setSelectedImage] = useState<string | null>(review?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const experienceDate = watch('experience_date');
  const [foodTags, setFoodTags] = useState<string[]>(review?.metadata?.food_tags || []);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [showEntitySearch, setShowEntitySearch] = useState(false);

  useEffect(() => {
    if (watchImageUrl !== selectedImage) {
      setSelectedImage(watchImageUrl || null);
    }
  }, [watchImageUrl]);

  useEffect(() => {
    if (!isOpen) {
      if (!isEditMode) {
        reset();
        setSelectedImage(null);
        setFoodTags([]);
      }
    }
  }, [isOpen, reset, isEditMode]);
  
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
  
  useEffect(() => {
    if (review?.entity && review.entity_id) {
      setSelectedEntity(review.entity);
      setShowEntitySearch(false);
    }
  }, [review]);

  const handleImageUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const url = await handleImageUpload(file);
      if (url) {
        setValue('image_url', url);
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
  
  const handleFormSubmit = async (values: any) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add reviews'
      });
      return;
    }
    
    if (
      !values.image_url && // No custom uploaded image by user
      selectedEntity &&
      selectedEntity.image_url
    ) {
      values.image_url = selectedEntity.image_url;
    }

    try {
      const metadata = values.category === 'food' ? { food_tags: foodTags } : undefined;
      
      if (isEditMode && review) {
        await updateReview(review.id, {
          ...values,
          metadata,
        });
        toast({
          title: 'Success',
          description: 'Review has been updated successfully'
        });
      } else {
        await createReview({
          ...values,
          metadata,
          user_id: user.id
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
      await onSubmit();
      onClose();
    } catch (error) {
      console.error('Error saving review:', error);
      toast({
        title: 'Error',
        description: 'Failed to save review. Please try again.'
      });
    }
  };

  const getCategoryEmoji = () => {
    switch(selectedCategory) {
      case 'food': return '🍽️';
      case 'movie': return '🎬';
      case 'book': return '📚';
      case 'place': return '📍';
      case 'product': return '🛍️';
      default: return '✨';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <span className="text-2xl">{getCategoryEmoji()}</span>
            <span className="bg-gradient-to-r from-brand-orange to-brand-orange/80 bg-clip-text text-transparent">
              {isEditMode ? 'Edit your review' : `What did you think of this ${selectedCategory}?`}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Rating Stars */}
          <Controller
            name="rating"
            control={control}
            rules={{ required: "Please give a rating" }}
            render={({ field }) => (
              <RatingStarsEnhanced 
                value={field.value} 
                onChange={field.onChange}
                size="lg"
              />
            )}
          />
          
          {/* Category Selection */}
          <div className="space-y-2">
            <h3 className="text-md font-medium flex items-center gap-2">
              <span>What are you reviewing?</span>
            </h3>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <CategorySelector 
                  selected={field.value} 
                  onChange={(category) => {
                    field.onChange(category);
                    setSelectedEntity(null);
                    setShowEntitySearch(false);
                    setValue('entity_id', '');
                  }} 
                />
              )}
            />
          </div>
          
          {/* Entity selection/preview */}
          {['movie', 'book', 'place', 'product'].includes(selectedCategory) && !isEditMode && (
            <>
              {selectedEntity && !showEntitySearch ? (
                <EntityPreviewCard
                  entity={selectedEntity}
                  type={selectedCategory}
                  onChange={() => setShowEntitySearch(true)}
                />
              ) : (
                <div className="p-4 border border-dashed border-brand-orange/30 rounded-lg bg-gradient-to-b from-transparent to-accent/5 transition-all duration-300 hover:border-brand-orange/50">
                  <Label className="flex items-center gap-2 font-medium mb-2">
                    <span className="p-1.5 rounded-full bg-brand-orange/10">
                      <MapPin className="h-4 w-4 text-brand-orange" />
                    </span>
                    <span>Search for {selectedCategory}</span>
                  </Label>
                  <EntitySearch 
                    type={selectedCategory as any}
                    onSelect={handleEntitySelect}
                  />
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Can't find what you're looking for? Just share details below
                  </p>
                </div>
              )}
            </>
          )}

          {/* For Food category, search for restaurant */}
          {!isEditMode && selectedCategory === 'food' && (
            <>
              {selectedEntity && !showEntitySearch ? (
                <EntityPreviewCard
                  entity={selectedEntity}
                  type="food"
                  onChange={() => setShowEntitySearch(true)}
                />
              ) : (
                <div className="p-4 border border-dashed border-brand-orange/30 rounded-lg bg-gradient-to-b from-transparent to-accent/5 transition-all duration-300 hover:border-brand-orange/50">
                  <Label className="flex items-center gap-2 font-medium mb-2">
                    <span className="p-1.5 rounded-full bg-brand-orange/10">
                      <MapPin className="h-4 w-4 text-brand-orange" />
                    </span>
                    <span>Where did you eat?</span>
                  </Label>
                  <EntitySearch 
                    type="place"
                    onSelect={(entity) => {
                      setSelectedEntity(entity);
                      setShowEntitySearch(false);
                      setValue('venue', entity.name);
                      if (entity.description) setValue('description', entity.description);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Or just type the restaurant name below
                  </p>
                </div>
              )}
            </>
          )}
          
          {/* When did you experience this? */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-medium">
              <span className="p-1.5 rounded-full bg-brand-orange/10">
                <Clock className="h-4 w-4 text-brand-orange" />
              </span>
              <span>When did you experience this?</span>
            </Label>
            
            <Controller
              name="experience_date"
              control={control}
              render={({ field }) => (
                <DateSelector 
                  value={field.value} 
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              {/* What did you have? / Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center gap-2 font-medium">
                  <span className="text-lg">{selectedCategory === 'food' ? '🍴' : getCategoryEmoji()}</span>
                  <span>{selectedCategory === 'food' ? 'What did you eat?' : 'Name'}</span>
                </Label>
                <Input 
                  id="title"
                  {...register('title', { required: "Required" })}
                  placeholder={selectedCategory === 'food' ? "E.g. Pad Thai, Cheeseburger..." : "Title"}
                  className={cn(
                    errors.title ? "border-red-500" : "border-brand-orange/30 focus-visible:ring-brand-orange/30",
                    "transition-all duration-200"
                  )}
                />
                {errors.title && (
                  <p className="text-red-500 text-xs">{errors.title.message?.toString()}</p>
                )}
              </div>
              
              {/* Location/Venue */}
              <div className="space-y-2">
                <Label htmlFor="venue" className="flex items-center gap-2 font-medium">
                  {selectedCategory === 'food' ? (
                    <>
                      <span className="text-lg">🏠</span>
                      <span>Restaurant name</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{
                        selectedCategory === 'movie' ? '🎬' : 
                        selectedCategory === 'book' ? '✍️' : 
                        selectedCategory === 'place' ? '📍' : '🏢'
                      }</span>
                      <span>{
                        selectedCategory === 'movie' ? 'Director/Studio' : 
                        selectedCategory === 'book' ? 'Author/Publisher' : 
                        selectedCategory === 'place' ? 'Location' : 'Brand'
                      }</span>
                    </>
                  )}
                </Label>
                <Input 
                  id="venue"
                  {...register('venue')}
                  placeholder={
                    selectedCategory === 'food' ? "Where did you eat this?" : 
                    selectedCategory === 'movie' ? "Who made this movie?" : 
                    selectedCategory === 'book' ? "Who wrote this book?" : 
                    selectedCategory === 'place' ? "Address or location" : "Who made this product?"
                  }
                  className="border-brand-orange/30 focus-visible:ring-brand-orange/30 transition-all duration-200"
                />
              </div>
              
              {/* Food tags if category is food */}
              {selectedCategory === 'food' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <span className="p-1.5 rounded-full bg-brand-orange/10">
                      <TagIcon className="h-4 w-4 text-brand-orange" />
                    </span>
                    <span>Add tags</span>
                  </Label>
                  
                  <FoodTagSelector
                    selectedTags={foodTags}
                    onAddTag={(tag) => setFoodTags([...foodTags, tag])}
                    onRemoveTag={(tag) => setFoodTags(foodTags.filter(t => t !== tag))}
                  />
                </div>
              )}
              
              {/* Visibility */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <span className="text-lg">👁️</span>
                  <span>Who can see this review?</span>
                </Label>
                <Controller
                  name="visibility"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-3 gap-2"
                    >
                      <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="public" id="public" className="text-brand-orange" />
                        <Label htmlFor="public" className="cursor-pointer text-xs font-normal">Everyone</Label>
                      </div>
                      <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
                        <Label htmlFor="circle" className="cursor-pointer text-xs font-normal">My Circle</Label>
                      </div>
                      <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="private" id="private" className="text-brand-orange" />
                        <Label htmlFor="private" className="cursor-pointer text-xs font-normal">Just Me</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-5">
              {/* Add Photo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium mb-1">
                  <span className="text-lg">📸</span>
                  <span>Add a photo</span>
                </Label>
                <ImageUploader
                  selectedImage={selectedImage}
                  onChange={handleImageUploadChange}
                  onRemove={() => {
                    setValue('image_url', '');
                    setSelectedImage(null);
                  }}
                  isUploading={isUploading}
                />
              </div>
              
              {/* Your Review */}
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2 font-medium">
                  <span className="text-lg">💬</span>
                  <span>Your thoughts? (optional)</span>
                </Label>
                <Textarea 
                  id="description"
                  {...register('description')}
                  placeholder="Tell us what you liked or didn't like..."
                  rows={5}
                  className="border-brand-orange/30 focus-visible:ring-brand-orange/30 resize-none transition-all duration-200"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="border-brand-orange/30 hover:text-brand-orange hover:bg-brand-orange/5 transition-all duration-200"
            >
              Nevermind
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading}
              className="bg-gradient-to-r from-brand-orange to-brand-orange/90 hover:from-brand-orange/90 hover:to-brand-orange text-white shadow-md hover:shadow-lg transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Saving changes..." : "Posting review..."}
                </>
              ) : (
                <>
                  {isEditMode ? "Save changes" : "Share review"} {isEditMode ? "✏️" : "✨"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;

