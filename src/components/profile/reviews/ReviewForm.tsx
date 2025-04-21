import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, Calendar, Tag as TagIcon, Plus } from "lucide-react";
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

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  review?: Review;
  isEditMode?: boolean;
}

const EntityPreviewBox = ({ entity, type, onChange }: { entity: any; type: string; onChange: () => void }) => {
  if (!entity) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{`Selected ${type}:`}</span>
        <button
          type="button"
          className="text-sm px-2 py-1 border rounded hover:bg-gray-100 focus:outline-none"
          onClick={onChange}
        >
          Change
        </button>
      </div>
      <div className="flex border rounded-lg bg-white p-2 items-center max-w-lg shadow-sm overflow-hidden">
        {entity.image_url && (
          <img
            src={entity.image_url}
            alt={entity.name || 'Preview'}
            className="w-12 h-12 object-cover rounded mr-3 flex-shrink-0 bg-gray-100"
          />
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate break-words">{entity.name || entity.title}</div>
          {entity.description && (
            <div className="text-xs text-gray-600 mt-1 truncate break-words">{entity.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

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

  const commonFoodTags = ["Spicy", "Sweet", "Savory", "Vegetarian", "Vegan", "Gluten-Free", 
                          "Dairy-Free", "Non-Veg", "Dessert", "Breakfast", "Lunch", "Dinner", 
                          "Appetizer", "Main Course", "Large Portion", "Value for Money"];

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
                  onValueChange={(val) => {
                    field.onChange(val);
                    setSelectedEntity(null);
                    setShowEntitySearch(false);
                    setValue('entity_id', '');
                  }}
                  value={field.value}
                >
                  <SelectTrigger className="border-brand-orange/30 focus:ring-brand-orange/30">
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
          
          {/* Entity selection/preview */}
          {['movie', 'book', 'place', 'product'].includes(selectedCategory) && !isEditMode && (
            <>
              {selectedEntity && !showEntitySearch ? (
                <EntityPreviewBox
                  entity={selectedEntity}
                  type={selectedCategory}
                  onChange={() => {
                    setShowEntitySearch(true);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <Label>Search for {selectedCategory}</Label>
                  <EntitySearch 
                    type={selectedCategory as any}
                    onSelect={handleEntitySelect}
                  />
                </div>
              )}
            </>
          )}

          {/* For Food category, we'll let users search for restaurant using Places API */}
          {!isEditMode && selectedCategory === 'food' && (
            <>
              {selectedEntity && !showEntitySearch ? (
                <EntityPreviewBox
                  entity={selectedEntity}
                  type="food"
                  onChange={() => {
                    setShowEntitySearch(true);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <Label>Search for restaurant</Label>
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
                    Search for the restaurant or place where you had this food
                  </p>
                </div>
              )}
            </>
          )}
          
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
                        "w-full justify-start text-left font-normal border-brand-orange/30 focus:ring-brand-orange/30",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-brand-orange" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
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
          
          <div className="space-y-2">
            <Label htmlFor="title">
              {selectedCategory === 'food' ? 'Dish Name' : 'Title'}
            </Label>
            <Input 
              id="title"
              {...register('title', { required: "Title is required" })}
              placeholder={selectedCategory === 'food' ? "What dish did you have?" : "What are you reviewing?"}
              className={cn(errors.title ? "border-red-500" : "border-brand-orange/30 focus:ring-brand-orange/30")}
            />
            {errors.title && (
              <p className="text-red-500 text-xs">{errors.title.message?.toString()}</p>
            )}
          </div>
          
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
              className="border-brand-orange/30 focus:ring-brand-orange/30"
            />
          </div>
          
          {/* Add food tags section */}
          {selectedCategory === 'food' && (
            <div className="space-y-2">
              <Label>Add Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {foodTags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary"
                    className="flex items-center gap-1 bg-brand-orange/20"
                  >
                    {tag}
                    <button 
                      type="button"
                      className="ml-1 hover:text-red-500 focus:outline-none"
                      onClick={() => removeTag(tag)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={newFoodTag}
                  onChange={(e) => setNewFoodTag(e.target.value)}
                  placeholder="Add a tag (e.g., Spicy, Vegan)"
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
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Common tags:</p>
                <div className="flex flex-wrap gap-1">
                  {commonFoodTags.map((tag) => (
                    <Badge 
                      key={tag}
                      variant="outline" 
                      className={cn(
                        "cursor-pointer hover:bg-brand-orange/10 transition-colors",
                        foodTags.includes(tag) ? "bg-brand-orange/20" : ""
                      )}
                      onClick={() => addCommonTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="description">Review (optional)</Label>
            <Textarea 
              id="description"
              {...register('description')}
              placeholder="Share your honest thoughts and experience..."
              rows={3}
              className="border-brand-orange/30 focus:ring-brand-orange/30"
            />
          </div>
          
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
                            star <= field.value ? "fill-brand-orange text-brand-orange" : "text-gray-300"
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
                  className="cursor-pointer inline-flex items-center px-3 py-2 border border-brand-orange/30 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange"
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
                  <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
                    <RadioGroupItem value="public" id="public" className="text-brand-orange" />
                    <Label htmlFor="public">Public</Label>
                  </div>
                  <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
                    <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
                    <Label htmlFor="circle">Circle Only</Label>
                  </div>
                  <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
                    <RadioGroupItem value="private" id="private" className="text-brand-orange" />
                    <Label htmlFor="private">Private</Label>
                  </div>
                </RadioGroup>
              )}
            />
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
