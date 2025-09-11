import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EntityTypeSpecificFields } from '@/components/admin/EntityTypeSpecificFields';
import { CreateEntityFormData } from '@/pages/CreateEntity';
import { Upload, Globe, MapPin, Image as ImageIcon, X } from 'lucide-react';

interface EntityDetailsFormProps {
  formData: CreateEntityFormData;
  onFieldUpdate: (field: keyof CreateEntityFormData, value: any) => void;
}

export function EntityDetailsForm({ formData, onFieldUpdate }: EntityDetailsFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFieldUpdate('imageFile', file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        onFieldUpdate('imageUrl', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url: string) => {
    onFieldUpdate('imageUrl', url);
    onFieldUpdate('imageFile', null);
    setImagePreview(url || null);
  };

  const clearImage = () => {
    onFieldUpdate('imageFile', null);
    onFieldUpdate('imageUrl', '');
    setImagePreview(null);
  };

  // Create a mock entity object for the type-specific fields component
  const mockEntity = {
    id: 'temp',
    type: formData.entityType,
    name: formData.name,
    description: formData.description,
    ...formData.typeSpecificData
  } as any;

  const handleTypeSpecificChange = (field: string, value: any) => {
    onFieldUpdate('typeSpecificData', {
      ...formData.typeSpecificData,
      [field]: value
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Entity Details
        </h2>
        <p className="text-muted-foreground">
          Fill in the information about your {formData.entityType?.toLowerCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder={`Enter ${formData.entityType?.toLowerCase()} name...`}
                value={formData.name}
                onChange={(e) => onFieldUpdate('name', e.target.value)}
                className={formData.name.trim() === '' ? 'border-destructive' : ''}
              />
              {formData.name.trim() === '' && (
                <p className="text-xs text-destructive">Name is required</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder={`Describe this ${formData.entityType?.toLowerCase()}...`}
                value={formData.description}
                onChange={(e) => onFieldUpdate('description', e.target.value)}
                rows={4}
                className={formData.description.trim() === '' ? 'border-destructive' : ''}
              />
              {formData.description.trim() === '' && (
                <p className="text-xs text-destructive">Description is required</p>
              )}
            </div>

            {/* Venue (for places and experiences) */}
            {(formData.entityType === 'place' || formData.entityType === 'experience') && (
              <div className="space-y-2">
                <Label htmlFor="venue" className="text-sm font-medium">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location/Venue
                </Label>
                <Input
                  id="venue"
                  placeholder="Enter location or venue..."
                  value={formData.venue}
                  onChange={(e) => onFieldUpdate('venue', e.target.value)}
                />
              </div>
            )}

            {/* Website URL */}
            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm font-medium">
                <Globe className="w-4 h-4 inline mr-1" />
                Website URL
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://..."
                value={formData.websiteUrl}
                onChange={(e) => onFieldUpdate('websiteUrl', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image Preview */}
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={clearImage}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Add an image to help people recognize this {formData.entityType?.toLowerCase()}
                </p>
              </div>
            )}

            {/* Upload Button */}
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="text-sm font-medium">
                Upload Image
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image-url" className="text-sm font-medium">
                Or paste image URL
              </Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.imageFile ? '' : formData.imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                disabled={!!formData.imageFile}
              />
            </div>

            {formData.imageFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">File selected</Badge>
                <span>{formData.imageFile.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Type-Specific Fields */}
      {formData.entityType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {formData.entityType.charAt(0).toUpperCase() + formData.entityType.slice(1)}-Specific Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EntityTypeSpecificFields
              entity={mockEntity}
              onChange={handleTypeSpecificChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Form Validation Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Almost ready!
              </p>
              <p className="text-xs text-muted-foreground">
                Make sure all required fields are filled. You can always edit this information later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}