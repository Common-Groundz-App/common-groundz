
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Entity, EntityType } from '@/services/recommendation/types';
import { Utensils, Zap, Package2 } from 'lucide-react';

interface EntitySpecsCardProps {
  entity: Entity;
}

export const EntitySpecsCard: React.FC<EntitySpecsCardProps> = ({ entity }) => {
  const renderFoodSpecs = () => {
    if (!entity.ingredients && !entity.nutritional_info) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            Food Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entity.ingredients && entity.ingredients.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Ingredients</div>
              <div className="flex flex-wrap gap-1">
                {entity.ingredients.map((ingredient, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {ingredient}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {entity.nutritional_info && Object.keys(entity.nutritional_info).length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Nutrition Facts</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(entity.nutritional_info).map(([key, value]) => {
                  if (!value) return null;
                  return (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderProductSpecs = () => {
    if (!entity.specifications || Object.keys(entity.specifications).length === 0) return null;

    const importantSpecs = ['dimensions', 'weight', 'color', 'material', 'warranty'];
    const specsToShow = Object.entries(entity.specifications).filter(([key]) => 
      importantSpecs.includes(key.toLowerCase())
    );

    if (specsToShow.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Package2 className="h-4 w-4" />
            Specifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {specsToShow.map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-right">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMovieSpecs = () => {
    if (!entity.specifications || Object.keys(entity.specifications).length === 0) return null;

    const movieSpecs = ['budget', 'revenue', 'production_companies'];
    const specsToShow = Object.entries(entity.specifications).filter(([key]) => 
      movieSpecs.includes(key.toLowerCase())
    );

    if (specsToShow.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Production Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {specsToShow.map(([key, value]) => {
              let displayValue = value;
              
              if (key === 'budget' || key === 'revenue') {
                displayValue = typeof value === 'number' 
                  ? `$${(value / 1000000).toFixed(1)}M`
                  : value;
              } else if (Array.isArray(value)) {
                displayValue = value.join(', ');
              }
              
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-right">{displayValue}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render based on entity type - updated for new enum values
  switch (entity.type) {
    case EntityType.Product:
      return renderProductSpecs();
    case EntityType.Movie:
    case EntityType.TvShow:
      return renderMovieSpecs();
    default:
      return null;
  }
};
