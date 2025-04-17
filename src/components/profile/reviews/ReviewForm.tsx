
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createReview, updateReview, Review } from '@/services/reviewService';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import EntitySearch from '@/components/recommendations/EntitySearch';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
    }
  });
  
  const selectedCategory = watch('category');
  const [selectedImage, setSelectedImage] = useState<string | null>(review?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const experienceDate = watch('experience_date');

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      if (!isEditMode) {
        reset();
        setSelectedImage(null);
      }
    }
  }, [isOpen, reset, isEditMode]);
  
  // Set form values when in edit mode and review changes
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
      if (isEditMode && review) {
        await updateReview(review.id, {
          ...values,
          // The updated_at is automatically set by the database trigger
        });
        toast({
          title: 'Success',
          description: 'Review has been updated successfully'
        });
      } else {
        await createReview({
          ...values,
          user_id: user.id
        });
        toast({
          title: 'Success',
          description: 'Review has been added successfully'
        });
        if (!isEditMode) {
          reset();
          setSelectedImage(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Review' : 'Add New Review'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="place">Place</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          
          {/* Entity search for non-food categories */}
          {!isEditMode && (selectedCategory === 'movie' || selectedCategory === 'book' || 
            selectedCategory === 'place' || selectedCategory === 'product') && (
            <div className="space-y-2">
              <Label>Search for {selectedCategory}</Label>
              <EntitySearch 
                type={selectedCategory as any}
                onSelect={(entity) => {
                  setValue('title', entity.name);
                  setValue('entity_id', entity.id);
                  if (entity.venue) setValue('venue', entity.venue);
                  if (entity.description) setValue('description', entity.description);
                  if (entity.image_url) {
                    setValue('image_url', entity.image_url);
                    setSelectedImage(entity.image_url);
                  }
                }}
              />
            </div>
          )}
          
          {/* Experience Date Field */}
          <div className="space-y-2">
            <Label htmlFor="experience_date">When did you experience this? (optional)</Label>
            <Controller
              name="experience_date"
              control={control}
              render={({ field }) => (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
          
          {/* Title Field */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input 
              id="title"
              {...register('title', { required: "Title is required" })}
              placeholder={`What are you reviewing?`}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-red-500 text-xs">{errors.title.message?.toString()}</p>
            )}
          </div>
          
          {/* Venue Field */}
          <div className="space-y-2">
            <Label htmlFor="venue">
              {selectedCategory === 'food' ? 'Restaurant/Source' : 
                selectedCategory === 'movie' ? 'Director/Studio' : 
                selectedCategory === 'book' ? 'Author/Publisher' : 
                selectedCategory === 'place' ? 'Location/Address' : 'Brand/Manufacturer'}
            </Label>
            <Input 
              id="venue"
              {...register('venue')}
              placeholder={`Where can this ${selectedCategory} be found?`}
            />
          </div>
          
          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Review (optional)</Label>
            <Textarea 
              id="description"
              {...register('description')}
              placeholder="Share your honest thoughts and experience..."
              rows={3}
            />
          </div>
          
          {/* Rating Field */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex items-center">
              <Controller
                name="rating"
                control={control}
                rules={{ required: "Please provide a rating" }}
                render={({ field }) => (
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button
                        type="button"
                        key={star}
                        variant="ghost"
                        className="p-1 hover:bg-transparent"
                        onClick={() => field.onChange(star)}
                      >
                        <Star
                          className={cn(
                            "h-6 w-6",
                            star <= field.value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                          )}
                        />
                      </Button>
                    ))}
                  </div>
                )}
              />
              <span className="ml-2 text-sm">
                {watch('rating') === 0 ? 'Select a rating' : `${watch('rating')} out of 5`}
              </span>
            </div>
            {errors.rating && (
              <p className="text-red-500 text-xs">{errors.rating.message?.toString()}</p>
            )}
          </div>
          
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Add Image (optional)</Label>
            <div className="flex items-center gap-4">
              <div>
                <Input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageUploadChange}
                  className="hidden"
                />
                <Label
                  htmlFor="image"
                  className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {isUploading ? "Uploading..." : "Choose File"}
                </Label>
              </div>
              
              {selectedImage && (
                <div className="relative h-16 w-16">
                  <img
                    src={selectedImage}
                    alt="Preview"
                    className="h-full w-full object-cover rounded"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gray-800/80 text-white hover:bg-gray-900"
                    onClick={() => {
                      setValue('image_url', '');
                      setSelectedImage(null);
                    }}
                  >
                    ×
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-3 gap-2"
                >
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public">Public</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                    <RadioGroupItem value="circle_only" id="circle" />
                    <Label htmlFor="circle">Circle Only</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                    <RadioGroupItem value="private" id="private" />
                    <Label htmlFor="private">Private</Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>
          
          {/* Form Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading}
              className="bg-brand-orange hover:bg-brand-orange/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Updating..." : "Saving..."}
                </>
              ) : (
                isEditMode ? "Update Review" : "Save Review"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;
