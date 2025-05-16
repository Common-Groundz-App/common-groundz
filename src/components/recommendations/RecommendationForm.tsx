
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, Camera, MapPin, Tag as TagIcon, Clapperboard, Book, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import EntitySearch from './EntitySearch';
import { RecommendationVisibility, Recommendation } from '@/services/recommendationService';
import ConnectedRingsRating from './ConnectedRingsRating';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { EntityTypeString } from '@/hooks/feed/api/types';

// String literal type for category fields in forms
type CategoryString = 'food' | 'movie' | 'book' | 'place' | 'product';

// Define the entity type for the form
interface EntityData {
  id: string;
  name: string;
  type: string;
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

interface RecommendationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
  onImageUpload: (file: File) => Promise<string | null>;
  recommendation?: Recommendation; // For edit mode
  isEditMode?: boolean;
  entity?: EntityData; // Add this new prop to pre-populate entity data
}

const RecommendationForm = ({
  isOpen,
  onClose,
  onSubmit,
  onImageUpload,
  recommendation,
  isEditMode = false,
  entity // New prop
}: RecommendationFormProps) => {
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: {
      title: recommendation?.title || entity?.name || '',
      venue: recommendation?.venue || entity?.venue || '',
      description: recommendation?.description || entity?.description || '',
      rating: recommendation?.rating || 0,
      image_url: recommendation?.image_url || entity?.image_url || '',
      category: (recommendation?.category || (entity?.type as CategoryString) || 'food').toLowerCase() as CategoryString, 
      visibility: recommendation?.visibility || 'public' as RecommendationVisibility,
      entity_id: recommendation?.entity_id || entity?.id || '',
    }
  });
  
  // Add exit confirmation state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const selectedCategory = watch('category');
  const [selectedImage, setSelectedImage] = useState<string | null>(recommendation?.image_url || entity?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState<any>(entity || null);
  
  // Check for unsaved changes
  useEffect(() => {
    if (isOpen) {
      setHasUnsavedChanges(isDirty || selectedImage !== (recommendation?.image_url || entity?.image_url || null));
    } else {
      setHasUnsavedChanges(false);
    }
  }, [isOpen, isDirty, selectedImage, recommendation, entity]);
  
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
      if (!isEditMode) {
        reset();
        setSelectedImage(null);
        setSelectedEntity(entity || null);
      }
    }
  }, [isOpen, reset, isEditMode, entity]);
  
  // Set form values when in edit mode or entity changes
  useEffect(() => {
    if (isEditMode && recommendation) {
      setValue('title', recommendation.title);
      setValue('venue', recommendation.venue || '');
      setValue('description', recommendation.description || '');
      setValue('rating', recommendation.rating);
      setValue('image_url', recommendation.image_url || '');
      setValue('category', (recommendation.category || 'food').toLowerCase() as CategoryString);
      setValue('visibility', recommendation.visibility);
      setValue('entity_id', recommendation.entity_id || '');
      setSelectedImage(recommendation.image_url || null);
    } else if (entity && !isEditMode && isOpen) {
      setValue('title', entity.name);
      
      // For place type with Google Places metadata, use formatted_address as venue
      if (entity.type.toLowerCase() === 'place' && entity.metadata?.formatted_address) {
        setValue('venue', entity.metadata.formatted_address);
      } else if (entity.type.toLowerCase() === 'food') {
        // For food type, use entity name as venue (restaurant name)
        setValue('venue', entity.name);
      } else {
        // For other types, use venue field if available
        setValue('venue', entity.venue || '');
      }
      
      setValue('description', entity.description || '');
      setValue('image_url', entity.image_url || '');
      setValue('category', (entity.type as CategoryString) || 'food');
      setValue('entity_id', entity.id);
      setSelectedImage(entity.image_url || null);
      setSelectedEntity(entity);
    }
  }, [recommendation, entity, isEditMode, setValue, isOpen]);
  
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmation(true);
    } else {
      onClose();
    }
  };
  
  const handleConfirmExit = () => {
    setShowExitConfirmation(false);
    reset();
    setSelectedImage(null);
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
    setHasUnsavedChanges(false);
    if (!isEditMode) {
      reset();
      setSelectedImage(null);
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch(category) {
      case 'food': return '🍽️';
      case 'movie': return '🎬';
      case 'book': return '📚';
      case 'place': return '📍';
      case 'product': return '🛍️';
      default: return '✨';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'food': return <MapPin className="h-5 w-5" />;
      case 'movie': return <Clapperboard className="h-5 w-5" />;
      case 'book': return <Book className="h-5 w-5" />;
      case 'place': return <MapPin className="h-5 w-5" />;
      case 'product': return <ShoppingBag className="h-5 w-5" />;
      default: return <TagIcon className="h-5 w-5" />;
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {/* Separate emoji from text so emoji retains original color */}
              <span className="text-inherit">{getCategoryEmoji(selectedCategory)}</span>
              <span className="bg-gradient-to-r from-brand-orange to-brand-orange/80 bg-clip-text text-transparent">
                {isEditMode ? 'Edit recommendation' : 'Share a recommendation'}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
            {/* Rating - Use our new connected rings component */}
            <div className="space-y-2">
              <div className="flex flex-col items-center p-4 rounded-xl bg-accent/20">
                <p className="text-center mb-3 text-lg font-medium">How would you rate it?</p>
                <Controller
                  name="rating"
                  control={control}
                  rules={{ required: "Please give a rating" }}
                  render={({ field }) => (
                    <ConnectedRingsRating
                      value={field.value}
                      onChange={field.onChange}
                      size="md"
                      showValue={true}
                      isInteractive={true}
                      showLabel={true}
                      className="transition-all duration-300"
                    />
                  )}
                />
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
                        onClick={() => field.onChange(category)}
                      >
                        <span className="text-lg">{getCategoryEmoji(category)}</span>
                        <span className="capitalize text-xs">{category}</span>
                      </Button>
                    ))}
                  </>
                )}
              />
            </div>
            
            {/* Entity search - Hide if entity is already selected */}
            {!isEditMode && !selectedEntity && (
              <div className="space-y-2 p-4 border border-dashed border-muted-foreground/30 rounded-lg">
                <Label className="flex items-center gap-2">
                  {getCategoryIcon(selectedCategory)}
                  <span>Search for {selectedCategory}</span>
                </Label>
                <EntitySearch 
                  type={selectedCategory as EntityTypeString}
                  onSelect={(entity) => {
                    setValue('title', entity.name);
                    setValue('entity_id', entity.id);
                    
                    // Updated logic for handling place categories
                    if (selectedCategory === 'place' && entity.api_source === 'google_places' && entity.metadata?.formatted_address) {
                      setValue('venue', entity.metadata.formatted_address);
                    } else if (selectedCategory === 'food' && entity.api_source === 'google_places') {
                      // For food category from Google Places, use name as venue
                      setValue('venue', entity.name);
                    } else if (entity.venue) {
                      setValue('venue', entity.venue);
                    }
                    
                    if (entity.description) setValue('description', entity.description);
                    setSelectedEntity(entity);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Can't find what you're looking for? You can just type the details below
                </p>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-5">
              {/* Left Column */}
              <div className="space-y-5">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryEmoji(selectedCategory)}</span>
                    <span>What are you recommending?</span>
                  </Label>
                  <Input 
                    id="title"
                    {...register('title', { required: "Title is required" })}
                    placeholder={`Name of the ${selectedCategory}`}
                    className={cn(errors.title ? "border-red-500" : "border-brand-orange/30 focus:ring-brand-orange/30")}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-xs">{errors.title.message?.toString()}</p>
                  )}
                </div>
                
                {/* Venue / Location */}
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
                      selectedCategory === 'food' ? "Where can people find this?" : 
                      selectedCategory === 'movie' ? "Who made this movie?" : 
                      selectedCategory === 'book' ? "Who wrote this book?" : 
                      selectedCategory === 'place' ? "Address or location" : "Who makes this product?"
                    }
                    className="border-brand-orange/30 focus:ring-brand-orange/30"
                  />
                </div>
                
                {/* Visibility */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="text-lg">👁️</span>
                    <span>Who can see this?</span>
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
              
              {/* Right Column */}
              <div className="space-y-5">
                {/* Add Photo - Updated with better messaging */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-brand-orange" />
                    <span>Add your own photo</span>
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
                          <span className="text-sm">{isUploading ? "Uploading..." : "Add your own photo"}</span>
                          <span className="text-xs mt-1">Share your personal experience with a photo</span>
                        </Label>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <span>Why do you recommend it?</span>
                  </Label>
                  <Textarea 
                    id="description"
                    {...register('description')}
                    placeholder="Tell others why they should try this..."
                    rows={5}
                    className="border-brand-orange/30 focus:ring-brand-orange/30 resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" type="button" onClick={handleClose} disabled={isSubmitting}
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
                    {isEditMode ? "Saving changes..." : "Share recommendation"}
                  </>
                ) : (
                  isEditMode ? "Save changes" : "Share recommendation"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Exit Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showExitConfirmation}
        onClose={handleCancelExit}
        onConfirm={handleConfirmExit}
        title="Discard this recommendation?"
        description="Your changes will not be saved."
        isLoading={false}
      />
    </>
  );
};

export default RecommendationForm;
