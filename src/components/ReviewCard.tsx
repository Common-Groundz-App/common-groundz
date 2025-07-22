
import React from 'react';
import { Star, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ReviewWithUser } from '@/types/entities';

interface ReviewCardProps {
  review: ReviewWithUser | {
    id: number;
    name: string;
    avatar: string;
    rating: number;
    date: string;
    title: string;
    content: string;
    verified: boolean;
    helpful: number;
  };
  onHelpfulClick?: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpfulClick }) => {
  // Transform ReviewWithUser to match the expected UI format
  const transformedReview = 'user' in review ? {
    id: review.id,
    name: review.user.username || 'Unknown User',
    avatar: review.user.avatar_url || '',
    rating: review.rating,
    date: new Date(review.created_at).toLocaleDateString(),
    title: review.title,
    content: review.description || '',
    verified: review.is_verified || false,
    helpful: review.likes || 0
  } : {
    id: review.id.toString(),
    name: review.name,
    avatar: review.avatar,
    rating: review.rating,
    date: review.date,
    title: review.title,
    content: review.content,
    verified: review.verified,
    helpful: review.helpful
  };

  const handleHelpfulClick = () => {
    if (onHelpfulClick && 'user' in review) {
      onHelpfulClick(review.id);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <img 
          src={transformedReview.avatar} 
          alt={transformedReview.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">{transformedReview.name}</h4>
            {transformedReview.verified && (
              <Badge variant="secondary" className="text-xs">Verified</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < transformedReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">{transformedReview.date}</span>
          </div>
          
          <h5 className="font-medium text-gray-900 mb-2">{transformedReview.title}</h5>
          <p className="text-gray-700 text-sm leading-relaxed mb-3">{transformedReview.content}</p>
          
          <div className="flex items-center gap-4">
            <button 
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              onClick={handleHelpfulClick}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>Helpful ({transformedReview.helpful})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
