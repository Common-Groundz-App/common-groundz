
import React, { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, Users, Sparkles } from 'lucide-react';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { useEnhancedExplore } from '@/hooks/use-enhanced-explore';
import { useDiscovery } from '@/hooks/use-discovery';
import { PersonalizedEntity } from '@/services/enhancedExploreService';
import { useAuth } from '@/contexts/AuthContext';

export const FeaturedEntities = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    featuredEntities, 
    isLoading: exploreLoading, 
    trackEntityInteraction, 
    lastRefresh 
  } = useEnhancedExplore({
    limit: 3,
    trackInteractions: true,
    enableTemporalPersonalization: true
  });

  const {
    forYou,
    newThisWeek,
    isLoading: discoveryLoading,
    lastRefresh: discoveryRefresh
  } = useDiscovery({
    autoRefresh: true
  });

  const isLoading = exploreLoading || discoveryLoading;

  const handleEntityClick = async (entity: PersonalizedEntity) => {
    // Enhanced interaction tracking with entity type as category
    await trackEntityInteraction(
      entity.id,
      entity.type,
      entity.type,
      'click'
    );
    
    navigate(`/entity/${entity.id}`);
  };

  const getReasonIcon = (reason?: string) => {
    if (!reason) return null;
    
    if (reason.includes('trending') || reason.includes('Rapidly')) {
      return <TrendingUp className="h-3 w-3" />;
    }
    if (reason.includes('schedule') || reason.includes('season') || reason.includes('morning') || reason.includes('tonight')) {
      return <Clock className="h-3 w-3" />;
    }
    if (reason.includes('Friends') || reason.includes('social') || reason.includes('Curated for you')) {
      return <Users className="h-3 w-3" />;
    }
    if (reason.includes('New')) {
      return <Sparkles className="h-3 w-3" />;
    }
    return null;
  };

  const getReasonColor = (reason?: string) => {
    if (!reason) return 'bg-brand-orange/90';
    
    if (reason.includes('trending') || reason.includes('Rapidly')) {
      return 'bg-red-500/90';
    }
    if (reason.includes('interests') || reason.includes('Curated for you')) {
      return 'bg-blue-500/90';
    }
    if (reason.includes('schedule') || reason.includes('season') || reason.includes('morning') || reason.includes('tonight')) {
      return 'bg-green-500/90';
    }
    if (reason.includes('area') || reason.includes('nearby')) {
      return 'bg-purple-500/90';
    }
    if (reason.includes('New') || reason.includes('Fresh')) {
      return 'bg-emerald-500/90';
    }
    if (reason.includes('Friends') || reason.includes('social')) {
      return 'bg-indigo-500/90';
    }
    return 'bg-brand-orange/90';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Featured</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Use enhanced discovery data if available and user is logged in
  const displayEntities = user && forYou.length > 0 ? forYou.slice(0, 3) : 
                         featuredEntities.length > 0 ? featuredEntities : 
                         newThisWeek.slice(0, 3);

  const sectionTitle = user && forYou.length > 0 ? 'For You' : 
                      featuredEntities.length > 0 ? 'Featured' : 
                      'New This Week';

  if (displayEntities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {user && forYou.length > 0 && <Users className="h-5 w-5 text-blue-500" />}
          {!user || forYou.length === 0 && featuredEntities.length === 0 && <Sparkles className="h-5 w-5 text-emerald-500" />}
          <h2 className="text-xl font-semibold mb-4">{sectionTitle}</h2>
        </div>
        {(lastRefresh || discoveryRefresh) && (
          <span className="text-xs text-muted-foreground">
            Updated {(discoveryRefresh || lastRefresh)?.toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayEntities.map((entity) => (
          <Card 
            key={entity.id}
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleEntityClick(entity)}
          >
            <div className="h-48 relative">
              <ImageWithFallback
                src={entity.image_url || ''}
                alt={entity.name}
                className="h-full w-full object-cover"
                fallbackSrc="/placeholder.svg"
                entityType={entity.type}
              />
              <Badge className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur-sm">
                {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
              </Badge>
              {entity.reason && (
                <Badge className={`absolute top-2 left-2 ${getReasonColor(entity.reason)} text-white backdrop-blur-sm text-xs flex items-center gap-1`}>
                  {getReasonIcon(entity.reason)}
                  {entity.reason}
                </Badge>
              )}
              {entity.view_velocity && entity.view_velocity > 5 && (
                <Badge className="absolute bottom-2 left-2 bg-red-500/90 text-white backdrop-blur-sm text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Hot
                </Badge>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg truncate">{entity.name}</h3>
              {entity.venue && (
                <p className="text-sm text-muted-foreground truncate">{entity.venue}</p>
              )}
              <div className="flex items-center mt-2">
                <div className="flex items-center gap-1">
                  {entity.averageRating && entity.reviewCount > 0 ? (
                    <>
                      <RatingRingIcon 
                        rating={entity.averageRating} 
                        size={12} 
                      />
                      <span className="text-xs font-medium" style={{ color: getSentimentColor(entity.averageRating) }}>
                        {entity.averageRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({entity.reviewCount} review{entity.reviewCount !== 1 ? 's' : ''})
                      </span>
                    </>
                  ) : (
                    <>
                      <RatingRingIcon 
                        rating={0} 
                        size={12} 
                      />
                      <span className="text-xs text-muted-foreground">No ratings yet</span>
                    </>
                  )}
                </div>
              </div>
              {entity.personalization_score && entity.personalization_score > 10 && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    Highly Personalized
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
