
import React from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NetworkRecommendationsProps {
  entityId: string;
  userFollowingIds: string[];
}

interface RecommendationEntity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
}

export const NetworkRecommendations: React.FC<NetworkRecommendationsProps> = ({
  entityId,
  userFollowingIds
}) => {
  const { user } = useAuth();

  const { data: recommendations = [] } = useQuery({
    queryKey: ['network-recommendations', entityId, userFollowingIds],
    queryFn: async (): Promise<RecommendationEntity[]> => {
      // If user has no following, return popular entities
      if (!user || userFollowingIds.length === 0) {
        const { data: popularEntities } = await supabase
          .from('entities')
          .select(`
            id,
            name,
            type,
            image_url,
            recommendations(rating)
          `)
          .neq('id', entityId)
          .eq('is_deleted', false)
          .limit(3);

        return popularEntities?.map(entity => ({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          image_url: entity.image_url,
          averageRating: entity.recommendations?.length > 0 
            ? entity.recommendations.reduce((sum, r) => sum + r.rating, 0) / entity.recommendations.length
            : 0,
          recommendedBy: []
        })) || [];
      }

      // Get entities recommended by followed users
      const { data: networkEntities } = await supabase
        .from('entities')
        .select(`
          id,
          name,
          type,
          image_url,
          recommendations!inner(
            user_id,
            rating,
            profiles(username)
          )
        `)
        .neq('id', entityId)
        .eq('is_deleted', false)
        .in('recommendations.user_id', userFollowingIds)
        .gte('recommendations.rating', 4)
        .limit(6);

      if (!networkEntities) return [];

      // Group by entity and calculate metrics
      const entityMap = new Map<string, RecommendationEntity>();
      
      networkEntities.forEach(entity => {
        const recommendation = entity.recommendations?.[0];
        const username = recommendation?.profiles?.username || 'Someone';
        
        if (!entityMap.has(entity.id)) {
          entityMap.set(entity.id, {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            image_url: entity.image_url,
            averageRating: recommendation?.rating || 0,
            recommendedBy: [username]
          });
        } else {
          const existing = entityMap.get(entity.id)!;
          existing.recommendedBy.push(username);
          existing.averageRating = Math.max(existing.averageRating, recommendation?.rating || 0);
        }
      });

      return Array.from(entityMap.values()).slice(0, 3);
    },
    enabled: true,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const fallbackEntities = [
    {
      name: "HealthifyMe",
      type: "Health Apps",
      averageRating: 4.2,
      image_url: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=100&h=100&fit=crop",
      recommendedBy: []
    },
    {
      name: "MyFitnessPal", 
      type: "Fitness Apps",
      averageRating: 4.0,
      image_url: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=100&h=100&fit=crop",
      recommendedBy: []
    },
    {
      name: "Optimum Nutrition",
      type: "Supplements", 
      averageRating: 4.5,
      image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop",
      recommendedBy: []
    }
  ];

  const displayEntities = recommendations.length > 0 ? recommendations : fallbackEntities;
  const hasNetworkRecommendations = recommendations.length > 0 && userFollowingIds.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {hasNetworkRecommendations ? "Recommended by Your Network" : "You Might Also Consider"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayEntities.map((entity, index) => (
            <div key={entity.id || index} className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <img 
                src={entity.image_url} 
                alt={entity.name} 
                className="w-12 h-12 rounded-lg object-cover" 
              />
              <div className="flex-1">
                <h4 className="font-medium">{entity.name}</h4>
                <p className="text-sm text-gray-500">{entity.type}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{entity.averageRating.toFixed(1)}</span>
                </div>
                {entity.recommendedBy.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Recommended by {entity.recommendedBy.slice(0, 2).join(', ')}
                    {entity.recommendedBy.length > 2 && ` +${entity.recommendedBy.length - 2} others`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
