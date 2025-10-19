import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import type { EntityFieldConfig } from '@/config/entityTypeConfig';

interface DynamicFieldGroupProps {
  title: string;
  icon?: string;
  fields: EntityFieldConfig[];
  formData: any;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  aiFilledFields?: Set<string>;
}

export const DynamicFieldGroup: React.FC<DynamicFieldGroupProps> = ({
  title,
  icon,
  fields,
  formData,
  onChange,
  disabled = false,
  errors = {},
  aiFilledFields = new Set()
}) => {
  const getFieldValue = (field: EntityFieldConfig) => {
    const column = field.storageColumn || 'metadata';
    
    switch (column) {
      case 'metadata':
        return formData.metadata?.[field.key];
      case 'cast_crew':
        return formData.cast_crew?.[field.key];
      case 'specifications':
        return formData.specifications?.[field.key];
      case 'price_info':
        return formData.price_info?.[field.key];
      case 'nutritional_info':
        return formData.nutritional_info?.[field.key];
      case 'external_ratings':
        return formData.external_ratings?.[field.key];
      default:
        return formData[column];
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => (
          <DynamicFieldRenderer
            key={field.key}
            field={field}
            value={getFieldValue(field)}
            onChange={(value) => onChange(field.key, value)}
            disabled={disabled}
            error={errors[field.key]}
            aiGenerated={aiFilledFields.has(field.key)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
