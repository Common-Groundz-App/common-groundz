
import React from 'react';
import { Clock, MapPin, Mail, Phone, Globe, Users, Star, Award, ArrowRight } from "lucide-react";
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Entity } from '@/services/recommendation/types';
import { EntitySuggestionButton } from './EntitySuggestionButton';
import { ClaimBusinessButton } from './ClaimBusinessButton';
import { EntityMetadataCard, hasMetadataContent } from '@/components/entity/EntityMetadataCard';
import { EntitySpecsCard } from '@/components/entity/EntitySpecsCard';
import { EntityRelatedCard } from '@/components/entity/EntityRelatedCard';
import { EntityChildrenCard } from '@/components/entity/EntityChildrenCard';
import { useRelatedEntities } from '@/hooks/use-related-entities';
import { useNavigate } from 'react-router-dom';
import { getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { 
  shouldShowBusinessHours, 
  shouldShowContactInfo, 
  extractBusinessHours, 
  extractContactInfo, 
  formatBusinessHours,
  getRelatedSectionTitle 
} from '@/utils/entitySidebarLogic';

interface EntitySidebarProps {
  entity: Entity;
  childEntities?: Entity[];
  isLoadingChildren?: boolean;
  onViewChild?: (child: Entity) => void;
  parentEntity?: Entity | null;
  isLoadingParent?: boolean;
}

export const EntitySidebar: React.FC<EntitySidebarProps> = ({ 
  entity, 
  childEntities = [],
  isLoadingChildren = false,
  onViewChild,
  parentEntity = null,
  isLoadingParent = false
}) => {
  const navigate = useNavigate();
  const contactInfo = extractContactInfo(entity);
  const businessHours = extractBusinessHours(entity);
  const formattedHours = formatBusinessHours(businessHours);
  
  // Dynamic Related Entities
  const { relatedEntities, isLoading } = useRelatedEntities({
    entityId: entity.id,
    entityType: entity.type as any,
    parentId: entity.parent_id,
    limit: 3
  });

  const handleEntityClick = (relatedEntity: Entity) => {
    if (relatedEntity.slug) {
      navigate(getEntityUrlWithParent(relatedEntity));
    }
  };

  const shouldShowMetadata = (entity: Entity): boolean => {
    // Show metadata for books, movies, places, and products
    return ['book', 'movie', 'place', 'product'].includes(entity.type);
  };

  const shouldShowSpecs = (entity: Entity): boolean => {
    // Show specs for food, products, and movies
    return ['food', 'product', 'movie'].includes(entity.type);
  };

  return (
    <div className="space-y-6 sticky top-8">
      {/* Business Hours - Only show for relevant entity types with data */}
      {shouldShowBusinessHours(entity) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {formattedHours.map(({ day, hours, isOpen }) => (
                <div key={day} className="grid grid-cols-[80px_1fr] gap-3">
                  <span className="font-medium">{day}</span>
                  <div className="space-y-1">
                    {hours.map((timeRange, index) => (
                      <div 
                        key={index}
                        className={isOpen ? "text-green-600 font-medium" : "text-red-600 font-medium"}
                      >
                        {timeRange}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Part of - Parent Entity */}
      {parentEntity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Part of</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
              onClick={() => navigate(getEntityUrlWithParent(parentEntity))}
            >
              <ImageWithFallback
                src={parentEntity.image_url}
                alt={parentEntity.name}
                fallbackSrc={getEntityTypeFallbackImage(parentEntity.type)}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {parentEntity.name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {getEntityTypeLabel(parentEntity.type)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Information - Only show if any contact info is available */}
      {shouldShowContactInfo(entity) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactInfo.location && (
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm break-words min-w-0">{contactInfo.location}</span>
              </div>
            )}
            {contactInfo.email && (
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-all min-w-0">{contactInfo.email}</span>
              </div>
            )}
            {contactInfo.phone && (
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-words min-w-0">{contactInfo.phone}</span>
              </div>
            )}
            {contactInfo.website && (
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <a 
                  href={contactInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm break-all min-w-0 text-blue-600 hover:underline cursor-pointer"
                >
                  {contactInfo.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* About Section - Always show */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 leading-relaxed">
              {entity.description ? (
                <RichTextDisplay content={entity.description} />
              ) : (
                <p>No description available for this entity. Help improve our database by suggesting an edit.</p>
              )}
            </div>
            
            {/* Attribution for Google-sourced descriptions */}
            {entity.description && (entity as any).about_source === 'google_editorial' && (
              <p className="text-xs text-gray-500 italic">
                Source: Google
              </p>
            )}
            
            <EntitySuggestionButton entity={entity} />
            
            <ClaimBusinessButton entity={entity} />
          </div>
        </CardContent>
      </Card>

      {/* Related Products - Child Entities */}
      {childEntities.length > 0 && (
        <EntityChildrenCard
          children={childEntities}
          parentName={entity.name}
          parentEntity={entity}
          isLoading={isLoadingChildren}
          onViewChild={onViewChild}
        />
      )}

      {/* Entity Metadata - Type-Specific Details */}
      {shouldShowMetadata(entity) && hasMetadataContent(entity) && (
        <EntityMetadataCard entity={entity} />
      )}

      {/* Entity Specifications - Technical Details */}
      {shouldShowSpecs(entity) && (
        <EntitySpecsCard entity={entity} />
      )}

      {/* Related Entities - Author/Director based */}
      <EntityRelatedCard entity={entity} />

      {/* Related Entities */}
      {relatedEntities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{getRelatedSectionTitle(entity.type)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading related entities...</div>
              ) : (
                relatedEntities.map((relatedEntity, index) => (
                  <div 
                    key={relatedEntity.id || index} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleEntityClick(relatedEntity)}
                  >
                    <img 
                      src={relatedEntity.image_url || '/placeholder.svg'} 
                      alt={relatedEntity.name} 
                      className="w-8 h-8 rounded object-cover" 
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{relatedEntity.name}</h4>
                      <div className="text-xs text-muted-foreground">
                        {getEntityTypeLabel(relatedEntity.type)}
                      </div>
                      {(relatedEntity as any).reviewCount > 0 ? (
                        <div className="flex items-center gap-1 mt-1">
                          <RatingRingIcon 
                            rating={(relatedEntity as any).avgRating} 
                            size={12} 
                          />
                          <span 
                            className="text-xs font-medium"
                            style={{ color: getSentimentColor((relatedEntity as any).avgRating, true) }}
                          >
                            {(relatedEntity as any).avgRating.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({(relatedEntity as any).reviewCount} review{(relatedEntity as any).reviewCount !== 1 ? 's' : ''})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1">
                          <RatingRingIcon 
                            rating={0} 
                            size={12} 
                          />
                          <span className="text-xs text-muted-foreground">
                            No ratings yet
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Talk to Circle */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4 text-center relative">
          <Badge 
            className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium border-0 hover:from-purple-600 hover:to-pink-600"
          >
            Coming Soon
          </Badge>
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900 mb-2">Talk to Someone in Your Circle</h3>
          <p className="text-sm text-gray-600 mb-3">Connect with people who have experience with {entity.name}</p>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            Find Connections
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
