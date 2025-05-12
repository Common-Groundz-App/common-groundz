
import React, { ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface ImageUploaderProps {
  selectedImage: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemove: () => void;
  isUploading: boolean;
  isEntityImage?: boolean;
}

const ImageUploader = ({ 
  selectedImage, 
  onChange, 
  onRemove, 
  isUploading,
  isEntityImage = false
}: ImageUploaderProps) => {
  // Only show the image uploader if it's a user-uploaded image or no image at all
  // (We don't want to show entity images in the uploader)
  const shouldShowImage = selectedImage && !isEntityImage;
  
  return (
    <div 
      className={cn(
        "transition-all duration-300",
        "flex flex-col items-center justify-center rounded-lg p-4",
        "border-2 border-dashed",
        shouldShowImage 
          ? "border-brand-orange/50" 
          : "border-brand-orange/30",
        "hover:border-brand-orange/70",
        "bg-gradient-to-b from-transparent to-accent/5"
      )}
    >
      {shouldShowImage ? (
        <div className="relative w-full">
          <div className="h-48 overflow-hidden rounded-md">
            <ImageWithFallback
              src={selectedImage}
              alt="Preview"
              className="h-full w-full object-cover rounded-md mx-auto shadow-md hover:scale-105 transition-transform duration-300"
              onError={(e) => console.error("Image failed to load in ImageUploader:", selectedImage)}
            />
          </div>
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-800/80 text-white hover:bg-gray-900 shadow-md"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <Input
            type="file"
            id="image"
            accept="image/*"
            onChange={onChange}
            className="hidden"
          />
          <Label
            htmlFor="image"
            className={cn(
              "cursor-pointer flex flex-col items-center text-muted-foreground",
              "hover:text-foreground transition-colors duration-200",
              "w-full h-48 justify-center rounded-md",
              "bg-accent/10 hover:bg-accent/20"
            )}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="p-3 rounded-full bg-brand-orange/10 transition-colors duration-200 group-hover:bg-brand-orange/20">
                <Camera className="h-8 w-8 text-brand-orange/70" />
              </div>
              <span className="text-sm font-medium">{isUploading ? "Uploading..." : "Add a photo"}</span>
              <span className="text-xs max-w-[80%] text-center">Share your experience visually</span>
            </div>
          </Label>
        </>
      )}
    </div>
  );
};

export default ImageUploader;
