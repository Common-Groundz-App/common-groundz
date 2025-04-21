
import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ReviewImageUploadProps {
  selectedImage: string | null;
  isUploading: boolean;
  handleImageUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

const ReviewImageUpload = ({ 
  selectedImage, 
  isUploading, 
  handleImageUploadChange, 
  onRemoveImage 
}: ReviewImageUploadProps) => {
  return (
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
              onClick={onRemoveImage}
            >
              ×
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewImageUpload;
