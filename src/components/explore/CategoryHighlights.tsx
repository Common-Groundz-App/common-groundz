
import React, { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Gem, Clock, Users, Sparkles } from 'lucide-react';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { useEnhancedExplore } from '@/hooks/use-enhanced-explore';
import { useDiscovery } from '@/hooks/use-discovery';
import { PersonalizedEntity } from '@/services/enhancedExploreService';
import { EntityTypeString } from '@/hooks/feed/api/types';

interface CategoryHighlightsProps {
  entityType?: EntityTypeString;
}

export const CategoryHighlights: React.FC<CategoryHighlightsProps> = ({ entityType }) => {
  const navigate = useNavigate();
  const { 
    trendingEntities, 
    hiddenGems, 
    curatedCollections, 
    isLoading: exploreLoading, 
    trackEntityInteraction 
  } = useEnhancedExplore({
    category: entityType,
    limit: 6,
    trackInteractions: true
  });

  const {
    discoveryCollections,
    newThisWeek,
    forYou,
    isLoading: discoveryLoading
  } = useDiscovery({
    autoRefresh: true,
    refreshInterval: 15 * 60 * 1000 // Refresh every 15 minutes
  });

  const isLoading = exploreLoading || discoveryLoading;

  const handleEntityClick = async (entity: PersonalizedEntity) => {
    // Track the interaction
    await trackEntityInteraction(
      entity.id,
      entity.type,
      entity.type,
      'click'
    );
    
    navigate(`/entity/${entity.id}`);
  };

  const getIconForCollectionType = (type: string) => {
    switch (type) {
      case 'new': return Clock;
      case 'social': return Users;
      case 'contextual': return Clock;
      case 'location': return TrendingUp;
      case 'mood': return Sparkles;
      default: return TrendingUp;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!entityType && <h2 className="text-xl font-semibold mb-4">Discover</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <div className="p-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // If a specific entity type is provided, show trending + hidden gems for that type
  if (entityType) {
    const allEntities = [...trendingEntities, ...hiddenGems];
    
    if (allEntities.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">No items found for this category.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Trending Section */}
        {trendingEntities.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Trending Now</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {trendingEntities.slice(0, 3).map((entity) => (
                <Card 
                  key={entity.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleEntityClick(entity)}
                >
                  <div className="h-32 relative">
                    <ImageWithFallback
                      src={entity.image_url || ''}
                      alt={entity.name}
                      className="h-full w-full object-cover"
                      fallbackSrc="/placeholder.svg"
                      entityType={entity.type}
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                    {entity.venue && (
                      <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                    )}
                    <div className="flex items-center mt-1">
                      <div className="flex items-center gap-1">
                        {entity.averageRating && entity.reviewCount > 0 ? (
                          <>
                            <RatingRingIcon 
                              rating={entity.averageRating} 
                              size={10} 
                            />
                            <span className="text-xs font-medium" style={{ color: getSentimentColor(entity.averageRating) }}>
                              {entity.averageRating.toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({entity.reviewCount})
                            </span>
                          </>
                        ) : (
                          <>
                            <RatingRingIcon 
                              rating={0} 
                              size={10} 
                            />
                            <span className="text-xs text-muted-foreground">No ratings yet</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Hidden Gems Section */}
        {hiddenGems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gem className="h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-semibold">Hidden Gems</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {hiddenGems.slice(0, 3).map((entity) => (
                <Card 
                  key={entity.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleEntityClick(entity)}
                >
                  <div className="h-32 relative">
                    <ImageWithFallback
                      src={entity.image_url || ''}
                      alt={entity.name}
                      className="h-full w-full object-cover"
                      fallbackSrc="/placeholder.svg"
                      entityType={entity.type}
                    />
                    <Badge className="absolute top-1 right-1 bg-purple-500/90 text-white text-xs">
                      Hidden Gem
                    </Badge>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                    {entity.venue && (
                      <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                    )}
                    <div className="flex items-center mt-1">
                      <div className="flex items-center gap-1">
                        {entity.averageRating && entity.reviewCount > 0 ? (
                          <>
                            <RatingRingIcon 
                              rating={entity.averageRating} 
                              size={10} 
                            />
                            <span className="text-xs font-medium" style={{ color: getSentimentColor(entity.averageRating) }}>
                              {entity.averageRating.toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({entity.reviewCount})
                            </span>
                          </>
                        ) : (
                          <>
                            <RatingRingIcon 
                              rating={0} 
                              size={10} 
                            />
                            <span className="text-xs text-muted-foreground">No ratings yet</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // For the main view, show enhanced discovery sections
  const allSections = [
    // Discovery collections first
    ...discoveryCollections.map(collection => ({
      title: collection.title === 'For You' ? 'Discover More' : collection.title,
      entities: collection.entities.slice(0, 3),
      icon: getIconForCollectionType(collection.type),
      reason: collection.reason
    })),
    // Then traditional sections
    { title: 'Trending This Week', entities: trendingEntities.slice(0, 3), icon: TrendingUp, reason: 'Most popular right now' },
    { title: 'Hidden Gems', entities: hiddenGems.slice(0, 3), icon: Gem, reason: 'Highly rated discoveries' },
    // Curated collections last
    ...Object.entries(curatedCollections).map(([name, entities]) => ({
      title: name,
      entities: entities.slice(0, 3),
      icon: null,
      reason: 'Curated collection'
    }))
  ].filter(section => section.entities.length > 0);

  return (
    <div className="space-y-8">
      {allSections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {section.icon && <section.icon className="h-5 w-5 text-orange-500" />}
              <h2 className="text-lg font-semibold">{section.title}</h2>
            </div>
            <button 
              className="text-sm text-primary hover:underline"
              onClick={() => navigate('/explore')}
            >
              See all
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {section.entities.map((entity) => (
              <Card 
                key={entity.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleEntityClick(entity)}
              >
                <div className="h-32 relative">
                  <ImageWithFallback
                    src={entity.image_url || ''}
                    alt={entity.name}
                    className="h-full w-full object-cover"
                    fallbackSrc="/placeholder.svg"
                    entityType={entity.type}
                  />
                  {entity.is_hidden_gem && (
                    <Badge className="absolute top-1 right-1 bg-purple-500/90 text-white text-xs">
                      Hidden Gem
                    </Badge>
                  )}
                  {entity.reason && entity.reason.includes('New') && (
                    <Badge className="absolute top-1 left-1 bg-green-500/90 text-white text-xs">
                      New
                    </Badge>
                  )}
                  {entity.reason && entity.reason.includes('Friends') && (
                    <Badge className="absolute top-1 left-1 bg-blue-500/90 text-white text-xs">
                      Social
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                  {entity.venue && (
                    <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                  )}
                  <div className="flex items-center mt-1">
                    <div className="flex items-center gap-1">
                      {entity.averageRating && entity.reviewCount > 0 ? (
                        <>
                          <RatingRingIcon 
                            rating={entity.averageRating} 
                            size={10} 
                          />
                          <span className="text-xs font-medium" style={{ color: getSentimentColor(entity.averageRating) }}>
                            {entity.averageRating.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({entity.reviewCount})
                          </span>
                        </>
                      ) : (
                        <>
                          <RatingRingIcon 
                            rating={0} 
                            size={10} 
                          />
                          <span className="text-xs text-muted-foreground">No ratings yet</span>
                        </>
                      )}
                    </div>
                  </div>
                  {entity.reason && (
                    <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                      {entity.reason}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
