import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReviewTypeToggleProps {
  activeType: 'product' | 'brand';
  onTypeChange: (type: 'product' | 'brand') => void;
  productReviewCount: number;
  brandReviewCount: number;
  productName?: string;
  brandName?: string;
}

export const ReviewTypeToggle: React.FC<ReviewTypeToggleProps> = ({
  activeType,
  onTypeChange,
  productReviewCount,
  brandReviewCount,
  productName,
  brandName
}) => {
  // Only show if both types have reviews
  if (productReviewCount === 0 && brandReviewCount === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <Tabs value={activeType} onValueChange={(value) => onTypeChange(value as 'product' | 'brand')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="product" className="text-sm">
            {productName ? `${productName} Reviews` : 'Product Reviews'} ({productReviewCount})
          </TabsTrigger>
          <TabsTrigger value="brand" className="text-sm">
            {brandName ? `${brandName} Reviews` : 'Brand Reviews'} ({brandReviewCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};