import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { journeyRecommendationService, JourneyRecommendation } from '@/services/journeyRecommendationService';
import { useAuth } from '@/contexts/AuthContext';
import JourneyRecommendationCard from './JourneyRecommendationCard';
import { Loader2 } from 'lucide-react';

interface AlternativesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
}

const AlternativesDrawer: React.FC<AlternativesDrawerProps> = ({
  open,
  onOpenChange,
  entityId,
  entityName,
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<JourneyRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchAlternatives();
    }
  }, [open, user, entityId]);

  const fetchAlternatives = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await journeyRecommendationService.getRecommendationsForEntity(
        user.id,
        entityId,
        10
      );
      setRecommendations(response.recommendations);
    } catch (err) {
      console.error('[AlternativesDrawer] Error fetching alternatives:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Alternatives for {entityName}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No alternatives found yet. As more users share their journeys, we'll discover relevant alternatives.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <JourneyRecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AlternativesDrawer;
