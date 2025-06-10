
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Brain, 
  Clock, 
  User, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { fetchAdminReviews, generateReviewAISummary, type AdminReview } from '@/services/adminService';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeDate } from '@/utils/dateUtils';

const AdminReviewsList = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const data = await fetchAdminReviews();
      setReviews(data);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reviews',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async (reviewId: string) => {
    setGeneratingIds(prev => new Set(prev).add(reviewId));
    
    try {
      const success = await generateReviewAISummary(reviewId);
      
      if (success) {
        toast({
          title: 'AI Summary Generation Started',
          description: 'The AI summary is being generated. This may take a few moments.',
        });
        
        // Refresh the reviews list after a short delay
        setTimeout(loadReviews, 2000);
      } else {
        throw new Error('Generation failed');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate AI summary. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setGeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
    }
  };

  const getInitials = (username: string | undefined) => {
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading reviews...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium">No Dynamic Reviews</h3>
        <p className="text-sm text-muted-foreground">
          No reviews with timeline data found in the system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <span className="font-medium">{reviews.length} Dynamic Reviews</span>
        </div>
        <Button onClick={loadReviews} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Review</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead>AI Summary</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="space-y-1">
                  <div className="font-medium truncate max-w-[200px]">
                    {review.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {review.id.slice(0, 8)}...
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={review.user?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(review.user?.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {review.user?.username || 'Unknown'}
                    </span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {review.timeline_count || 0} updates
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="space-y-1">
                    {review.ai_summary ? (
                      <div className="space-y-1">
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Generated
                        </Badge>
                        {review.ai_summary_last_generated_at && (
                          <div className="text-xs text-muted-foreground">
                            {formatRelativeDate(review.ai_summary_last_generated_at)}
                          </div>
                        )}
                        {review.ai_summary_model_used && (
                          <div className="text-xs text-muted-foreground">
                            {review.ai_summary_model_used}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        None
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Button
                    onClick={() => handleGenerateSummary(review.id)}
                    disabled={generatingIds.has(review.id)}
                    size="sm"
                    variant={review.ai_summary ? "outline" : "default"}
                    className="gap-1"
                  >
                    {generatingIds.has(review.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Brain className="h-3 w-3" />
                    )}
                    {review.ai_summary ? 'Regenerate' : 'Generate'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminReviewsList;
