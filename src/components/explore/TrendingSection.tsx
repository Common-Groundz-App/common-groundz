
import React from 'react';
import { TrendingUp, Eye, Heart, Star as StarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from './ProductCard';

interface TrendingEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  image_url: string;
  venue?: string;
  trending_score: number;
  recent_views_24h: number;
  recent_likes_24h: number;
  recent_recommendations_24h: number;
}

interface TrendingSectionProps {
  entities: TrendingEntity[];
  onEntityView: (entityId: string, entityType: string) => void;
  title?: string;
  description?: string;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  entities,
  onEntityView,
  title = "Trending Now",
  description = "Popular entities gaining traction"
}) => {
  if (!entities.length) return null;

  const getTrendingLabel = (entity: TrendingEntity) => {
    if (entity.recent_recommendations_24h > 5) return { label: 'Hot', color: 'bg-red-100 text-red-800' };
    if (entity.recent_views_24h > 20) return { label: 'Popular', color: 'bg-orange-100 text-orange-800' };
    if (entity.trending_score > 10) return { label: 'Rising', color: 'bg-green-100 text-green-800' };
    return { label: 'Trending', color: 'bg-blue-100 text-blue-800' };
  };

  const formatTrendingStats = (entity: TrendingEntity) => {
    const stats = [];
    if (entity.recent_views_24h > 0) stats.push(`${entity.recent_views_24h} views`);
    if (entity.recent_likes_24h > 0) stats.push(`${entity.recent_likes_24h} likes`);
    if (entity.recent_recommendations_24h > 0) stats.push(`${entity.recent_recommendations_24h} recs`);
    return stats.join(' • ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {entities.map((entity, index) => {
          const trendingInfo = getTrendingLabel(entity);
          const stats = formatTrendingStats(entity);
          
          return (
            <div key={entity.id} className="relative">
              <ProductCard
                entity={entity}
                onClick={() => onEntityView(entity.id, entity.type)}
              />
              
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {index < 3 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                    #{index + 1}
                  </Badge>
                )}
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${trendingInfo.color}`}
                >
                  {trendingInfo.label}
                </Badge>
              </div>
              
              {stats && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-black/75 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {stats}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
