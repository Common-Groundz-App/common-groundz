
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Entity } from '@/services/recommendation/types';
import { Users, ArrowRight, Book, Film, MapPin } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface EntityRelatedCardProps {
  entity: Entity;
}

export const EntityRelatedCard: React.FC<EntityRelatedCardProps> = ({ entity }) => {
  // For now, we'll show placeholder content since we don't have related entity logic yet
  // This component is prepared for future implementation

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'book':
        return <Book className="h-3 w-3" />;
      case 'movie':
        return <Film className="h-3 w-3" />;
      case 'place':
        return <MapPin className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const getRelatedSuggestions = () => {
    if (entity.type === 'book' && entity.authors && entity.authors.length > 0) {
      return {
        title: 'More by this Author',
        subtitle: `Other books by ${entity.authors[0]}`,
        icon: <Book className="h-4 w-4" />
      };
    }
    
    if (entity.type === 'movie' && entity.cast_crew?.director) {
      return {
        title: 'More by this Director',
        subtitle: `Other films by ${entity.cast_crew.director}`,
        icon: <Film className="h-4 w-4" />
      };
    }
    
    if (entity.type === 'place' && entity.specifications?.types) {
      const primaryType = entity.specifications.types[0]?.replace(/_/g, ' ');
      return {
        title: 'Similar Places',
        subtitle: `Other ${primaryType} nearby`,
        icon: <MapPin className="h-4 w-4" />
      };
    }

    return {
      title: 'Related Items',
      subtitle: 'Similar recommendations',
      icon: <Users className="h-4 w-4" />
    };
  };

  const relatedInfo = getRelatedSuggestions();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          {relatedInfo.icon}
          Related Entities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Placeholder for related content */}
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm font-medium">{relatedInfo.title}</div>
            <div className="text-xs">{relatedInfo.subtitle}</div>
            <div className="text-xs mt-2 opacity-75">Coming soon...</div>
          </div>
          
          {/* Future: This will be populated with actual related entities */}
          {/* Example structure for when we implement this:
          <div className="space-y-2">
            {relatedEntities.map((relatedEntity) => (
              <div key={relatedEntity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                  <ImageWithFallback
                    src={relatedEntity.image_url}
                    alt={relatedEntity.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{relatedEntity.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{relatedEntity.venue}</div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getEntityIcon(relatedEntity.type)}
                  <span className="ml-1">{relatedEntity.type}</span>
                </Badge>
              </div>
            ))}
          </div>
          */}
        </div>
      </CardContent>
    </Card>
  );
};
