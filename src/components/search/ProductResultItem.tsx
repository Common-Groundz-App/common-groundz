
import React from 'react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ProductSearchResult } from '@/hooks/use-unified-search';

interface ProductResultItemProps {
  result: ProductSearchResult;
  onClick?: () => void;
}

export function ProductResultItem({ result, onClick }: ProductResultItemProps) {
  const handleClick = () => {
    if (onClick) onClick();
  };

  const getEntitySlug = () => {
    if (result.api_source && result.api_ref) {
      return `${result.api_source}-${result.api_ref}`;
    }
    return result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  return (
    <Link 
      to={`/entity/${getEntitySlug()}`} 
      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/50"
      onClick={handleClick}
    >
      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
        <ImageWithFallback
          src={result.image_url}
          alt={result.name}
          entityType={result.metadata?.type || 'product'}
          suppressConsoleErrors={true}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {result.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {result.venue || result.metadata?.author || result.metadata?.publisher || 'Product'}
        </p>
        {result.metadata?.rating && (
          <p className="text-xs text-muted-foreground">
            ⭐ {result.metadata.rating}
          </p>
        )}
      </div>
      <div className="text-xs text-muted-foreground capitalize">
        {result.api_source?.replace('_', ' ') || 'External'}
      </div>
    </Link>
  );
}
