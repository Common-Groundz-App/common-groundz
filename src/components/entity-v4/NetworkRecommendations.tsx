
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getNetworkBasedRecommendations, NetworkRecommendation } from '@/services/networkRecommendationService';

interface NetworkRecommendationsProps {
  entityId: string;
  userFollowingIds: string[];
}

export const NetworkRecommendations: React.FC<NetworkRecommendationsProps> = ({
  entityId,
  userFollowingIds
}) => {
  const [recommendations, setRecommendations] = useState<NetworkRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const recs = await getNetworkBasedRecommendations(entityId, userFollowingIds, 3);
        setRecommendations(recs);
      } catch (error) {
        console.error('Error fetching network recommendations:', error);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [entityId, userFollowingIds]);

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>You Might Also Consider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>
          You Might Also Consider
          {userFollowingIds.length > 0 && (
            <span className="text-sm font-normal text-blue-600 ml-2">
              Based on your network
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((entity) => (
            <div 
              key={entity.id} 
              className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
            >
              <img 
                src={entity.image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop'} 
                alt={entity.name} 
                className="w-12 h-12 rounded-lg object-cover" 
              />
              <div className="flex-1">
                <h4 className="font-medium">{entity.name}</h4>
                <p className="text-sm text-gray-500">{entity.category}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{entity.rating.toFixed(1)}</span>
                  {entity.followerCount > 0 && (
                    <span className="text-xs text-blue-600 ml-2">
                      {entity.followerCount} from your network
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
