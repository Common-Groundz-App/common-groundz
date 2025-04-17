
import React from 'react';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface EmptyReviewsProps {
  isOwnProfile: boolean;
  onCreateReview: () => void;
}

const EmptyReviews = ({ isOwnProfile, onCreateReview }: EmptyReviewsProps) => {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted/50 p-6 mb-4">
        <Star 
          size={40} 
          className="text-muted-foreground stroke-[1.5] stroke-brand-orange/70 fill-brand-orange/10" 
        />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">
        {isOwnProfile ? "You haven't written any reviews yet" : "No reviews yet"}
      </h3>
      
      <p className="text-muted-foreground mb-6 max-w-md">
        {isOwnProfile 
          ? "Share your honest thoughts on products, places, and experiences before turning them into recommendations."
          : "This user hasn't written any reviews yet."}
      </p>
      
      {isOwnProfile && (
        <Button 
          onClick={onCreateReview}
          className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white"
        >
          <Star size={16} />
          <span>Write Your First Review</span>
        </Button>
      )}
    </div>
  );
};

export default EmptyReviews;
