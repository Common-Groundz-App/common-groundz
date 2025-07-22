import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Book, Film, Utensils, Package, MapPin } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type DatabaseEntity = Database['public']['Tables']['entities']['Row'];

interface EntityTypeSpecificFieldsProps {
  entity: DatabaseEntity;
  onChange: (field: keyof DatabaseEntity, value: any) => void;
  disabled?: boolean;
}

export const EntityTypeSpecificFields: React.FC<EntityTypeSpecificFieldsProps> = ({
  entity,
  onChange,
  disabled = false
}) => {
  const updateArrayField = (field: keyof DatabaseEntity, index: number, value: string) => {
    const currentArray = (entity[field] as string[]) || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    onChange(field, newArray.filter(item => item.trim() !== ''));
  };

  const addToArrayField = (field: keyof DatabaseEntity) => {
    const currentArray = (entity[field] as string[]) || [];
    onChange(field, [...currentArray, '']);
  };

  const removeFromArrayField = (field: keyof DatabaseEntity, index: number) => {
    const currentArray = (entity[field] as string[]) || [];
    const newArray = currentArray.filter((_, i) => i !== index);
    onChange(field, newArray);
  };

  const updateJsonField = (field: keyof DatabaseEntity, key: string, value: any) => {
    const current = (entity[field] as any) || {};
    onChange(field, {
      ...current,
      [key]: value || undefined
    });
  };

  const renderBookFields = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Book className="h-4 w-4" />
          Book Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Authors</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addToArrayField('authors')}
              disabled={disabled}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Author
            </Button>
          </div>
          {(entity.authors || []).map((author, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={author}
                onChange={(e) => updateArrayField('authors', index, e.target.value)}
                placeholder="Author name"
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeFromArrayField('authors', index)}
                disabled={disabled}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* ISBN */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">ISBN</Label>
          <Input
            value={entity.isbn || ''}
            onChange={(e) => onChange('isbn', e.target.value)}
            placeholder="978-0-123456-78-9"
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* Publication Year */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Publication Year</Label>
          <Input
            type="number"
            value={entity.publication_year || ''}
            onChange={(e) => onChange('publication_year', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="2023"
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* Languages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Languages</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addToArrayField('languages')}
              disabled={disabled}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Language
            </Button>
          </div>
          {(entity.languages || []).map((language, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={language}
                onChange={(e) => updateArrayField('languages', index, e.target.value)}
                placeholder="English, Spanish, etc."
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeFromArrayField('languages', index)}
                disabled={disabled}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderMovieFields = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Film className="h-4 w-4" />
          Movie Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Release Year */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Release Year</Label>
          <Input
            type="number"
            value={entity.publication_year || ''}
            onChange={(e) => onChange('publication_year', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="2023"
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* Cast & Crew */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cast & Crew (JSON)</Label>
          <Textarea
            value={entity.cast_crew ? JSON.stringify(entity.cast_crew, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('cast_crew', parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"director": "Director Name", "cast": ["Actor 1", "Actor 2"]}'
            disabled={disabled}
            rows={4}
            className="text-sm font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderFoodFields = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Utensils className="h-4 w-4" />
          Food Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ingredients */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Ingredients</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addToArrayField('ingredients')}
              disabled={disabled}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Ingredient
            </Button>
          </div>
          {(entity.ingredients || []).map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={ingredient}
                onChange={(e) => updateArrayField('ingredients', index, e.target.value)}
                placeholder="Ingredient name"
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeFromArrayField('ingredients', index)}
                disabled={disabled}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Nutritional Info */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Nutritional Information (JSON)</Label>
          <Textarea
            value={entity.nutritional_info ? JSON.stringify(entity.nutritional_info, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('nutritional_info', parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"calories": 250, "protein": "12g", "carbs": "30g"}'
            disabled={disabled}
            rows={3}
            className="text-sm font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderProductFields = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-4 w-4" />
          Product Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Specifications */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Specifications (JSON)</Label>
          <Textarea
            value={entity.specifications ? JSON.stringify(entity.specifications, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('specifications', parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"dimensions": "10x5x2 inches", "weight": "1.5 lbs", "material": "plastic"}'
            disabled={disabled}
            rows={4}
            className="text-sm font-mono"
          />
        </div>

        {/* Price Info */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Price Information (JSON)</Label>
          <Textarea
            value={entity.price_info ? JSON.stringify(entity.price_info, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('price_info', parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"price": "$29.99", "currency": "USD", "discount": "10%"}'
            disabled={disabled}
            rows={3}
            className="text-sm font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderPlaceFields = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Place Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* External Ratings */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">External Ratings (JSON)</Label>
          <Textarea
            value={entity.external_ratings ? JSON.stringify(entity.external_ratings, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('external_ratings', parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder='{"google": 4.5, "yelp": 4.2, "tripadvisor": 4.0}'
            disabled={disabled}
            rows={3}
            className="text-sm font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );

  // Render based on entity type
  const entityType = entity.type as string;
  switch (entityType) {
    case 'book':
      return renderBookFields();
    case 'movie':
    case 'tv':
      return renderMovieFields();
    case 'food':
    case 'drink':
      return renderFoodFields();
    case 'product':
      return renderProductFields();
    case 'place':
    case 'travel':
    case 'activity':
      return renderPlaceFields();
    default:
      return null;
  }
};