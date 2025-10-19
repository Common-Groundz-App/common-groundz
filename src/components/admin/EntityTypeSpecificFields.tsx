import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { getCanonicalType } from '@/services/entityTypeHelpers';
import { entityTypeConfig, EntityFieldConfig } from '@/config/entityTypeConfig';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';

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
  // Validate metadata format on mount and changes
  React.useEffect(() => {
    if (entity.metadata && typeof entity.metadata !== 'object') {
      console.warn('Invalid metadata format for entity:', entity.id, entity.metadata);
    }
    if (entity.cast_crew && typeof entity.cast_crew !== 'object') {
      console.warn('Invalid cast_crew format for entity:', entity.id, entity.cast_crew);
    }
    if (entity.specifications && typeof entity.specifications !== 'object') {
      console.warn('Invalid specifications format for entity:', entity.id, entity.specifications);
    }
  }, [entity.id, entity.metadata, entity.cast_crew, entity.specifications]);

  // Helper to read field value from correct storage column
  const getFieldValue = (entity: DatabaseEntity, field: EntityFieldConfig) => {
    const column = field.storageColumn || 'metadata';
    
    switch (column) {
      case 'metadata':
        return entity.metadata?.[field.key];
      case 'cast_crew':
        return entity.cast_crew?.[field.key];
      case 'specifications':
        return entity.specifications?.[field.key];
      case 'price_info':
        return entity.price_info?.[field.key];
      case 'nutritional_info':
        return entity.nutritional_info?.[field.key];
      case 'external_ratings':
        return entity.external_ratings?.[field.key];
      case 'authors':
      case 'languages':
      case 'ingredients':
        return entity[column];
      default:
        return entity[column as keyof DatabaseEntity];
    }
  };

  // Helper to update field value to correct storage column
  const setFieldValue = (field: EntityFieldConfig, value: any) => {
    const column = field.storageColumn || 'metadata';
    
    // For direct columns (authors, isbn, publication_year, etc.)
    if (['authors', 'languages', 'ingredients', 'isbn', 'publication_year'].includes(column)) {
      onChange(column as keyof DatabaseEntity, value);
      return;
    }
    
    // For JSONB columns
    const currentData = entity[column as keyof DatabaseEntity] || {};
    onChange(column as keyof DatabaseEntity, {
      ...(typeof currentData === 'object' ? currentData : {}),
      [field.key]: value
    });
  };

  // Get canonical type and config with fallback
  const canonicalType = getCanonicalType(entity.type) || 'generic';
  const typeConfig = entityTypeConfig[canonicalType] || entityTypeConfig.generic;

  // Missing config fallback
  if (!typeConfig || !typeConfig.fields || typeConfig.fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            No configuration found for entity type: <strong>{canonicalType}</strong>
          </p>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Contact support to add field configuration for this type.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Config-driven fields organized by groups */}
      {typeConfig.fieldGroups ? (
        typeConfig.fieldGroups.map((group, index) => {
          const groupFields = typeConfig.fields.filter(f => 
            group.fields.includes(f.key)
          );
          
          return (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {group.icon && <span>{group.icon}</span>}
                  <span>{group.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupFields.map(field => (
                  <DynamicFieldRenderer
                    key={field.key}
                    field={field}
                    value={getFieldValue(entity, field)}
                    onChange={(value) => setFieldValue(field, value)}
                    disabled={disabled}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      ) : (
        // Fallback: render all fields without groups
        <Card>
          <CardContent className="space-y-4 pt-6">
            {typeConfig.fields.map(field => (
              <DynamicFieldRenderer
                key={field.key}
                field={field}
                value={getFieldValue(entity, field)}
                onChange={(value) => setFieldValue(field, value)}
                disabled={disabled}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Advanced JSON Editors (collapsible) */}
      {(entity.cast_crew || entity.nutritional_info || entity.specifications || entity.external_ratings || entity.price_info) && (
        <Collapsible>
          <Card>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full [&[data-state=open]>svg]:rotate-180">
                <CardTitle className="text-lg">🔧 Advanced Editors</CardTitle>
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Cast & Crew (Movies/TV Shows) */}
                {entity.cast_crew && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cast & Crew (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(entity.cast_crew, null, 2)}
                      onChange={(e) => {
                        try {
                          onChange('cast_crew', JSON.parse(e.target.value));
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      disabled={disabled}
                      className="font-mono text-xs min-h-[120px]"
                    />
                  </div>
                )}
                
                {/* Nutritional Info (Food) */}
                {entity.nutritional_info && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nutritional Info (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(entity.nutritional_info, null, 2)}
                      onChange={(e) => {
                        try {
                          onChange('nutritional_info', JSON.parse(e.target.value));
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      disabled={disabled}
                      className="font-mono text-xs min-h-[120px]"
                    />
                  </div>
                )}
                
                {/* Specifications (Products/Apps/Games) */}
                {entity.specifications && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Specifications (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(entity.specifications, null, 2)}
                      onChange={(e) => {
                        try {
                          onChange('specifications', JSON.parse(e.target.value));
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      disabled={disabled}
                      className="font-mono text-xs min-h-[120px]"
                    />
                  </div>
                )}
                
                {/* Price Info (Products) */}
                {entity.price_info && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Price Info (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(entity.price_info, null, 2)}
                      onChange={(e) => {
                        try {
                          onChange('price_info', JSON.parse(e.target.value));
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      disabled={disabled}
                      className="font-mono text-xs min-h-[120px]"
                    />
                  </div>
                )}
                
                {/* External Ratings (Places) */}
                {entity.external_ratings && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">External Ratings (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(entity.external_ratings, null, 2)}
                      onChange={(e) => {
                        try {
                          onChange('external_ratings', JSON.parse(e.target.value));
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      disabled={disabled}
                      className="font-mono text-xs min-h-[120px]"
                    />
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
};