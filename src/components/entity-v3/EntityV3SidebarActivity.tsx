
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Star, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'review' | 'recommendation' | 'like' | 'follow';
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    username: string;
  };
  content: string;
  rating?: number;
  created_at: string;
  entity_name?: string;
}

interface EntityV3SidebarActivityProps {
  entityId: string;
  activities?: ActivityItem[];
  isLoading?: boolean;
}

export const EntityV3SidebarActivity: React.FC<EntityV3SidebarActivityProps> = ({
  entityId,
  activities = [],
  isLoading = false
}) => {
  // Mock data for demonstration
  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'review',
      user: {
        id: '1',
        name: 'Priya Sharma',
        username: 'priya_s',
        avatar_url: '/api/placeholder/32/32'
      },
      content: 'Had an incredible spiritual experience here. The meditation sessions were transformative.',
      rating: 5,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      type: 'recommendation',
      user: {
        id: '2',
        name: 'Raj Kumar',
        username: 'raj_k',
        avatar_url: '/api/placeholder/32/32'
      },
      content: 'Perfect place for inner peace and self-reflection. Highly recommended!',
      rating: 4,
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      type: 'like',
      user: {
        id: '3',
        name: 'Anita Desai',
        username: 'anita_d',
        avatar_url: '/api/placeholder/32/32'
      },
      content: 'liked this place',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      type: 'follow',
      user: {
        id: '4',
        name: 'Vikram Singh',
        username: 'vikram_s',
        avatar_url: '/api/placeholder/32/32'
      },
      content: 'started following this place',
      created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'review':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'recommendation':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'follow':
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'review':
        return 'left a review';
      case 'recommendation':
        return 'recommended this place';
      case 'like':
        return 'liked this place';
      case 'follow':
        return 'started following';
      default:
        return 'interacted with';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayActivities.map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3 group">
            <Avatar className="w-8 h-8">
              <AvatarImage src={activity.user.avatar_url} alt={activity.user.name} />
              <AvatarFallback className="text-xs">
                {activity.user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {activity.user.name}
                </span>
                {getActivityIcon(activity.type)}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground mb-1">
                {getActivityText(activity)}
              </p>
              
              {activity.content && activity.type !== 'like' && activity.type !== 'follow' && (
                <p className="text-sm text-foreground line-clamp-2 mb-2">
                  "{activity.content}"
                </p>
              )}
              
              {activity.rating && (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < activity.rating! 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        <button className="w-full text-sm text-primary hover:text-primary/80 transition-colors py-2 text-center border-t pt-3">
          View All Activity
        </button>
      </CardContent>
    </Card>
  );
};
