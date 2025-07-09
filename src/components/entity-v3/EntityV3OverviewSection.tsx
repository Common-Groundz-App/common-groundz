
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Globe, 
  Calendar, 
  Star, 
  Users, 
  Clock,
  ExternalLink,
  Info,
  Award,
  CheckCircle
} from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityV3OverviewSectionProps {
  entity: Entity;
  stats: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3OverviewSection: React.FC<EntityV3OverviewSectionProps> = ({
  entity,
  stats
}) => {
  const keyFacts = [
    { 
      label: 'Type', 
      value: entity.type,
      icon: Info
    },
    ...(entity.venue ? [{ 
      label: 'Location', 
      value: entity.venue,
      icon: MapPin
    }] : []),
    ...(entity.website_url ? [{ 
      label: 'Website', 
      value: 'Visit Site',
      icon: Globe,
      link: entity.website_url
    }] : []),
  ];

  const highlights = [
    ...(stats.averageRating ? [{
      title: 'Highly Rated',
      description: `${stats.averageRating.toFixed(1)}/5 average rating`,
      icon: Star,
      color: 'text-yellow-600'
    }] : []),
    ...(stats.recommendationCount > 0 ? [{
      title: 'Community Recommended',
      description: `${stats.recommendationCount} recommendation${stats.recommendationCount !== 1 ? 's' : ''}`,
      icon: Award,
      color: 'text-green-600'
    }] : []),
    ...(entity.is_verified ? [{
      title: 'Verified',
      description: 'Information verified by our team',
      icon: CheckCircle,
      color: 'text-blue-600'
    }] : []),
    ...(stats.reviewCount >= 10 ? [{
      title: 'Well Reviewed',
      description: `${stats.reviewCount} detailed reviews`,
      icon: Users,
      color: 'text-purple-600'
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Main Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            About {entity.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entity.description ? (
            <div className="space-y-4">
              <p className="text-foreground leading-relaxed">
                {entity.description}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              No description available yet. Be the first to share what makes this special!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Key Facts */}
      <Card>
        <CardHeader>
          <CardTitle>Key Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {keyFacts.map((fact, index) => {
              const IconComponent = fact.icon;
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <IconComponent className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">
                      {fact.label}
                    </div>
                    {fact.link ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary hover:underline"
                        onClick={() => window.open(fact.link, '_blank')}
                      >
                        {fact.value}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    ) : (
                      <div className="text-foreground capitalize">
                        {fact.value}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {highlights.map((highlight, index) => {
                const IconComponent = highlight.icon;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                    <IconComponent className={`w-5 h-5 mt-0.5 ${highlight.color}`} />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">
                        {highlight.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {highlight.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Metadata */}
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(entity.metadata as Record<string, any>).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <span className="text-sm font-medium text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-foreground">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Community Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {stats.reviewCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Review{stats.reviewCount !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {stats.recommendationCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Recommendation{stats.recommendationCount !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {stats.averageRating ? stats.averageRating.toFixed(1) : 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">
                Avg Rating
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
