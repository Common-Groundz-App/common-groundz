
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';

export function PopularRecommendations() {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['popular-recommendations'],
    queryFn: async () => {
      // First get recommendations with most likes
      const { data: recommendationsData, error: recommendationsError } = await supabase
        .from('recommendations')
        .select(`
          id,
          title,
          description,
          entity_id,
          category,
          rating,
          user_id,
          recommendation_likes(count)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (recommendationsError) throw recommendationsError;
      
      // Sort by like count
      const sorted = (recommendationsData || [])
        .sort((a, b) => {
          const aLikes = a.recommendation_likes?.[0]?.count || 0;
          const bLikes = b.recommendation_likes?.[0]?.count || 0;
          return bLikes - aLikes;
        })
        .slice(0, 6);
      
      // Get profile data and entity data for the top recommendations
      if (sorted.length > 0) {
        const userIds = [...new Set(sorted.map(r => r.user_id))];
        const entityIds = [...new Set(sorted.map(r => r.entity_id).filter(Boolean))];
        
        const [profilesResult, entitiesResult] = await Promise.all([
          supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
          entityIds.length > 0 
            ? supabase.from('entities').select('id, name, image_url, venue, slug').in('id', entityIds)
            : Promise.resolve({ data: [], error: null })
        ]);
        
        // Create lookup maps
        const profilesMap = (profilesResult.data || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
        
        const entitiesMap = (entitiesResult.data || []).reduce((acc, entity) => {
          acc[entity.id] = entity;
          return acc;
        }, {} as Record<string, any>);
        
        // Merge data
        return sorted.map(recommendation => ({
          ...recommendation,
          profile: profilesMap[recommendation.user_id] || null,
          entity: recommendation.entity_id ? entitiesMap[recommendation.entity_id] || null : null,
        }));
      }
      
      return [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Popular Recommendations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-32 w-full rounded-md" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Popular Recommendations</h2>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {recommendations.map((recommendation) => (
            <CarouselItem key={recommendation.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3">
              <Link to={`/recommendations/${recommendation.id}`}>
                <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
                  {recommendation.entity?.image_url && (
                    <div className="relative h-36 bg-muted">
                      <img 
                        src={recommendation.entity.image_url} 
                        alt={recommendation.entity.name} 
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="lowercase">
                          {recommendation.category}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium line-clamp-1">{recommendation.title}</h4>
                      {recommendation.entity && (
                        <p className="text-sm text-muted-foreground truncate">
                          {recommendation.entity.name}{recommendation.entity.venue ? ` • ${recommendation.entity.venue}` : ''}
                        </p>
                      )}
                      <div className="flex justify-center py-1">
                        <ConnectedRingsRating 
                          rating={recommendation.rating} 
                          size="sm"
                          readOnly 
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={recommendation.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {recommendation.profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {recommendation.profile?.username || 'Anonymous'}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </div>
  );
}
