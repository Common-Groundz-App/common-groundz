
import React, { useState, ChangeEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import EntitySearch from '@/components/recommendations/EntitySearch';
import { Entity } from '@/services/recommendation/types';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import { Book, Clapperboard, MapPin, ShoppingBag, Navigation } from 'lucide-react';
import ImageUploader from '@/components/profile/reviews/ImageUploader';
import { ensureHttps } from '@/utils/urlUtils';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/use-geolocation';
import { LocationAccessPrompt } from '@/components/profile/reviews/LocationAccessPrompt';

interface StepThreeProps {
  category: string;
  title: string;
  onTitleChange: (value: string) => void;
  venue: string;
  onVenueChange: (value: string) => void;
  entityId: string;
  onEntitySelect: (entity: Entity) => void;
  selectedEntity: Entity | null;
  selectedImage: string | null;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onImageRemove: () => void;
  isUploading: boolean;
}

const StepThree = ({ 
  category,
  title,
  onTitleChange,
  venue,
  onVenueChange,
  entityId,
  onEntitySelect,
  selectedEntity,
  selectedImage,
  onImageChange,
  onImageRemove,
  isUploading
}: StepThreeProps) => {
  const [showEntitySearch, setShowEntitySearch] = useState(!selectedEntity);
  const [processedEntity, setProcessedEntity] = useState<Entity | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  
  const { 
    position, 
    isLoading: geoLoading, 
    permissionStatus 
  } = useGeolocation();
  
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
  
  const getCategoryIcon = () => {
    switch(category) {
      case 'food': return <MapPin className="h-5 w-5 text-brand-orange" />;
      case 'movie': return <Clapperboard className="h-5 w-5 text-brand-orange" />;
      case 'book': return <Book className="h-5 w-5 text-brand-orange" />;
      case 'place': return <MapPin className="h-5 w-5 text-brand-orange" />;
      case 'product': return <ShoppingBag className="h-5 w-5 text-brand-orange" />;
      default: return <MapPin className="h-5 w-5 text-brand-orange" />;
    }
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
  
  const getEntitySearchType = () => {
    switch(category) {
      case 'food': return "place";
      case 'movie': return "movie";
      case 'book': return "book";
      case 'place': return "place";
      case 'product': return "product";
      default: return "place";
    }
  };
  
  // New function to get appropriate search label
  const getSearchLabel = () => {
    if(category === 'food') {
      return "place"; // Show "Search for place" instead of "Search for food"
    }
    return category;
  };
  
  // Handler for selecting an entity from search
  const handleEntitySelection = (entity: Entity) => {
    console.log("Selected entity in StepThree:", entity);
    
    // Process the image URL if it exists
    if (entity.image_url) {
      console.log("Entity image URL before processing:", entity.image_url);
      entity.image_url = ensureHttps(entity.image_url);
      console.log("Entity image URL after processing:", entity.image_url);
    } else {
      console.log("Selected entity has no image URL");
    }
    
    // Pass the entity to parent component
    onEntitySelect(entity);
    
    // For food category, explicitly handle restaurant name vs address
    if (category === 'food') {
      console.log("Food category: Setting venue to entity name", entity.name);
      
      // IMPORTANT: When it's food category and Google Places result, 
      // always use the name for the venue (restaurant name)
      if (entity.api_source === 'google_places') {
        onVenueChange(entity.name);
      } else {
        // For non-Google Places sources, fall back to venue or name
        onVenueChange(entity.venue || entity.name || '');
      }
      
      // Do not update title for food category
    } else {
      // For other categories, update title with entity name
      onTitleChange(entity.name);
      
      // Update venue if available
      if (entity.venue) {
        onVenueChange(entity.venue);
      }
    }
    
    setShowEntitySearch(false);
  };
  
  // Show location prompt for place or food categories if permission not already granted
  const isLocationRelevantCategory = category === 'place' || category === 'food';
  
  return (
    <div className="w-full space-y-8 py-2">
      <h2 className="text-xl font-medium text-center">
        Tell us about your {category}
      </h2>
      
      {/* Location prompt - show only for place/food categories */}
      {isLocationRelevantCategory && showLocationPrompt && (
        <LocationAccessPrompt 
          onCancel={() => setShowLocationPrompt(false)}
          className="mb-8"
        />
      )}
      
      {/* Entity search/preview */}
      {selectedEntity && processedEntity && !showEntitySearch ? (
        <EntityPreviewCard
          entity={processedEntity}
          type={category}
          onChange={() => setShowEntitySearch(true)}
        />
      ) : (
        <div className="p-4 border border-dashed border-brand-orange/30 rounded-lg bg-gradient-to-b from-transparent to-accent/5 transition-all duration-300 hover:border-brand-orange/50">
          <div className="flex justify-between items-center mb-2">
            <Label className="flex items-center gap-2 font-medium">
              <span className="p-1.5 rounded-full bg-brand-orange/10">
                {getCategoryIcon()}
              </span>
              <span>Search for {getSearchLabel()}</span>
            </Label>
            
            {/* Show location button for relevant categories */}
            {isLocationRelevantCategory && !showLocationPrompt && !permissionStatus && (
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-xs"
                onClick={() => setShowLocationPrompt(true)}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Use my location</span>
              </Button>
            )}
          </div>
          
          <EntitySearch 
            type={getEntitySearchType() as any}
            onSelect={handleEntitySelection}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            Can't find what you're looking for? Just fill in the details below
          </p>
        </div>
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
            className={cn(
              !title ? "border-red-500" : "border-brand-orange/30 focus-visible:ring-brand-orange/30",
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
      
      {/* Photo upload */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">📸</span>
          <span>Add a photo</span>
        </Label>
        <ImageUploader
          selectedImage={selectedImage}
          onChange={onImageChange}
          onRemove={onImageRemove}
          isUploading={isUploading}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {selectedImage ? "Click × to remove this photo" : "Upload a photo of your experience"}
        </p>
      </div>
    </div>
  );
};

export default StepThree;
