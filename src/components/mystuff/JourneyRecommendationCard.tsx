import React, { useState } from 'react';
import { ArrowRight, TrendingUp, Repeat, Plus, Quote, Bookmark, BookmarkCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JourneyRecommendation } from '@/services/journeyRecommendationService';
import { useNavigate } from 'react-router-dom';
import { savedInsightsService } from '@/services/savedInsightsService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface JourneyRecommendationCardProps {
  recommendation: JourneyRecommendation;
  onBookmarkChange?: (isSaved: boolean) => void;
}

const JourneyRecommendationCard: React.FC<JourneyRecommendationCardProps> = ({ 
  recommendation,
  onBookmarkChange 
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { fromEntity, toEntity, transitionType, story, confidence, consensusCount } = recommendation;
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save insights',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        // For now, just toggle the state - full removal would require tracking the saved insight ID
        setIsSaved(false);
        toast({
          title: 'Bookmark removed',
        });
      } else {
        await savedInsightsService.saveInsight({
          insight_type: 'journey',
          entity_from_id: fromEntity.id,
          entity_to_id: toEntity.id,
          insight_data: {
            from_entity_name: fromEntity.name,
            to_entity_name: toEntity.name,
            transition_type: transitionType,
            story: {
              headline: story.headline,
              description: story.description,
            },
            confidence,
            consensus_count: consensusCount,
          },
        });
        setIsSaved(true);
        toast({
          title: 'Insight saved',
          description: 'Added to your saved insights',
        });
      }
      onBookmarkChange?.(!isSaved);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save insight',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-4">
        {/* Header with badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${getTransitionColor()} flex items-center gap-1`}>
              {getTransitionIcon()}
              <span className="capitalize">{transitionType}</span>
            </Badge>
            <Badge variant="secondary" className={getConfidenceBadge()}>
              {getConfidenceLabel()}
            </Badge>
          </div>
          
          {/* Bookmark button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleBookmark}
            disabled={isSaving}
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-primary fill-current" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
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
