
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Heart, Share2, Bookmark, TrendingUp } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityV3SidebarProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3Sidebar: React.FC<EntityV3SidebarProps> = ({ entity, stats }) => {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" variant="default">
            <Star className="h-4 w-4 mr-2" />
            Write Review
          </Button>
          <Button className="w-full" variant="outline">
            <Heart className="h-4 w-4 mr-2" />
            Add to Favorites
          </Button>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button className="flex-1" variant="outline" size="sm">
              <Bookmark className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rating Summary */}
      {stats && stats.averageRating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rating Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div className="text-3xl font-bold">{stats.averageRating.toFixed(1)}</div>
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(stats.averageRating!) 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Based on {stats.reviewCount} reviews
              </div>
            </div>
            
            {/* Rating Distribution - Placeholder */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3">{star}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full" 
                      style={{ width: `${Math.random() * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Type</div>
            <Badge variant="secondary" className="capitalize">
              {entity.type}
            </Badge>
          </div>
          
          {entity.venue && (
            <div>
              <div className="text-sm font-medium mb-1">Location</div>
              <div className="text-sm text-muted-foreground">{entity.venue}</div>
            </div>
          )}
          
          {entity.website_url && (
            <div>
              <div className="text-sm font-medium mb-1">Website</div>
              <a 
                href={entity.website_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Visit Website
              </a>
            </div>
          )}
          
          {entity.is_verified && (
            <div>
              <div className="text-sm font-medium mb-1">Status</div>
              <Badge variant="default">Verified</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Status */}
      {entity.trending_score && entity.trending_score > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              This entity is currently trending with a score of {entity.trending_score.toFixed(1)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
