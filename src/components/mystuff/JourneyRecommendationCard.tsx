import React from 'react';
import { ArrowRight, TrendingUp, Repeat, Plus, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JourneyRecommendation } from '@/services/journeyRecommendationService';
import { useNavigate } from 'react-router-dom';

interface JourneyRecommendationCardProps {
  recommendation: JourneyRecommendation;
}

const JourneyRecommendationCard: React.FC<JourneyRecommendationCardProps> = ({ recommendation }) => {
  const navigate = useNavigate();
  const { fromEntity, toEntity, transitionType, story, confidence, consensusCount } = recommendation;

  const getTransitionIcon = () => {
    switch (transitionType) {
      case 'upgrade': return <TrendingUp className="w-4 h-4" />;
      case 'alternative': return <Repeat className="w-4 h-4" />;
      case 'complementary': return <Plus className="w-4 h-4" />;
    }
  };

  const getTransitionColor = () => {
    switch (transitionType) {
      case 'upgrade': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'alternative': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'complementary': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    }
  };

  const getConfidenceBadge = () => {
    switch (confidence) {
      case 'high': return 'bg-primary/10 text-primary';
      case 'medium': return 'bg-amber-500/10 text-amber-600';
      case 'low': return 'bg-muted text-muted-foreground';
    }
  };

  const getConfidenceLabel = () => {
    switch (confidence) {
      case 'high': return 'Personalized';
      case 'medium': return 'Similar users';
      case 'low': return 'Community';
    }
  };

  const handleEntityClick = (entityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/entity/${entityId}`);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-4">
        {/* Header with badges */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className={`${getTransitionColor()} flex items-center gap-1`}>
            {getTransitionIcon()}
            <span className="capitalize">{transitionType}</span>
          </Badge>
          <Badge variant="secondary" className={getConfidenceBadge()}>
            {getConfidenceLabel()}
          </Badge>
        </div>

        {/* Entity transition visual */}
        <div className="flex items-center gap-3 mb-4">
          {/* From Entity */}
          <div 
            className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            onClick={(e) => handleEntityClick(fromEntity.id, e)}
          >
            {fromEntity.image_url ? (
              <img 
                src={fromEntity.image_url} 
                alt={fromEntity.name}
                className="w-10 h-10 rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {fromEntity.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{fromEntity.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{fromEntity.type}</p>
            </div>
          </div>

          {/* Arrow */}
          <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />

          {/* To Entity */}
          <div 
            className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
            onClick={(e) => handleEntityClick(toEntity.id, e)}
          >
            {toEntity.image_url ? (
              <img 
                src={toEntity.image_url} 
                alt={toEntity.name}
                className="w-10 h-10 rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs">
                {toEntity.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{toEntity.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{toEntity.type}</p>
            </div>
          </div>
        </div>

        {/* Story */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{story.headline}</p>
          <p className="text-xs text-muted-foreground">{story.description}</p>
          
          {/* Sentiment change badge */}
          {story.sentiment_change && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              {story.sentiment_change}
            </Badge>
          )}

          {/* Evidence quote */}
          {story.evidence_quote && (
            <div className="mt-2 p-2 bg-muted/30 rounded-md border-l-2 border-primary/30">
              <div className="flex items-start gap-1.5">
                <Quote className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground italic line-clamp-2">
                  {story.evidence_quote}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {consensusCount} {consensusCount === 1 ? 'user' : 'users'} made this journey
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneyRecommendationCard;
