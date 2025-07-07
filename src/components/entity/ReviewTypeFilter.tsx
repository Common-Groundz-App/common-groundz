
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface ReviewTypeFilterProps {
  reviewTypes: {
    product: number;
    brand: number;
  };
  selectedType: 'all' | 'product' | 'brand';
  onTypeChange: (type: 'all' | 'product' | 'brand') => void;
  entityName: string;
}

export const ReviewTypeFilter = ({ 
  reviewTypes, 
  selectedType, 
  onTypeChange, 
  entityName 
}: ReviewTypeFilterProps) => {
  // Only show filter if both product and brand reviews exist
  const showFilter = reviewTypes.product > 0 && reviewTypes.brand > 0;
  
  if (!showFilter) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-sm font-medium">Filter Reviews:</span>
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All Reviews ({reviewTypes.product + reviewTypes.brand})
          </SelectItem>
          <SelectItem value="product">
            <div className="flex items-center gap-2">
              Product Reviews
              <Badge variant="secondary" className="text-xs">
                {reviewTypes.product}
              </Badge>
            </div>
          </SelectItem>
          <SelectItem value="brand">
            <div className="flex items-center gap-2">
              Brand Reviews
              <Badge variant="secondary" className="text-xs">
                {reviewTypes.brand}
              </Badge>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
