
import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityExternalLinksProps {
  entity: Entity;
  className?: string;
}

export const EntityExternalLinks: React.FC<EntityExternalLinksProps> = ({
  entity,
  className = "",
}) => {
  const websiteUrl = entity.website_url;
  const productUrl = entity.metadata?.product_url as string | undefined;

  // Don't render if no external links available
  if (!websiteUrl && !productUrl) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {websiteUrl && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" />
          Visit Website
        </Button>
      )}
      
      {productUrl && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => window.open(productUrl, '_blank', 'noopener,noreferrer')}
        >
          <ShoppingCart className="h-4 w-4" />
          Buy Product
        </Button>
      )}
    </div>
  );
};
