
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import EntitySearch from '@/components/recommendations/EntitySearch';

interface StepThreeProps {
  category: string;
  title: string;
  onTitleChange: (title: string) => void;
  venue: string;
  onVenueChange: (venue: string) => void;
  entityId: string;
  onEntitySelect: (entity: Entity) => void;
  selectedEntity: Entity | null;
  selectedImage: string | null;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  isUploading,
}: StepThreeProps) => {
  // Map category to a proper EntityType for the EntitySearch component
  const getEntityType = () => {
    switch (category) {
      case 'food': return 'food';
      case 'movie': return 'movie';
      case 'book': return 'book';
      case 'place': return 'place';
      case 'product': return 'product';
      default: return 'place';
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Find the {category} you're reviewing</Label>
          <EntitySearch 
            type={getEntityType()} 
            onSelect={onEntitySelect} 
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="title">Name</Label>
          <Input 
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={`${category === 'food' ? 'Dish name' : `${category} name`}`}
            className="bg-background"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="venue">
            {category === 'food' ? 'Restaurant name' : 
             category === 'movie' ? 'Director/Studio' :
             category === 'book' ? 'Author' :
             category === 'place' ? 'Location' : 'Brand'}
          </Label>
          <Input 
            id="venue"
            value={venue}
            onChange={(e) => onVenueChange(e.target.value)}
            placeholder={
              category === 'food' ? 'Where did you have it?' : 
              category === 'movie' ? 'Who made it?' :
              category === 'book' ? 'Who wrote it?' :
              category === 'place' ? 'Address or location' : 'Who makes it?'
            }
            className="bg-background"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Add a photo (optional)</Label>
          <div className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">
            {selectedImage ? (
              <div className="relative w-full">
                <img
                  src={selectedImage}
                  alt="Selected preview"
                  className="h-40 object-cover rounded-md mx-auto"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onImageRemove}
                  className="absolute top-2 right-2"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  id="review-image"
                  accept="image/*"
                  onChange={onImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="review-image"
                  className="cursor-pointer flex flex-col items-center text-muted-foreground"
                >
                  <Camera className="h-12 w-12 mb-2" />
                  <span className="text-sm">{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepThree;
