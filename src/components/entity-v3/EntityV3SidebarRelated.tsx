
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, Users, Eye } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface RelatedEntity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  similarity_score: number;
  view_count: number;
  trending_score?: number;
}

interface EntityV3SidebarRelatedProps {
  entity: Entity;
  relatedEntities?: RelatedEntity[];
  isLoading?: boolean;
}

export const EntityV3SidebarRelated: React.FC<EntityV3SidebarRelatedProps> = ({
  entity,
  relatedEntities = [],
  isLoading = false
}) => {
  // Mock data for demonstration
  const mockRelated: RelatedEntity[] = [
    {
      id: '1',
      name: 'Sadhguru Sannidhi',
      type: 'spiritual_center',
      image_url: '/api/placeholder/60/60',
      similarity_score: 0.85,
      view_count: 1250,
      trending_score: 7.2
    },
    {
      id: '2',
      name: 'Art of Living Ashram',
      type: 'spiritual_center',
      image_url: '/api/placeholder/60/60',
      similarity_score: 0.78,
      view_count: 890,
      trending_score: 6.8
    },
    {
      id: '3',
      name: 'Brahmarshi Subhash Patri Ashram',
      type: 'spiritual_center',
      image_url: '/api/placeholder/60/60',
      similarity_score: 0.72,
      view_count: 654,
      trending_score: 5.9
    }
  ];

  const displayEntities = relatedEntities.length > 0 ? relatedEntities : mockRelated;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Places</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-12 h-12 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          People Also Viewed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayEntities.map((relatedEntity) => (
          <div
            key={relatedEntity.id}
            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="relative">
              <img
                src={relatedEntity.image_url || '/api/placeholder/60/60'}
                alt={relatedEntity.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              {relatedEntity.trending_score && relatedEntity.trending_score > 6 && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1">
                  <TrendingUp className="h-3 w-3" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {relatedEntity.name}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {relatedEntity.type.replace('_', ' ')}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {relatedEntity.view_count.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {Math.round(relatedEntity.similarity_score * 100)}% similar
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        ))}
        
        <button className="w-full text-sm text-primary hover:text-primary/80 transition-colors py-2 text-center border-t pt-3">
          View All Similar Places
        </button>
      </CardContent>
    </Card>
  );
};
