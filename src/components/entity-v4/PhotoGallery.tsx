
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface PhotoGalleryProps {
  entityName: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ entityName }) => {
  const handleAddPhotos = () => {
    // TODO: Implement photo upload functionality
    console.log('Add photos clicked for:', entityName);
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Photos & Videos
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleAddPhotos}>
            <Camera className="w-4 h-4 mr-2" />
            Add Photos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => 
            <div key={i} className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-300 transition-colors cursor-pointer">
              <Camera className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
