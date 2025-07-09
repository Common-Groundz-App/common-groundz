
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, Globe } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { EntityV3ImageGallery } from './EntityV3ImageGallery';
import { EntityV3HeroStats } from './EntityV3HeroStats';
import { EntityV3ActionButtons } from './EntityV3ActionButtons';

interface EntityV3HeroProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3Hero: React.FC<EntityV3HeroProps> = ({ entity, stats }) => {
  return (
    <Card className="lg:col-span-2 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Image Gallery Section */}
        <div className="relative">
          <EntityV3ImageGallery
            primaryImage={entity.image_url || ''}
            entityType={entity.type}
            entityName={entity.name}
            media={entity.metadata?.media}
          />
        </div>
        
        {/* Content Section */}
        <div className="flex flex-col justify-between space-y-6">
          {/* Header Info */}
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">
                {entity.type}
              </Badge>
              {entity.is_verified && (
                <Badge variant="default">Verified</Badge>
              )}
              {entity.trending_score && entity.trending_score > 0.7 && (
                <Badge variant="outline" className="border-orange-200 text-orange-700">
                  Trending
                </Badge>
              )}
            </div>
            
            {/* Title */}
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-2">
                {entity.name}
              </h1>
              
              {/* Location & Website */}
              <div className="flex flex-col gap-2">
                {entity.venue && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{entity.venue}</span>
                  </div>
                )}
                
                {entity.website_url && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <a 
                      href={entity.website_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm hover:text-primary hover:underline transition-colors"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            {/* Description */}
            {entity.description && (
              <p className="text-muted-foreground leading-relaxed text-sm lg:text-base">
                {entity.description}
              </p>
            )}
          </div>

          {/* Stats Section */}
          <EntityV3HeroStats stats={stats} />

          {/* Action Buttons */}
          <EntityV3ActionButtons
            entityId={entity.id}
            entityName={entity.name}
            websiteUrl={entity.website_url}
          />
        </div>
      </div>
    </Card>
  );
};
