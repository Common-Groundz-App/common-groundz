
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadEntityImage } from '@/services/entityImageService';
import { supabase } from '@/integrations/supabase/client';

interface EntityImageUploaderProps {
  value?: string;
  onChange: (url: string | null) => void;
  className?: string;
}

export const EntityImageUploader: React.FC<EntityImageUploaderProps> = ({
  value,
  onChange,
  className
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 10MB',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const result = await uploadEntityImage(file, user.data.user.id);

      if (result.success && result.url) {
        onChange(result.url);
        toast({
          title: 'Success',
          description: 'Image uploaded successfully'
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    onChange(null);
  };

  return (
    <div className={className}>
      <Label htmlFor="entity-image">Entity Image</Label>
      
      {value ? (
        <div className="mt-2 space-y-2">
          <div className="relative w-32 h-32 rounded-md overflow-hidden bg-muted">
            <img
              src={value}
              alt="Entity preview"
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-1 right-1 h-6 w-6 p-0"
              onClick={handleRemoveImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Click upload button to change image
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No image selected
            </p>
          </div>
        </div>
      )}

      <div className="mt-2">
        <Input
          id="entity-image"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('entity-image')?.click()}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {value ? 'Change Image' : 'Upload Image'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
