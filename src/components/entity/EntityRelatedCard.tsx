
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

  const getEntityTypeStyles = (type: string) => {
    switch (type) {
      case 'book':
        return {
          cardBg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
          badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
          iconColor: 'text-amber-600'
        };
      case 'movie':
        return {
          cardBg: 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200',
          badgeBg: 'bg-gradient-to-r from-red-500 to-pink-500',
          iconColor: 'text-red-600'
        };
      case 'place':
        return {
          cardBg: 'bg-gradient-to-br from-green-50 to-teal-50 border-green-200',
          badgeBg: 'bg-gradient-to-r from-green-500 to-teal-500',
          iconColor: 'text-green-600'
        };
      default:
        return {
          cardBg: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200',
          badgeBg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
          iconColor: 'text-blue-600'
        };
    }
  };

  const getRelatedSuggestions = () => {
    if (entity.type === 'book' && entity.authors && entity.authors.length > 0) {
      return {
        title: 'More by this Author',
        subtitle: `Other books by ${entity.authors[0]}`,
        icon: <Book className="h-8 w-8" />
      };
    }
    
    if (entity.type === 'movie' && entity.cast_crew?.director) {
      return {
        title: 'More by this Director',
        subtitle: `Other films by ${entity.cast_crew.director}`,
        icon: <Film className="h-8 w-8" />
      };
    }
    
    if (entity.type === 'place' && entity.specifications?.types) {
      const primaryType = entity.specifications.types[0]?.replace(/_/g, ' ');
      return {
        title: 'Similar Places',
        subtitle: `Other ${primaryType} nearby`,
        icon: <MapPin className="h-8 w-8" />
      };
    }

    return {
      title: 'Related Items',
      subtitle: 'Similar recommendations',
      icon: <Users className="h-8 w-8" />
    };
  };

  const relatedInfo = getRelatedSuggestions();
  const styles = getEntityTypeStyles(entity.type);

  return (
    <Card className={styles.cardBg}>
      <CardContent className="p-6 text-center relative">
        <Badge className={`absolute top-2 right-2 ${styles.badgeBg} text-white border-0`}>
          Coming Soon
        </Badge>
        <div className={`${styles.iconColor} mx-auto mb-3`}>
          {relatedInfo.icon}
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {relatedInfo.title}
        </h3>
        <p className="text-sm text-gray-600">
          {relatedInfo.subtitle}
        </p>
        
        {/* Future: This will be populated with actual related entities */}
        {/* Example structure for when we implement this:
        <div className="space-y-2 mt-4">
          {relatedEntities.map((relatedEntity) => (
            <div key={relatedEntity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 cursor-pointer">
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
      </CardContent>
    </Card>
  );
};
