
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Entity } from '@/services/recommendation/types';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';

import { useLocation } from '@/contexts/LocationContext';
import { LocationAccessPrompt } from '@/components/profile/reviews/LocationAccessPrompt';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';
import { v4 as uuidv4 } from 'uuid';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';

interface StepThreeProps {
  category: string;
  title: string;
  onTitleChange: (value: string) => void;
  venue: string;
  onVenueChange: (value: string) => void;
  selectedEntity: Entity | null;
  selectedMedia: MediaItem[];
  onMediaAdd: (media: MediaItem) => void;
  onMediaRemove: (mediaUrl: string) => void;
  isUploading: boolean;
  disableEntityFields?: boolean; // Prop to disable entity field editing
}

const StepThree = ({ 
  category,
  title,
  onTitleChange,
  venue,
  onVenueChange,
  selectedEntity,
  selectedMedia,
  onMediaAdd,
  onMediaRemove,
  isUploading,
  disableEntityFields = false // Default to false for backward compatibility
}: StepThreeProps) => {
  const [processedEntity, setProcessedEntity] = useState<Entity | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  
  const { 
    position,
    isLoading: geoLoading,
    permissionStatus,
    locationEnabled,
    enableLocation
  } = useLocation();
  
  // Process selected entity to ensure it has valid fields for display
  useEffect(() => {
    if (selectedEntity) {
      console.log("StepThree: Processing selected entity:", selectedEntity);
      
      // Create a processed copy of the entity with validated fields
      const processed = { ...selectedEntity };
      
      // Ensure the image_url uses HTTPS if it exists
      if (processed.image_url) {
        console.log("Entity has image_url before processing:", processed.image_url);
        processed.image_url = ensureHttps(processed.image_url);
        console.log("Entity has image_url after processing:", processed.image_url);
      } else {
        console.log("Entity missing image_url");
      }
      
      setProcessedEntity(processed);
    }
  }, [selectedEntity]);

  // Check if we should show the location prompt
  useEffect(() => {
    const isLocationRelevantCategory = category === 'place' || category === 'food';
    const locationNotSetUp = !locationEnabled && permissionStatus !== 'granted';
    
    if (isLocationRelevantCategory && locationNotSetUp) {
      // Different handling based on whether user has actively skipped before
      const lastPromptTime = localStorage.getItem('locationPromptLastShown');
      const lastSkippedTime = localStorage.getItem('locationPromptLastSkipped');
      const currentTime = Date.now();
      
      // Define timeouts - 24 hours for normal display, 2 hours if explicitly skipped
      const normalTimeout = 24 * 60 * 60 * 1000; // 24 hours
      const skippedTimeout = 2 * 60 * 60 * 1000; // 2 hours
      
      // If the user explicitly skipped before, use shorter timeout
      if (lastSkippedTime) {
        if ((currentTime - parseInt(lastSkippedTime)) > skippedTimeout) {
          setShowLocationPrompt(true);
        }
      } 
      // Otherwise use normal timeout (or show immediately if never shown before)
      else if (!lastPromptTime || (currentTime - parseInt(lastPromptTime)) > normalTimeout) {
        setShowLocationPrompt(true);
      }
      
      // Always track that we've shown the prompt
      if (showLocationPrompt) {
        localStorage.setItem('locationPromptLastShown', currentTime.toString());
      }
    }
  }, [category, permissionStatus, locationEnabled]);
  
  // Handle when user explicitly skips the location prompt
  const handleSkipLocationPrompt = () => {
    setShowLocationPrompt(false);
    localStorage.setItem('locationPromptLastSkipped', Date.now().toString());
  };
  
  const getMainFieldLabel = () => {
    switch(category) {
      case 'food': return "What did you eat?";
      case 'movie': return "Movie title";
      case 'book': return "Book title";
      case 'place': return "Place name";
      case 'product': return "Product name";
      default: return "Title";
    }
  };
  
  const getSecondaryFieldLabel = () => {
    switch(category) {
      case 'food': return "Restaurant name";
      case 'movie': return "Director/Studio";
      case 'book': return "Author/Publisher";
      case 'place': return "Location";
      case 'product': return "Brand";
      default: return "Venue";
    }
  };
  
  // Get location button state
  const getLocationButtonState = () => {
    if (geoLoading) return { text: "Getting location...", disabled: true };
    if (locationEnabled && position) return { text: "Location enabled", disabled: true };
    if (permissionStatus === 'denied') return { text: "Access denied", disabled: true };
    return { text: "Use my location", disabled: false };
  };
  
  const buttonState = getLocationButtonState();
  
  // Show location prompt for place or food categories if permission not already granted
  const isLocationRelevantCategory = category === 'place' || category === 'food';
  
  // Helper function to ensure HTTPS urls
  const ensureHttps = (url: string): string => {
    if (!url) return url;
    return url.replace(/^http:\/\//i, 'https://');
  };
  
  // Handle media uploaded
  const handleMediaUploaded = (media: MediaItem) => {
    onMediaAdd(media);
  };
  
  // Handle media removal
  const handleRemoveMedia = (mediaUrl: string) => {
    onMediaRemove(mediaUrl);
  };

  const MAX_MEDIA_COUNT = 4;
  
  return (
    <div className="w-full space-y-8 py-2">
      <h2 className="text-xl font-medium text-center">
        Tell us about your {category}
      </h2>
      
      {/* Location prompt - show only for place/food categories */}
      {isLocationRelevantCategory && showLocationPrompt && (
        <LocationAccessPrompt 
          onCancel={handleSkipLocationPrompt}
          className="mb-8"
        />
      )}
      
      {/* Subject preview — read-only. The subject is chosen once in Step 2;
          Step 3 only shows what this review is about. */}
      {selectedEntity && processedEntity && (
        <EntityPreviewCard
          entity={processedEntity}
          type={category}
          onChange={() => { /* subject changes happen in Step 2 only */ }}
          disableChange
        />
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Main Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            <span className="text-lg">{category === 'food' ? '🍴' : category === 'movie' ? '🎬' : category === 'book' ? '📚' : category === 'place' ? '🏛️' : '🛍️'}</span>
            <span>{getMainFieldLabel()}</span>
          </Label>
          <Input 
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={`Name of the ${category}`}
            readOnly={disableEntityFields && !!selectedEntity}
            className={cn(
              !title ? "border-red-500" : "border-brand-orange/30 focus-visible:ring-brand-orange/30",
              disableEntityFields && !!selectedEntity && "bg-muted/50 text-muted-foreground cursor-not-allowed",
              "transition-all duration-200"
            )}
          />
          {!title && (
            <p className="text-red-500 text-xs">This field is required</p>
          )}
        </div>
        
        {/* Venue/Location Field */}
        <div className="space-y-2">
          <Label htmlFor="venue" className="flex items-center gap-2">
            <span className="text-lg">{category === 'food' ? '🏠' : category === 'movie' ? '🎬' : category === 'book' ? '✍️' : category === 'place' ? '📍' : '🏢'}</span>
            <span>{getSecondaryFieldLabel()}</span>
          </Label>
          <Input 
            id="venue"
            value={venue}
            onChange={(e) => onVenueChange(e.target.value)}
            placeholder={
              category === 'food' ? "Restaurant name" : 
              category === 'movie' ? "Who made this movie?" : 
              category === 'book' ? "Who wrote this book?" : 
              category === 'place' ? "Address or location" : "Who makes this product?"
            }
            className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
          />
        </div>
      </div>
      
      {/* Media Preview Section */}
      {selectedMedia.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            <span className="text-lg">🖼️</span>
            <span>Your media ({selectedMedia.length}/{MAX_MEDIA_COUNT})</span>
          </Label>
          <CompactMediaGrid
            media={selectedMedia}
            onRemove={(media) => handleRemoveMedia(media.url)}
            maxVisible={MAX_MEDIA_COUNT}
            className="group"
          />
        </div>
      )}
      
      {/* Media upload section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">📸</span>
          <span>Add photos & videos</span>
        </Label>
        <MediaUploader
          sessionId={uuidv4()}
          onMediaUploaded={handleMediaUploaded}
          initialMedia={selectedMedia}
          className="w-full"
          maxMediaCount={MAX_MEDIA_COUNT}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {selectedMedia.length > 0 
            ? `${selectedMedia.length}/${MAX_MEDIA_COUNT} media items added - Add photos or videos to make your review stand out`
            : "Add photos or videos to make your review stand out"
          }
        </p>
      </div>
    </div>
  );
};

export default StepThree;
