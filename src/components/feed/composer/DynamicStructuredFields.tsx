import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DURATION_OPTIONS, getFieldsForType } from '@/types/structuredFields';
import type { DatabasePostType } from '@/components/feed/utils/postUtils';
import { ConnectedRingsRating } from '@/components/recommendations/ConnectedRingsRating';

interface DynamicStructuredFieldsProps {
  postType: DatabasePostType;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export const DynamicStructuredFields: React.FC<DynamicStructuredFieldsProps> = ({
  postType,
  values,
  onChange,
}) => {
  const fields = getFieldsForType(postType);

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const value = values[field.key] ?? '';

        if (field.inputType === 'rating') {
          return (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {field.label}
              </label>
              <ConnectedRingsRating
                value={typeof value === 'number' ? value : 0}
                onChange={(v) => onChange(field.key, v)}
                size="sm"
                isInteractive={true}
              />
            </div>
          );
        }

        if (field.inputType === 'enum') {
          return (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {field.label}
              </label>
              <Select value={value || ''} onValueChange={(v) => onChange(field.key, v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DURATION_OPTIONS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.inputType === 'yesno') {
          return (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {field.label}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange(field.key, value === 'yes' ? '' : 'yes')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors',
                    value === 'yes'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => onChange(field.key, value === 'no' ? '' : 'no')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors',
                    value === 'no'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  No
                </button>
              </div>
            </div>
          );
        }

        if (field.inputType === 'textarea') {
          return (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {field.label}
              </label>
              <Textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={() => onChange(field.key, (value as string).trim().replace(/\s{2,}/g, ' '))}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                className="min-h-[60px] resize-none text-sm"
              />
              {field.maxLength && (
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">
                  {(value as string).length}/{field.maxLength}
                </p>
              )}
            </div>
          );
        }

        // text input
        return (
          <div key={field.key}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {field.label}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              onBlur={() => onChange(field.key, (value as string).trim().replace(/\s{2,}/g, ' '))}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {field.maxLength && (
              <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">
                {(value as string).length}/{field.maxLength}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
