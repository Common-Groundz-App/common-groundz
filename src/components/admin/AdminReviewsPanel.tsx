
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminReviews, AdminReview, ReviewUpdate } from '@/hooks/admin/useAdminReviews';
import { ReviewPreviewModal } from './ReviewPreviewModal';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Eye, Sparkles } from 'lucide-react';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';

export const AdminReviewsPanel: React.FC = () => {
  const {
    reviews,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    generatingIds,
    isBulkGenerating,
    fetchReviews,
    generateAISummary,
    generateBulkSummaries,
    fetchReviewUpdates
  } = useAdminReviews();

  const [selectedReview, setSelectedReview] = React.useState<AdminReview | null>(null);
  const [reviewUpdates, setReviewUpdates] = React.useState<ReviewUpdate[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loadingUpdates, setLoadingUpdates] = React.useState(false);

  const handleRowClick = async (review: AdminReview) => {
    setSelectedReview(review);
    setLoadingUpdates(true);
    setModalOpen(true);
    
    const updates = await fetchReviewUpdates(review.id);
    setReviewUpdates(updates);
    setLoadingUpdates(false);
  };

  const handleGenerateSummary = async (e: React.MouseEvent, reviewId: string) => {
    e.stopPropagation(); // Prevent row click
    await generateAISummary(reviewId);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Dynamic Reviews Management
                <Badge variant="outline">
                  {totalCount} Total Reviews
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage AI summaries for reviews with timeline updates
              </CardDescription>
            </div>
            <Button
              onClick={generateBulkSummaries}
              disabled={isBulkGenerating || isLoading}
              className="gap-2"
            >
              {isBulkGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate All Review Summaries
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading reviews...
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Review Title</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Timeline</TableHead>
                      <TableHead>AI Summary</TableHead>
                      <TableHead>Last Generated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No dynamic reviews found
                        </TableCell>
                      </TableRow>
                    ) : (
                      reviews.map((review) => (
                        <TableRow
                          key={review.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(review)}
                        >
                          <TableCell>
                            <div className="font-medium">
                              {review.user?.username || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              {review.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            {review.entity ? (
                              <div className="text-sm">
                                <div className="font-medium">{review.entity.name}</div>
                                <div className="text-muted-foreground">
                                  {getEntityTypeLabel(review.entity.type)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No entity</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {review.timeline_count} updates
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {review.ai_summary ? (
                              <Badge className="bg-green-100 text-green-800">
                                ✅ Generated
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600">
                                ⚠️ Not Generated
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(review.ai_summary_last_generated_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowClick(review);
                                }}
                                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => handleGenerateSummary(e, review.id)}
                                disabled={generatingIds.has(review.id)}
                                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                              >
                                {generatingIds.has(review.id) ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    Generating...
                                  </>
                                ) : (
                                  'Generate Summary'
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalCount)} of {totalCount} reviews
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchReviews(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchReviews(currentPage + 1)}
                      disabled={currentPage === totalPages || isLoading}
                      className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ReviewPreviewModal
        review={selectedReview}
        updates={loadingUpdates ? [] : reviewUpdates}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};
