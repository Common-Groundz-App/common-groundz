
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Award, Bookmark, Eye, MessageCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import RatingStars from './RatingStars';
import { Recommendation } from '@/services/recommendationService';
import { getCategoryLabel } from './RecommendationFilters';
import CommentDialog from '../comments/CommentDialog';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onComment?: (id: string) => void;
}

const RecommendationCard = ({ 
  recommendation, 
  onLike, 
  onSave,
  onComment
}: RecommendationCardProps) => {
  // Ensure comment_count is treated as a number
  const commentCount = typeof recommendation.comment_count === 'number' ? recommendation.comment_count : 0;
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCommentDialogOpen(true);
    if (onComment) onComment(recommendation.id);
  };

  const handleCommentAdded = () => {
    // Update the comment count locally after a comment is added
    if (typeof recommendation.comment_count === 'number') {
      recommendation.comment_count += 1;
    } else {
      recommendation.comment_count = 1;
    }
  };
  
  return (
    <Card 
      key={recommendation.id} 
      className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200"
    >
      <div className="relative">
        <div className="absolute top-3 left-3 z-10">
          <Badge variant="secondary" className="bg-black/70 hover:bg-black/80 text-white">
            {getCategoryLabel(recommendation.category)}
          </Badge>
        </div>
        {recommendation.is_certified && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="secondary" className="bg-brand-orange hover:bg-brand-orange/90 text-white flex items-center gap-1">
              <Award size={12} />
              <span>Certified</span>
            </Badge>
          </div>
        )}
        <div className="h-48 relative overflow-hidden group">
          <img 
            src={recommendation.image_url || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07'} 
            alt={recommendation.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
            <div className="p-3 w-full flex justify-between items-center">
              <div className="flex items-center gap-1 text-white">
                <Eye size={14} />
                <span className="text-xs">{recommendation.view_count}</span>
              </div>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs border-0 text-white",
                  recommendation.visibility === 'private' ? "bg-red-500/70" : 
                  recommendation.visibility === 'circle_only' ? "bg-blue-500/70" : "bg-green-500/70"
                )}
              >
                {recommendation.visibility === 'public' ? 'Public' : 
                 recommendation.visibility === 'private' ? 'Private' : 'Circle Only'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold line-clamp-1">{recommendation.title}</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 transition-colors", 
              recommendation.isSaved 
                ? "text-brand-orange" 
                : "text-gray-500 hover:text-brand-orange"
            )}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSave(recommendation.id);
            }}
          >
            <Bookmark size={18} className={recommendation.isSaved ? "fill-brand-orange" : ""} />
          </Button>
        </div>
        
        <p className="text-gray-600 mb-3 text-sm">{recommendation.venue || 'Unknown venue'}</p>
        
        <RatingStars rating={recommendation.rating} />
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "transition-colors flex items-center gap-1 px-2",
                recommendation.isLiked 
                  ? "text-red-500" 
                  : "text-gray-500 hover:text-red-500"
              )}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onLike(recommendation.id);
              }}
            >
              <Heart 
                size={16} 
                className={recommendation.isLiked ? "fill-red-500" : ""} 
              />
              <span>{recommendation.likes}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="transition-colors flex items-center gap-1 px-2 text-gray-500 hover:text-gray-700"
              onClick={handleCommentClick}
            >
              <MessageCircle size={16} />
              {commentCount > 0 && (
                <span>{commentCount}</span>
              )}
            </Button>
          </div>
          
          <Button variant="outline" size="sm" className="text-xs">
            View Details
          </Button>
        </div>
      </CardContent>

      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={recommendation.id}
        itemType="recommendation"
        onCommentAdded={handleCommentAdded}
      />
    </Card>
  );
};

export default RecommendationCard;
