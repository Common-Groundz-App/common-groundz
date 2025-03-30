
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: {
    id: string;
    name: string;
    category: string;
    image?: string;
    score: number;
    isCircleCertified: boolean;
    reason: string;
  };
}

const RecommendationCard = ({ recommendation }: RecommendationCardProps) => {
  // Custom circular score indicator
  const renderScoreCircle = (score: number) => {
    const percentage = (score / 5) * 100;
    
    return (
      <div className="relative h-10 w-10 rounded-full flex items-center justify-center bg-muted">
        <div 
          className="absolute inset-0 rounded-full" 
          style={{
            background: `conic-gradient(#F97316 ${percentage}%, transparent ${percentage}%)`,
            clipPath: 'circle(50% at center)',
          }}
        />
        <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center text-sm font-semibold">
          {score}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300">
      <AspectRatio ratio={1.5 / 1} className="bg-muted">
        {recommendation.image ? (
          <img 
            src={recommendation.image} 
            alt={recommendation.name} 
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
      </AspectRatio>
      
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold line-clamp-1">{recommendation.name}</h3>
            <Badge variant="outline" className="mt-1">
              {recommendation.category}
            </Badge>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {renderScoreCircle(recommendation.score)}
            
            {recommendation.isCircleCertified && (
              <Badge className="bg-brand-orange text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Circle Certified
              </Badge>
            )}
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {recommendation.reason}
        </p>
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
