
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Recommendation, fetchRecommendationById } from '@/services/recommendationService';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Bookmark, MessageCircle, ChevronLeft, Star, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toggleLike, toggleSave } from '@/services/recommendation/interactionOperations';
import UsernameLink from '@/components/common/UsernameLink';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import { incrementViewCount } from '@/services/recommendation/crudOperations';

const RecommendationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  
  useEffect(() => {
    const loadRecommendation = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const data = await fetchRecommendationById(id, user?.id || null);
        
        if (!data) {
          setError('Recommendation not found');
          return;
        }
        
        setRecommendation(data);
        
        // Increment view count
        await incrementViewCount(id);
        
        // Load comment count
        const count = await fetchCommentCount(id, 'recommendation');
        setCommentCount(count);
        
      } catch (err) {
        console.error('Error fetching recommendation:', err);
        setError('Failed to load recommendation. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load recommendation',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRecommendation();
  }, [id, user?.id, toast]);
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (error) {
      return 'Unknown date';
    }
  };
  
  const handleLike = async () => {
    if (!user || !recommendation) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like recommendations',
      });
      return;
    }
    
    try {
      // Optimistic update
      setRecommendation(prev => {
        if (!prev) return prev;
        const isLiked = !prev.isLiked;
        return {
          ...prev,
          isLiked,
          likes: (prev.likes || 0) + (isLiked ? 1 : -1)
        };
      });
      
      // Server update
      await toggleLike(recommendation.id, user.id, !recommendation.isLiked);
    } catch (err) {
      console.error('Error toggling like:', err);
      toast({
        title: 'Error',
        description: 'Failed to update like status',
        variant: 'destructive'
      });
      
      // Revert on failure
      setRecommendation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isLiked: recommendation.isLiked,
          likes: recommendation.likes
        };
      });
    }
  };
  
  const handleSave = async () => {
    if (!user || !recommendation) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save recommendations',
      });
      return;
    }
    
    try {
      // Optimistic update
      setRecommendation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isSaved: !prev.isSaved
        };
      });
      
      // Server update
      await toggleSave(recommendation.id, user.id, !recommendation.isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to update save status',
        variant: 'destructive'
      });
      
      // Revert on failure
      setRecommendation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isSaved: recommendation.isSaved
        };
      });
    }
  };
  
  const handleCommentAdded = () => {
    setCommentCount(prev => prev + 1);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {isMobile && <div className="h-16 bg-background/90 backdrop-blur-sm border-b"></div>}
        <div className="flex flex-1">
          {!isMobile && <VerticalTubelightNavbar className="fixed left-0 top-0 h-screen pt-4" />}
          <div className={cn("flex-1 pt-16 md:pl-64")}>
            <div className="container max-w-3xl mx-auto p-4 md:p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
        {isMobile && <BottomNavigation />}
      </div>
    );
  }
  
  if (error || !recommendation) {
    return (
      <div className="min-h-screen flex flex-col">
        {isMobile && <div className="h-16 bg-background/90 backdrop-blur-sm border-b"></div>}
        <div className="flex flex-1">
          {!isMobile && <VerticalTubelightNavbar className="fixed left-0 top-0 h-screen pt-4" />}
          <div className={cn("flex-1 pt-16 md:pl-64")}>
            <div className="container max-w-3xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Not Found</h2>
                <p className="text-muted-foreground mb-6">{error || 'Recommendation not found'}</p>
                <Link to="/explore">
                  <Button variant="default">Back to Explore</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {isMobile && <div className="h-16 bg-background/90 backdrop-blur-sm border-b"></div>}
      <div className="flex flex-1">
        {!isMobile && <VerticalTubelightNavbar className="fixed left-0 top-0 h-screen pt-4" />}
        
        <div className={cn("flex-1 pt-16 md:pl-64")}>
          <div className="container max-w-3xl mx-auto p-4 md:p-6">
            <div className="mb-6">
              <Link to="/explore" className="inline-flex items-center text-muted-foreground hover:text-foreground">
                <ChevronLeft size={16} className="mr-1" />
                Back to Explore
              </Link>
            </div>
            
            {/* Hero image */}
            <div className="mb-6 relative rounded-lg overflow-hidden">
              <img 
                src={recommendation.image_url || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07'}
                alt={recommendation.title}
                className="w-full h-64 object-cover"
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-black/70 text-white">{recommendation.category}</Badge>
              </div>
            </div>
            
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold">{recommendation.title}</h1>
              {recommendation.venue && (
                <div className="flex items-center text-muted-foreground mt-2">
                  <MapPin size={18} className="mr-1" />
                  <span>{recommendation.venue}</span>
                </div>
              )}
              
              <div className="flex items-center mt-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    className={cn(
                      "mr-1",
                      star <= recommendation.rating ? "fill-brand-orange text-brand-orange" : "text-gray-300"
                    )}
                  />
                ))}
                <span className="ml-2 font-medium">{recommendation.rating.toFixed(1)}</span>
              </div>
            </div>
            
            {/* User info */}
            <div className="flex items-center space-x-4 mb-6 pb-6 border-b">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={recommendation.user_avatar_url || undefined} />
                <AvatarFallback>
                  {recommendation.username?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <UsernameLink 
                  username={recommendation.username || 'Unknown User'} 
                  userId={recommendation.user_id}
                  className="font-semibold"
                  isCurrentUser={user?.id === recommendation.user_id}
                />
                <p className="text-sm text-muted-foreground">
                  {formatDate(recommendation.created_at)}
                </p>
              </div>
            </div>
            
            {/* Description */}
            {recommendation.description && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-3">About</h2>
                <p className="text-muted-foreground whitespace-pre-line">{recommendation.description}</p>
              </div>
            )}
            
            {/* Entity info */}
            {recommendation.entity && (
              <div className="mb-8 p-4 border rounded-lg bg-muted/30">
                <h2 className="text-xl font-semibold mb-3">Related {recommendation.entity.type}</h2>
                <div className="flex items-start gap-4">
                  {recommendation.entity.image_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={recommendation.entity.image_url} 
                        alt={recommendation.entity.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{recommendation.entity.name}</h3>
                    {recommendation.entity.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {recommendation.entity.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant={recommendation.isLiked ? "default" : "outline"} 
                  size="sm"
                  className={cn(
                    "flex items-center gap-2",
                    recommendation.isLiked && "bg-red-100 text-red-500 hover:bg-red-200 border-red-200"
                  )}
                  onClick={handleLike}
                >
                  <Heart 
                    size={18} 
                    className={recommendation.isLiked ? "fill-red-500" : ""} 
                  />
                  <span>{recommendation.likes || 0} {recommendation.likes === 1 ? 'Like' : 'Likes'}</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setIsCommentDialogOpen(true)}
                >
                  <MessageCircle size={18} />
                  <span>{commentCount || 0} {commentCount === 1 ? 'Comment' : 'Comments'}</span>
                </Button>
              </div>
              
              <Button
                variant={recommendation.isSaved ? "default" : "outline"}
                size="sm"
                className={cn(
                  "flex items-center gap-2",
                  recommendation.isSaved && "bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 border-brand-orange/20"
                )}
                onClick={handleSave}
              >
                <Bookmark 
                  size={18} 
                  className={recommendation.isSaved ? "fill-brand-orange" : ""} 
                />
                <span>{recommendation.isSaved ? 'Saved' : 'Save'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={recommendation.id}
        itemType="recommendation"
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
};

export default RecommendationDetail;
