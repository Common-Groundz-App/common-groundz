import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Film, Upload, X } from 'lucide-react';
import { uploadMedia, ALLOWED_MEDIA_TYPES, validateMediaFile } from '@/services/mediaService';
import { MediaUploadState, MediaItem } from '@/types/media';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

interface MediaUploaderProps {
  sessionId: string;
  onMediaUploaded: (media: MediaItem) => void;
  initialMedia?: MediaItem[];
  className?: string;
  customButton?: React.ReactNode;
  maxMediaCount?: number;
}

export function MediaUploader({ 
  sessionId, 
  onMediaUploaded, 
  initialMedia = [], 
  className,
  customButton,
  maxMediaCount = 4  // Default to 4 max images
}: MediaUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<MediaUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentMediaCount, setCurrentMediaCount] = useState(initialMedia.length);
  
  useEffect(() => {
    setCurrentMediaCount(initialMedia.length);
  }, [initialMedia]);
  
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !user) return;
    
    const remainingSlots = maxMediaCount - currentMediaCount;
    
    if (remainingSlots <= 0) {
      toast({
        title: 'Media limit reached',
        description: `You can only upload up to ${maxMediaCount} media items`,
        variant: 'destructive',
      });
      return;
    }
    
    // Only process up to the remaining slots
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    // Show warning if some files were not processed
    if (files.length > remainingSlots) {
      toast({
        title: 'Too many files selected',
        description: `Only the first ${remainingSlots} files will be processed. Max limit is ${maxMediaCount} media items.`,
        variant: 'default',
      });
    }
    
    filesToProcess.forEach(file => {
      const { valid, error } = validateMediaFile(file);
      
      if (!valid) {
        toast({
          title: 'Invalid file',
          description: error,
          variant: 'destructive',
        });
        return;
      }
      
      const newUpload: MediaUploadState = {
        file,
        progress: 0,
        status: 'uploading',
      };
      
      setUploads(prev => [...prev, newUpload]);
      
      uploadMedia(
        file,
        user.id,
        sessionId,
        (progress) => {
          setUploads(prev => 
            prev.map(upload => 
              upload.file === file 
                ? { ...upload, progress } 
                : upload
            )
          );
        }
      ).then(mediaItem => {
        if (mediaItem) {
          setUploads(prev => 
            prev.map(upload => 
              upload.file === file 
                ? { ...upload, status: 'success', item: mediaItem } 
                : upload
            )
          );
          
          onMediaUploaded(mediaItem);
          setCurrentMediaCount(prev => prev + 1);
          
          // Clean up upload after a delay
          setTimeout(() => {
            setUploads(prev => prev.filter(upload => upload.file !== file));
          }, 2000);
        } else {
          setUploads(prev => 
            prev.map(upload => 
              upload.file === file 
                ? { ...upload, status: 'error', error: 'Upload failed' } 
                : upload
            )
          );
        }
      });
    });
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };
  
  const cancelUpload = (uploadToCancel: MediaUploadState) => {
    setUploads(prev => prev.filter(upload => upload !== uploadToCancel));
  };
  
  // If a custom button is provided, render it with the file selector logic
  if (customButton) {
    return (
      <div className={className}>
        <div onClick={() => {
          if (currentMediaCount >= maxMediaCount) {
            toast({
              title: 'Media limit reached',
              description: `You can only upload up to ${maxMediaCount} media items`,
              variant: 'destructive',
            });
            return;
          }
          
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = ALLOWED_MEDIA_TYPES.join(',');
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
        }}>
          {customButton}
        </div>
        
        {uploads.length > 0 && (
          <div className="space-y-2 mt-2">
            {uploads.map((upload, index) => (
              <div key={index} className="flex items-center space-x-2 border rounded-md p-2">
                <div className="flex-shrink-0">
                  {upload.file.type.startsWith('image/') ? (
                    <ImageIcon size={20} className="text-blue-500" />
                  ) : (
                    <Film size={20} className="text-purple-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{upload.file.name}</p>
                  <Progress value={upload.progress} className="h-1 mt-1" />
                </div>
                <div className="flex-shrink-0">
                  {upload.status === 'success' ? (
                    <div className="text-green-500 text-sm">✓</div>
                  ) : upload.status === 'error' ? (
                    <div className="text-red-500 text-sm">✗</div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => cancelUpload(upload)}
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
          isDragging ? "border-primary bg-primary/10" : "border-gray-300 hover:border-primary/50",
          currentMediaCount >= maxMediaCount && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (currentMediaCount >= maxMediaCount) {
            toast({
              title: 'Media limit reached',
              description: `You can only upload up to ${maxMediaCount} media items`,
              variant: 'destructive',
            });
            return;
          }
          
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = ALLOWED_MEDIA_TYPES.join(',');
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
        }}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground">
              Images (JPG, PNG, GIF, WebP) and videos (MP4, WebM) up to 10MB
            </p>
            <p className="text-xs font-medium mt-1">
              {currentMediaCount}/{maxMediaCount} media items used
            </p>
          </div>
        </div>
      </div>
      
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div key={index} className="flex items-center space-x-2 border rounded-md p-2">
              <div className="flex-shrink-0">
                {upload.file.type.startsWith('image/') ? (
                  <ImageIcon size={20} className="text-blue-500" />
                ) : (
                  <Film size={20} className="text-purple-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{upload.file.name}</p>
                <Progress value={upload.progress} className="h-1 mt-1" />
              </div>
              <div className="flex-shrink-0">
                {upload.status === 'success' ? (
                  <div className="text-green-500 text-sm">✓</div>
                ) : upload.status === 'error' ? (
                  <div className="text-red-500 text-sm">✗</div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => cancelUpload(upload)}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
