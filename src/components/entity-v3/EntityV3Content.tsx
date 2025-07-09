
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Star, Info } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityV3ContentProps {
  entity: Entity;
  recommendations: any[];
  reviews: any[];
}

export const EntityV3Content: React.FC<EntityV3ContentProps> = ({ 
  entity, 
  recommendations, 
  reviews 
}) => {
  return (
    <div className="lg:col-span-1 space-y-6">
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Recommendations ({recommendations.length})
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Reviews ({reviews.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">About {entity.name}</h3>
                {entity.description ? (
                  <p className="text-muted-foreground leading-relaxed">
                    {entity.description}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">
                    No description available yet.
                  </p>
                )}
                
                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div>
                    <h4 className="font-medium mb-2">Type</h4>
                    <p className="text-sm text-muted-foreground capitalize">{entity.type}</p>
                  </div>
                  
                  {entity.venue && (
                    <div>
                      <h4 className="font-medium mb-2">Location</h4>
                      <p className="text-sm text-muted-foreground">{entity.venue}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="recommendations" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recommendations</h3>
                {recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.slice(0, 3).map((rec, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < rec.rating 
                                    ? 'fill-yellow-400 text-yellow-400' 
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {rec.rating}/5
                          </span>
                        </div>
                        <h4 className="font-medium mb-1">{rec.title}</h4>
                        {rec.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {rec.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No recommendations yet. Be the first to recommend this!
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Reviews</h3>
                {reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.slice(0, 3).map((review, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating 
                                    ? 'fill-yellow-400 text-yellow-400' 
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {review.rating}/5
                          </span>
                        </div>
                        <h4 className="font-medium mb-1">{review.title}</h4>
                        {review.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {review.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No reviews yet. Be the first to review this!
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
