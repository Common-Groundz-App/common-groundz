
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Star, MapPin, Globe } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityV3HeroProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3Hero: React.FC<EntityV3HeroProps> = ({ entity, stats }) => {
  const averageRating = stats?.averageRating || 0;
  
  return (
    <Card className="lg:col-span-2 p-6">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* Image Section */}
        <div className="relative">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {entity.image_url ? (
              <img
                src={entity.image_url}
                alt={entity.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No image available
              </div>
            )}
          </div>
        </div>
        
        {/* Content Section */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="capitalize">
                {entity.type}
              </Badge>
              {entity.is_verified && (
                <Badge variant="default">Verified</Badge>
              )}
            </div>
            
            <h1 className="text-3xl font-bold mb-2">{entity.name}</h1>
            
            {/* Rating Section */}
            {averageRating > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{averageRating.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground">
                  ({stats?.reviewCount || 0} reviews)
                </span>
              </div>
            )}
            
            {/* Location & Website */}
            <div className="space-y-2 mb-4">
              {entity.venue && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {entity.venue}
                </div>
              )}
              
              {entity.website_url && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <a 
                    href={entity.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>
            
            {/* Description */}
            {entity.description && (
              <p className="text-muted-foreground leading-relaxed">
                {entity.description}
              </p>
            )}
          </div>
          
          {/* Stats Row */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="font-semibold text-lg">{stats?.recommendationCount || 0}</div>
              <div className="text-sm text-muted-foreground">Recommendations</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{stats?.reviewCount || 0}</div>
              <div className="text-sm text-muted-foreground">Reviews</div>
            </div>
            {averageRating > 0 && (
              <div className="text-center">
                <div className="font-semibold text-lg">{averageRating.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Average Rating</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
