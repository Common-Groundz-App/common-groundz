
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, Calendar, Tag as TagIcon, Plus, Clock, Camera } from "lucide-react";
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
import { Badge } from '@/components/ui/badge';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const experienceDate = watch('experience_date');
  const [newFoodTag, setNewFoodTag] = useState('');
  const [foodTags, setFoodTags] = useState<string[]>(review?.metadata?.food_tags || []);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [showEntitySearch, setShowEntitySearch] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const commonFoodTags = ["Spicy", "Sweet", "Savory", "Vegetarian", "Vegan", "Gluten-Free", 
                          "Dairy-Free", "Non-Veg", "Dessert", "Breakfast", "Lunch", "Dinner", 
                          "Appetizer", "Main Course", "Large Portion", "Value for Money"];

  // Time period options for when you experienced this
  const timePeriods = [
    { label: "Today", value: new Date() },
    { label: "Yesterday", value: new Date(Date.now() - 86400000) },
    { label: "Last week", value: new Date(Date.now() - 7 * 86400000) },
    { label: "Last month", value: new Date(Date.now() - 30 * 86400000) },
  ];

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

  const addFoodTag = () => {
    if (newFoodTag.trim() && !foodTags.includes(newFoodTag.trim())) {
      setFoodTags([...foodTags, newFoodTag.trim()]);
      setNewFoodTag('');
    }
  };

  const addCommonTag = (tag: string) => {
    if (!foodTags.includes(tag)) {
      setFoodTags([...foodTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setFoodTags(foodTags.filter(t => t !== tag));
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <span>{getCategoryEmoji()}</span>
            <span>{isEditMode ? 'Edit your review' : `What did you think of this ${selectedCategory}?`}</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          {/* Rating Stars - Moved to top and made bigger */}
          <div className="space-y-2">
            <div className="flex flex-col items-center p-4 rounded-xl bg-accent/20">
              <p className="text-center mb-3 text-lg font-medium">How would you rate it?</p>
              <Controller
                name="rating"
                control={control}
                rules={{ required: "Please give a rating" }}
                render={({ field }) => (
                  <div className="flex items-center justify-center mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button
                        type="button"
                        key={star}
                        variant="ghost"
                        className="p-1 hover:bg-transparent"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => field.onChange(star)}
                      >
                        <Star
                          className={cn(
                            "h-8 w-8 review-star",
                            (star <= (hoverRating || field.value)) 
                              ? "fill-brand-orange text-brand-orange" 
                              : "text-gray-300 dark:text-gray-600"
                          )}
                        />
                      </Button>
                    ))}
                  </div>
                )}
              />
              <span className="text-sm text-muted-foreground">
                {watch('rating') === 0 
                  ? "Tap to rate" 
                  : watch('rating') === 5 
                    ? "Loved it!" 
                    : watch('rating') === 4 
                      ? "Really good" 
                      : watch('rating') === 3 
                        ? "It's okay" 
                        : watch('rating') === 2 
                          ? "Not great" 
                          : "Didn't like it"}
              </span>
              {errors.rating && (
                <p className="text-destructive text-sm mt-1">{errors.rating.message?.toString()}</p>
              )}
            </div>
          </div>
          
          {/* Category Selection */}
          <div className="grid grid-cols-5 gap-2">
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <>
                  {['food', 'movie', 'book', 'place', 'product'].map((category) => (
                    <Button
                      key={category}
                      type="button"
                      variant={field.value === category ? "default" : "outline"}
                      className={cn(
                        "flex flex-col items-center justify-center h-20 gap-1 p-2",
                        field.value === category ? "bg-brand-orange text-white" : "",
                        "transition-all duration-200 hover:scale-105"
                      )}
                      onClick={() => {
                        field.onChange(category);
                        setSelectedEntity(null);
                        setShowEntitySearch(false);
                        setValue('entity_id', '');
                      }}
                    >
                      <span className="text-lg">
                        {category === 'food' ? '🍽️' : 
                         category === 'movie' ? '🎬' : 
                         category === 'book' ? '📚' : 
                         category === 'place' ? '📍' : '🛍️'}
                      </span>
                      <span className="capitalize text-xs">{category}</span>
                    </Button>
                  ))}
                </>
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
                <div className="space-y-2 p-4 border border-dashed border-muted-foreground/30 rounded-lg">
                  <Label className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-brand-orange" />
                    <span>Search for {selectedCategory}</span>
                  </Label>
                  <EntitySearch 
                    type={selectedCategory as any}
                    onSelect={handleEntitySelect}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Can't find what you're looking for? You can just type the details below
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
                <div className="space-y-2 p-4 border border-dashed border-muted-foreground/30 rounded-lg">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand-orange" />
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Or just type the restaurant name below
                  </p>
                </div>
              )}
            </>
          )}
          
          {/* When did you experience this? */}
          <div className="flex flex-col space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-orange" />
              <span>When did you experience this?</span>
            </Label>
            
            <div className="grid grid-cols-4 gap-2 mb-2">
              {timePeriods.map((period) => (
                <Button
                  key={period.label}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto py-2 px-3",
                    experienceDate && format(experienceDate, 'yyyy-MM-dd') === format(period.value, 'yyyy-MM-dd')
                      ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange"
                      : ""
                  )}
                  onClick={() => {
                    setValue('experience_date', period.value);
                  }}
                >
                  {period.label}
                </Button>
              ))}
            </div>
            
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
                        "w-full justify-start text-left font-normal border-brand-orange/30 focus:ring-brand-orange/30",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-brand-orange" />
                      {field.value ? format(field.value, "PPP") : "Or pick a specific date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 pointer-events-auto" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-5">
            {/* Left Column */}
            <div className="space-y-5">
              {/* What did you have? / Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center gap-2">
                  {selectedCategory === 'food' ? (
                    <>
                      <span className="text-lg">🍴</span>
                      <span>What did you eat?</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{getCategoryEmoji()}</span>
                      <span>Name</span>
                    </>
                  )}
                </Label>
                <Input 
                  id="title"
                  {...register('title', { required: "Required" })}
                  placeholder={selectedCategory === 'food' ? "E.g. Pad Thai, Cheeseburger..." : "Title"}
                  className={cn(errors.title ? "border-red-500" : "border-brand-orange/30 focus:ring-brand-orange/30")}
                />
                {errors.title && (
                  <p className="text-red-500 text-xs">{errors.title.message?.toString()}</p>
                )}
              </div>
              
              {/* Location/Venue */}
              <div className="space-y-2">
                <Label htmlFor="venue" className="flex items-center gap-2">
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
                  className="border-brand-orange/30 focus:ring-brand-orange/30"
                />
              </div>
              
              {/* Food tags if category is food */}
              {selectedCategory === 'food' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-brand-orange" />
                    <span>Add tags</span>
                  </Label>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {commonFoodTags.map((tag) => (
                      <Badge 
                        key={tag}
                        variant="outline" 
                        className={cn(
                          "cursor-pointer hover:bg-brand-orange/10 transition-colors review-tag",
                          foodTags.includes(tag) ? "bg-brand-orange/20 border-brand-orange/40" : ""
                        )}
                        onClick={() => foodTags.includes(tag) ? removeTag(tag) : addCommonTag(tag)}
                      >
                        {tag}
                        {foodTags.includes(tag) && (
                          <span className="ml-1 text-xs cursor-pointer">×</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newFoodTag}
                      onChange={(e) => setNewFoodTag(e.target.value)}
                      placeholder="Add a custom tag"
                      className="border-brand-orange/30 focus:ring-brand-orange/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addFoodTag();
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={addFoodTag}
                      variant="outline"
                      className="border-brand-orange/30 hover:bg-brand-orange/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Right Column */}
            <div className="space-y-5">
              {/* Add Photo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-brand-orange" />
                  <span>Add a photo</span>
                </Label>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-brand-orange/30 rounded-lg p-4 review-image-upload">
                  {selectedImage ? (
                    <div className="relative w-full h-40">
                      <img
                        src={selectedImage}
                        alt="Preview"
                        className="h-full w-full object-cover rounded-md mx-auto"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gray-800/80 text-white hover:bg-gray-900"
                        onClick={() => {
                          setValue('image_url', '');
                          setSelectedImage(null);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={handleImageUploadChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="image"
                        className="cursor-pointer flex flex-col items-center text-muted-foreground"
                      >
                        <Camera className="h-12 w-12 mb-2 text-brand-orange/50" />
                        <span className="text-sm">{isUploading ? "Uploading..." : "Tap to add photo"}</span>
                        <span className="text-xs mt-1">Share your experience visually</span>
                      </Label>
                    </>
                  )}
                </div>
              </div>
              
              {/* Your Review */}
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <span>Your thoughts? (optional)</span>
                </Label>
                <Textarea 
                  id="description"
                  {...register('description')}
                  placeholder="Tell us what you liked or didn't like..."
                  rows={4}
                  className="border-brand-orange/30 focus:ring-brand-orange/30 resize-none"
                />
              </div>
              
              {/* Visibility */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
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
                      <div className="flex flex-col items-center space-y-1 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="public" id="public" className="text-brand-orange" />
                        <Label htmlFor="public" className="cursor-pointer text-xs">Everyone</Label>
                      </div>
                      <div className="flex flex-col items-center space-y-1 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
                        <Label htmlFor="circle" className="cursor-pointer text-xs">My Circle</Label>
                      </div>
                      <div className="flex flex-col items-center space-y-1 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
                        <RadioGroupItem value="private" id="private" className="text-brand-orange" />
                        <Label htmlFor="private" className="cursor-pointer text-xs">Just Me</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}
                    className="border-brand-orange/30 hover:text-brand-orange">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Saving changes..." : "Share review"}
                </>
              ) : (
                isEditMode ? "Save changes" : "Share review"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;
