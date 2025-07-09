
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  Heart,
  Star,
  TrendingUp,
  Users,
  ArrowRight
} from 'lucide-react';

interface PersonalizedRecommendation {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  reason: string;
  confidence_score: number;
  distance?: string;
  rating?: number;
  match_factors: string[];
}

interface EntityV3SidebarPersonalizedProps {
  userId?: string;
  entityId: string;
  recommendations?: PersonalizedRecommendation[];
  isLoading?: boolean;
}

export const EntityV3SidebarPersonalized: React.FC<EntityV3SidebarPersonalizedProps> = ({
  userId,
  entityId,
  recommendations = [],
  isLoading = false
}) => {
  // Mock data for demonstration
  const mockRecommendations: PersonalizedRecommendation[] = [
    {
      id: '1',
      name: 'Ramana Maharshi Ashram',
      type: 'spiritual_center',
      image_url: '/api/placeholder/60/60',
      reason: 'Based on your interest in meditation and spiritual growth',
      confidence_score: 0.92,
      distance: '45km away',
      rating: 4.8,
      match_factors: ['meditation', 'spirituality', 'peaceful environment']
    },
    {
      id: '2',
      name: 'Yoga Bharati',
      type: 'yoga_center',
      image_url: '/api/placeholder/60/60',
      reason: 'Perfect for your wellness journey',
      confidence_score: 0.87,
      distance: '12km away',
      rating: 4.6,
      match_factors: ['yoga', 'wellness', 'group classes']
    },
    {
      id: '3',
      name: 'Osho International Resort',
      type: 'retreat_center',
      image_url: '/api/placeholder/60/60',
      reason: 'Popular with users who visited similar places',
      confidence_score: 0.81,
      distance: '180km away',
      rating: 4.4,
      match_factors: ['retreats', 'meditation', 'community']
    }
  ];

  const displayRecommendations = recommendations.length > 0 ? recommendations : mockRecommendations;

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-50';
    if (score >= 0.8) return 'text-blue-600 bg-blue-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getConfidenceText = (score: number) => {
    if (score >= 0.9) return 'Perfect Match';
    if (score >= 0.8) return 'Great Match';
    return 'Good Match';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personalized for You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalized for You
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Sign in to get personalized recommendations based on your interests and activity
          </p>
          <Button variant="outline" size="sm">
            Sign In for Personal Recommendations
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Personalized for You
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayRecommendations.map((rec) => (
          <div
            key={rec.id}
            className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-start space-x-3">
              <img
                src={rec.image_url || '/api/placeholder/60/60'}
                alt={rec.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {rec.name}
                  </h4>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ml-2 ${getConfidenceColor(rec.confidence_score)}`}
                  >
                    {getConfidenceText(rec.confidence_score)}
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {rec.reason}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  {rec.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{rec.rating}</span>
                    </div>
                  )}
                  {rec.distance && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{rec.distance}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {rec.match_factors.slice(0, 2).map((factor) => (
                    <Badge key={factor} variant="outline" className="text-xs">
                      {factor}
                    </Badge>
                  ))}
                  {rec.match_factors.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{rec.match_factors.length - 2}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-primary">
                    {Math.round(rec.confidence_score * 100)}% match
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="ghost" className="w-full text-sm text-primary">
          <Sparkles className="h-4 w-4 mr-2" />
          See More Personalized Recommendations
        </Button>
      </CardContent>
    </Card>
  );
};
