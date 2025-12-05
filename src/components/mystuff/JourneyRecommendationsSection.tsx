import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, Repeat, Plus, Info } from 'lucide-react';
import { journeyRecommendationService, JourneyRecommendation } from '@/services/journeyRecommendationService';
import { useAuth } from '@/contexts/AuthContext';
import JourneyRecommendationCard from './JourneyRecommendationCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const JourneyRecommendationsSection: React.FC = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['journey-recommendations', user?.id],
    queryFn: () => journeyRecommendationService.getRecommendationsForMyStuff(user!.id, 6),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const recommendations = data?.recommendations || [];
  const metadata = data?.metadata;

  // Group recommendations by type
  const upgrades = recommendations.filter(r => r.transitionType === 'upgrade');
  const alternatives = recommendations.filter(r => r.transitionType === 'alternative');
  const complementary = recommendations.filter(r => r.transitionType === 'complementary');

  const getModeDescription = (mode: string) => {
    switch (mode) {
      case 'RICH': return 'Personalized based on users similar to you';
      case 'MODERATE': return 'Based on similar users and community patterns';
      case 'SPARSE': return 'Based on community patterns';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Unable to load recommendations at this time.</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-lg font-medium mb-1">No recommendations yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add items to your stuff and write reviews to get personalized journey recommendations 
          based on what similar users have tried.
        </p>
      </div>
    );
  }

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: JourneyRecommendation[],
    emptyMessage: string
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-medium text-sm">{title}</h4>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(rec => (
            <JourneyRecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Journey Suggestions</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-sm">
                  Recommendations based on what users similar to you have tried. 
                  Upgrades, alternatives, and complementary products from real user journeys.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {metadata && (
          <Badge variant="outline" className="text-xs">
            {getModeDescription(metadata.richness_mode)}
          </Badge>
        )}
      </div>

      {/* Recommendation sections */}
      <div className="space-y-6">
        {renderSection(
          'Upgrades',
          <TrendingUp className="w-4 h-4 text-green-600" />,
          upgrades,
          'No upgrade suggestions yet'
        )}
        
        {renderSection(
          'Alternatives',
          <Repeat className="w-4 h-4 text-blue-600" />,
          alternatives,
          'No alternative suggestions yet'
        )}
        
        {renderSection(
          'Pairs Well With',
          <Plus className="w-4 h-4 text-purple-600" />,
          complementary,
          'No complementary suggestions yet'
        )}
      </div>

      {/* Metadata footer */}
      {metadata && metadata.similar_users_found > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border/50">
          Based on {metadata.similar_users_found} similar users and {metadata.journeys_analyzed} journeys analyzed
        </p>
      )}
    </div>
  );
};

export default JourneyRecommendationsSection;
