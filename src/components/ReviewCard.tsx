
import React from 'react';
import { Star, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReviewCardProps {
  review: {
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
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <img 
          src={review.avatar} 
          alt={review.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">{review.name}</h4>
            {review.verified && (
              <Badge variant="secondary" className="text-xs">Verified</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">{review.date}</span>
          </div>
          
          <h5 className="font-medium text-gray-900 mb-2">{review.title}</h5>
          <p className="text-gray-700 text-sm leading-relaxed mb-3">{review.content}</p>
          
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ThumbsUp className="w-4 h-4" />
              <span>Helpful ({review.helpful})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
