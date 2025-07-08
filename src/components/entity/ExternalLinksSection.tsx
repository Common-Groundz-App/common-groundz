import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface ExternalLinksSectionProps {
  entity: Entity;
}

export const ExternalLinksSection: React.FC<ExternalLinksSectionProps> = ({ entity }) => {
  const hasWebsiteUrl = entity.website_url && entity.website_url.trim() !== '';
  const hasProductUrl = entity.price_info?.buy_url && entity.price_info.buy_url.trim() !== '';

  if (!hasWebsiteUrl && !hasProductUrl) {
    return null;
  }

  return (
    <div className="space-y-3">
      {hasWebsiteUrl && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open(entity.website_url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" />
          Visit Website
        </Button>
      )}
      
      {hasProductUrl && (
        <Button
          className="w-full gap-2"
          onClick={() => window.open(entity.price_info.buy_url, '_blank', 'noopener,noreferrer')}
        >
          <ShoppingCart className="h-4 w-4" />
          Buy Product
        </Button>
      )}
    </div>
  );
};