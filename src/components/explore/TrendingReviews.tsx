
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Star } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';

export function TrendingReviews() {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['trending-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          entities(name, slug, venue, type)
        `)
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;

      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(review => review.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        // Create a map of profiles
        const profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);

        // Merge profiles with reviews
        return data.map(review => ({
          ...review,
          profiles: profilesMap[review.user_id] || null
        }));
      }
      
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Latest Reviews</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, index) => (
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

  if (!reviews || reviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Latest Reviews</h2>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {reviews.map((review) => (
            <CarouselItem key={review.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/2">
              <Link to={`/reviews/${review.id}`}>
                <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
                  {review.image_url && (
                    <div className="aspect-video relative bg-muted">
                      <img 
                        src={review.image_url} 
                        alt={review.title} 
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{review.rating}</span>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h4 className="font-medium line-clamp-1">{review.title}</h4>
                    {review.entities && (
                      <p className="text-sm text-muted-foreground truncate">
                        {review.entities.name}{review.entities.venue ? ` • ${review.entities.venue}` : ''}
                      </p>
                    )}
                    {review.description && (
                      <p className="text-sm line-clamp-2 mt-2">{review.description}</p>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <div className="flex items-center gap-2">
                      <UserAvatar 
                        username={review.profiles?.username || 'Anonymous'} 
                        imageUrl={review.profiles?.avatar_url} 
                        className="h-6 w-6"
                      />
                      <span className="text-xs text-muted-foreground">
                        {review.profiles?.username || 'Anonymous'}
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
