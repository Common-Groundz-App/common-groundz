
import React from 'react';
import { ProductSearchResult } from '@/hooks/use-unified-search';
import { SearchResultHandler } from './SearchResultHandler';

interface ProductResultItemProps {
  product: ProductSearchResult;
  query: string;
  onClick: () => void;
}

export function ProductResultItem({ product, query, onClick }: ProductResultItemProps) {
  return (
    <SearchResultHandler 
      result={product} 
      query={query} 
      onClose={onClick}
    />
  );
}
