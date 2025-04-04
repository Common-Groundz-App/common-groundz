
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import EntitySearch from './EntitySearch';
import { RecommendationCategory, RecommendationVisibility } from '@/services/recommendationService';

interface RecommendationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
  onImageUpload: (file: File) => Promise<string | null>;
}

const RecommendationForm = ({
  isOpen,
  onClose,
  onSubmit,
  onImageUpload
}: RecommendationFormProps) => {
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: '',
      venue: '',
      description: '',
      rating: 0,
      image_url: '',
      category: 'food' as RecommendationCategory,
      visibility: 'public' as RecommendationVisibility,
      entity_id: '',
    }
  });
  
  const selectedCategory = watch('category');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Listen for custom event to open the form
  useEffect(() => {
    const handleOpenForm = () => {
      // Find a way to programmatically open the dialog if needed
    };

    window.addEventListener('open-recommendation-form', handleOpenForm);
    
    return () => {
      window.removeEventListener('open-recommendation-form', handleOpenForm);
    };
  }, []);
  
  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      reset();
      setSelectedImage(null);
    }
  }, [isOpen, reset]);
  
  const handleImageUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const url = await onImageUpload(file);
      if (url) {
        setValue('image_url', url);
        setSelectedImage(url);
      }
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleFormSubmit = async (values: any) => {
    await onSubmit(values);
    reset();
    setSelectedImage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Recommendation</DialogTitle>
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
                  defaultValue={field.value}
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
          
          {(selectedCategory === 'movie' || selectedCategory === 'book' || 
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
          
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input 
              id="title"
              {...register('title', { required: "Title is required" })}
              placeholder={`What are you recommending?`}
              className={errors.title ? "border-red-500" : ""}
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
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea 
              id="description"
              {...register('description')}
              placeholder="Share your experience..."
              rows={3}
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
          
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  defaultValue={field.value}
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
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading}
              className="bg-brand-orange hover:bg-brand-orange/90"
            >
              {isSubmitting ? "Saving..." : "Save Recommendation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationForm;
