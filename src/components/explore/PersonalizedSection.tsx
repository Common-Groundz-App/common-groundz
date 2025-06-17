
import React from 'react';
import { Star, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from './ProductCard';
import type { PersonalizedEntity } from '@/services/exploreService';

interface PersonalizedSectionProps {
  entities: any[];
  personalizedData: PersonalizedEntity[];
  onEntityView: (entityId: string, entityType: string) => void;
  title?: string;
  description?: string;
}

export const PersonalizedSection: React.FC<PersonalizedSectionProps> = ({
  entities,
  personalizedData,
  onEntityView,
  title = "For You",
  description = "Personalized recommendations based on your interests"
}) => {
  if (!entities.length) return null;

  const getReasonIcon = (reason: string) => {
    if (reason.includes('interests')) return <Star className="w-3 h-3" />;
    if (reason.includes('follow')) return <Users className="w-3 h-3" />;
    return <TrendingUp className="w-3 h-3" />;
  };

  const getReasonColor = (reason: string) => {
    if (reason.includes('interests')) return 'bg-blue-100 text-blue-800';
    if (reason.includes('follow')) return 'bg-green-100 text-green-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {entities.map((entity) => {
          const personalizedInfo = personalizedData.find(p => p.entity_id === entity.id);
          
          return (
            <div key={entity.id} className="relative">
              <ProductCard
                entity={entity}
                onClick={() => onEntityView(entity.id, entity.type)}
              />
              {personalizedInfo && (
                <div className="absolute top-2 right-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs flex items-center gap-1 ${getReasonColor(personalizedInfo.reason)}`}
                  >
                    {getReasonIcon(personalizedInfo.reason)}
                    {personalizedInfo.reason.includes('interests') ? 'For You' :
                     personalizedInfo.reason.includes('follow') ? 'Friends' : 'Trending'}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
