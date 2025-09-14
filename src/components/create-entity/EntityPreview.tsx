import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateEntityFormData } from '@/pages/CreateEntity';
import { 
  Edit, Globe, MapPin, Building2, Package, BookOpen, 
  Film, Monitor, GraduationCap, Smartphone, Gamepad2, 
  Compass, AlertCircle 
} from 'lucide-react';

interface EntityPreviewProps {
  formData: CreateEntityFormData;
  onEdit: (step: number) => void;
}

export function EntityPreview({ formData, onEdit }: EntityPreviewProps) {
  // 🐛 DEBUG: Track formData changes in EntityPreview
  useEffect(() => {
    console.log('🔍 [EntityPreview] Component re-rendered with formData:', {
      parentEntityId: formData.parentEntityId,
      parentEntityName: formData.parentEntityName,
      parentEntityImageUrl: formData.parentEntityImageUrl,
      fullFormData: formData
    });
  }, [formData]);

  // 🐛 DEBUG: Track specific parentEntityName changes
  useEffect(() => {
    console.log('🔍 [EntityPreview] parentEntityName changed:', formData.parentEntityName);
  }, [formData.parentEntityName]);

  // 🐛 DEBUG: Log what we're about to render
  console.log('🔍 [EntityPreview] About to render with parentEntityName:', formData.parentEntityName);
  const getEntityTypeIcon = () => {
    switch (formData.entityType) {
      case 'product': return Package;
      case 'place': return MapPin;
      case 'book': return BookOpen;
      case 'movie': return Film;
      case 'tv_show': return Monitor;
      case 'course': return GraduationCap;
      case 'app': return Smartphone;
      case 'game': return Gamepad2;
      case 'experience': return Compass;
      case 'brand': return Building2;
      default: return Package;
    }
  };

  const EntityIcon = getEntityTypeIcon();

  const getValidationIssues = () => {
    const issues = [];
    if (!formData.name.trim()) issues.push('Name is required');
    if (!formData.description.trim()) issues.push('Description is required');
    if (!formData.categoryId) issues.push('Category must be selected');
    return issues;
  };

  const validationIssues = getValidationIssues();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Review Your Entity
        </h2>
        <p className="text-muted-foreground">
          Please review the information before submitting
        </p>
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive mb-2">
                  Please fix the following issues:
                </p>
                <ul className="text-sm text-destructive space-y-1">
                  {validationIssues.map((issue, index) => (
                    <li key={index}>• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entity Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image */}
            {formData.imageUrl && (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={formData.imageUrl}
                  alt={formData.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <EntityIcon className="w-5 h-5 text-primary" />
                <Badge variant="secondary">
                  {formData.entityType?.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground">
                {formData.name || 'Untitled'}
              </h3>
              
              {formData.parentEntityName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>by {formData.parentEntityName}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">
              {formData.description || 'No description provided'}
            </p>

            {/* Metadata */}
            <div className="space-y-2 text-sm">
              {formData.venue && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{formData.venue}</span>
                </div>
              )}
              
              {formData.websiteUrl && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span className="truncate">{formData.websiteUrl}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entity Details */}
        <div className="space-y-4">
          {/* Type Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Entity Type</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.entityType?.replace('_', ' ') || 'Not selected'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(1)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Brand/Parent */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Brand/Organization</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.parentEntityName || 'No brand selected'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(2)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Category</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.categoryId ? 'Category selected' : 'No category selected'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(3)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Details & Media</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.name && formData.description ? 'Complete' : 'Incomplete'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(4)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Type-Specific Data */}
          {Object.keys(formData.typeSpecificData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(formData.typeSpecificData).map(([key, value]) => {
                  if (!value) return null;
                  
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:
                      </span>
                      <span className="text-foreground font-medium">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Submission Notes */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              What happens after submission?
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Your entity will be published immediately</li>
              <li>• You can start using it right away in recommendations</li>
              <li>• Our team will review and enhance it in the background</li>
              <li>• You can always edit or improve the information later</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}