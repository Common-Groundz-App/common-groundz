
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  selectedImage: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemove: () => void;
  isUploading: boolean;
}

const ImageUploader = ({ selectedImage, onChange, onRemove, isUploading }: ImageUploaderProps) => {
  return (
    <div 
      className={cn(
        "transition-all duration-300",
        "flex flex-col items-center justify-center rounded-lg p-4",
        "border-2 border-dashed",
        selectedImage ? "border-brand-orange/50" : "border-brand-orange/30",
        "hover:border-brand-orange/70",
        "bg-gradient-to-b from-transparent to-accent/5"
      )}
    >
      {selectedImage ? (
        <div className="relative w-full">
          <div className="h-48 overflow-hidden rounded-md">
            <img
              src={selectedImage}
              alt="Preview"
              className="h-full w-full object-cover rounded-md mx-auto shadow-md hover:scale-105 transition-transform duration-300"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-800/80 text-white hover:bg-gray-900 shadow-md"
            onClick={onRemove}
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
