
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Review } from '@/services/reviewService';
import { Form } from '@/components/ui/form';
import EntitySearch from '@/components/recommendations/EntitySearch';

// Import our new components
import ReviewRating from './form/ReviewRating';
import ReviewVisibility from './form/ReviewVisibility';
import ReviewImageUpload from './form/ReviewImageUpload';
import ReviewFoodTags from './form/ReviewFoodTags';
import ReviewCategorySelect from './form/ReviewCategorySelect';
import ReviewDatePicker from './form/ReviewDatePicker';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import { useReviewForm } from '@/hooks/use-review-form';

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
  const {
    form,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
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
  } = useReviewForm({ review, isEditMode, onSuccess: onSubmit, onClose });

  function getEntityTypeLabel(entity: any | null): string {
    if (!entity) return "place";
    if ((entity as any).entity_type) return (entity as any).entity_type;
    if ((entity as any).category) return (entity as any).category;
    return "place";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Review' : 'Add New Review'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <ReviewCategorySelect 
              control={control} 
              onCategoryChange={handleCategoryChange} 
            />
            
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
                  <EntityPreviewCard
                    entity={selectedEntity}
                    type="food"
                    onChange={() => setShowEntitySearch(true)}
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
            
            <ReviewDatePicker 
              control={control}
              datePickerOpen={datePickerOpen}
              setDatePickerOpen={setDatePickerOpen}
            />
            
            <div className="space-y-2">
              <Label htmlFor="title">
                {selectedCategory === 'food' ? 'Dish Name' : 'Title'}
              </Label>
              <Input 
                id="title"
                {...form.register('title', { required: "Title is required" })}
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
                {...form.register('venue')}
                placeholder={`Where can this ${selectedCategory} be found?`}
                className="border-brand-orange/30 focus:ring-brand-orange/30"
              />
            </div>
            
            {/* Add food tags section */}
            {selectedCategory === 'food' && (
              <ReviewFoodTags 
                foodTags={foodTags}
                onAddTag={addFoodTag}
                onRemoveTag={removeFoodTag}
              />
            )}
            
            <div className="space-y-2">
              <Label htmlFor="description">Review (optional)</Label>
              <Textarea 
                id="description"
                {...form.register('description')}
                placeholder="Share your honest thoughts and experience..."
                rows={3}
                className="border-brand-orange/30 focus:ring-brand-orange/30"
              />
            </div>
            
            <ReviewRating control={control} watch={watch} errors={errors} />
            
            <ReviewImageUpload 
              selectedImage={selectedImage}
              isUploading={isUploading}
              handleImageUploadChange={handleImageUploadChange}
              onRemoveImage={() => {
                setValue('image_url', '');
              }}
            />
            
            <ReviewVisibility control={control} />
            
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
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;
