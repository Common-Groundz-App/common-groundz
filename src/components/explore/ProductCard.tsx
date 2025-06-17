
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Star, MapPin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  entity: {
    id: string;
    name: string;
    type: string;
    description?: string;
    image_url?: string;
    venue?: string;
    trending_score?: number;
    recent_views_24h?: number;
    popularity_score?: number;
  };
  onClick: () => void;
  compact?: boolean;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  entity, 
  onClick, 
  compact = false,
  className 
}) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie': return 'bg-red-100 text-red-800';
      case 'book': return 'bg-blue-100 text-blue-800';
      case 'place': return 'bg-green-100 text-green-800';
      case 'product': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'movie': return '🎬';
      case 'book': return '📚';
      case 'place': return '📍';
      case 'product': return '🛍️';
      default: return '⭐';
    }
  };

  const formatStats = () => {
    const stats = [];
    if (entity.recent_views_24h && entity.recent_views_24h > 0) {
      stats.push(`${entity.recent_views_24h} views`);
    }
    if (entity.trending_score && entity.trending_score > 0) {
      stats.push(`${entity.trending_score.toFixed(1)} trending`);
    }
    return stats.join(' • ');
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 overflow-hidden",
        compact ? "h-48" : "h-72",
        className
      )}
      onClick={onClick}
    >
      <div className="relative h-full">
        <div className={cn(
          "relative overflow-hidden",
          compact ? "h-32" : "h-48"
        )}>
          <ImageWithFallback
            src={entity.image_url}
            alt={entity.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            fallbackSrc={`https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=400&h=300&fit=crop&crop=center`}
          />
          
          {/* Type Badge */}
          <div className="absolute top-2 left-2">
            <Badge 
              variant="secondary" 
              className={`text-xs ${getTypeColor(entity.type)} flex items-center gap-1`}
            >
              <span>{getTypeEmoji(entity.type)}</span>
              {entity.type}
            </Badge>
          </div>
          
          {/* Stats Overlay */}
          {!compact && formatStats() && (
            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-black/75 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                {formatStats()}
              </div>
            </div>
          )}
        </div>
        
        <CardContent className={cn(
          "p-3 flex flex-col justify-between h-full",
          compact ? "space-y-1" : "space-y-2"
        )}>
          <div className="flex-1">
            <h3 className={cn(
              "font-semibold line-clamp-2 group-hover:text-primary transition-colors",
              compact ? "text-sm" : "text-base"
            )}>
              {entity.name}
            </h3>
            
            {entity.venue && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-3 h-3" />
                <span className="text-xs truncate">{entity.venue}</span>
              </div>
            )}
            
            {!compact && entity.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {entity.description}
              </p>
            )}
          </div>
          
          {compact && formatStats() && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>{formatStats()}</span>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
};
