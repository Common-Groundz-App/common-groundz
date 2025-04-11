
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Award, Bookmark, Eye, MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import RatingStars from './RatingStars';
import { Recommendation } from '@/services/recommendationService';
import { getCategoryLabel } from './RecommendationFilters';
import CommentDialog from '../comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { deleteRecommendation } from '@/services/recommendation/crudOperations';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onComment?: (id: string) => void;
  onDeleted?: () => void;
}

const RecommendationCard = ({ 
  recommendation, 
  onLike, 
  onSave,
  onComment,
  onDeleted
}: RecommendationCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === recommendation.user_id;
  
  useEffect(() => {
    const getInitialCommentCount = async () => {
      try {
        const count = await fetchCommentCount(recommendation.id, 'recommendation');
        setLocalCommentCount(count);
      } catch (error) {
        console.error("Error fetching comment count:", error);
        setLocalCommentCount(recommendation.comment_count || 0);
      }
    };
    
    getInitialCommentCount();
  }, [recommendation.id, recommendation.comment_count]);
  
  useEffect(() => {
    const handleCommentCountUpdate = async (event: CustomEvent) => {
      if (event.detail.itemId === recommendation.id) {
        const updatedCount = await fetchCommentCount(recommendation.id, 'recommendation');
        setLocalCommentCount(updatedCount);
      }
    };
    
    window.addEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    };
  }, [recommendation.id]);
  
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCommentDialogOpen(true);
    if (onComment) onComment(recommendation.id);
  };

  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Navigate to edit recommendation page
    navigate(`/recommendations/edit/${recommendation.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await deleteRecommendation(recommendation.id);
      
      toast({
        title: "Recommendation deleted",
        description: "Your recommendation has been deleted successfully"
      });
      
      setIsDeleteDialogOpen(false);
      
      // Call onDeleted callback if provided
      if (onDeleted) {
        onDeleted();
      }
    } catch (error) {
      console.error("Error deleting recommendation:", error);
      toast({
        title: "Error",
        description: "Failed to delete recommendation",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : recommendation.comment_count;
  
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
          <div className="flex items-center">
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    className="text-destructive focus:text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
              {displayCommentCount > 0 && (
                <span>{displayCommentCount}</span>
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
      
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Recommendation"
        description="Are you sure you want to delete this recommendation? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

export default RecommendationCard;
