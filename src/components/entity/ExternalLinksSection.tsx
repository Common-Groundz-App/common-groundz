import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { getEntityWebsiteUrl } from '@/utils/locationUtils';

interface ExternalLinksSectionProps {
  entity: Entity;
}

export const ExternalLinksSection: React.FC<ExternalLinksSectionProps> = ({ entity }) => {
  const websiteUrl = getEntityWebsiteUrl(entity);
  const hasProductUrl = entity.price_info?.buy_url && entity.price_info.buy_url.trim() !== '';

  if (!websiteUrl && !hasProductUrl) {
    return null;
  }

  return (
    <div className="space-y-3">
      {websiteUrl && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')}
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