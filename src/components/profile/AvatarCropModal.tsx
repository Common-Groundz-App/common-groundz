
import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { createCroppedImage } from '@/utils/imageProcessing';
import { RotateCcw, ZoomIn } from 'lucide-react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  isProcessing?: boolean;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  isProcessing = false
}) => {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    // Create a preview of the cropped area
    if (imageSrc && croppedAreaPixels) {
      createCroppedImage(imageSrc, croppedAreaPixels)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        })
        .catch((error) => {
          console.error('Error creating preview:', error);
        });
    }
  }, [imageSrc]);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) {
      toast({
        title: 'Error',
        description: 'Please adjust the crop area before saving',
        variant: 'destructive'
      });
      return;
    }

    try {
      const croppedImage = await createCroppedImage(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
      toast({
        title: 'Error',
        description: 'Failed to crop image. Please try again.',
        variant: 'destructive'
      });
    }
  }, [imageSrc, croppedAreaPixels, onCropComplete, toast]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  }, [previewUrl]);

  const handleClose = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  }, [previewUrl, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crop Your Avatar</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Cropper */}
          <div className="relative h-64 md:h-80 bg-gray-100 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid={true}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <ZoomIn className="h-4 w-4" />
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={1}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[3rem]">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="flex justify-center">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">Preview</p>
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
                  <img 
                    src={previewUrl} 
                    alt="Cropped preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isProcessing || !croppedAreaPixels}
              className="flex-1 sm:flex-none"
            >
              {isProcessing ? 'Processing...' : 'Save Avatar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
