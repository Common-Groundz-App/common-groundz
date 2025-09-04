import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Building,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminSuggestions, AdminSuggestion } from '@/hooks/admin/useAdminSuggestions';
import { SuggestionReviewModal } from './SuggestionReviewModal';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

const getPriorityColor = (score: number) => {
  if (score >= 70) return 'bg-red-100 text-red-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

const getPriorityLabel = (score: number) => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const AdminSuggestionsPanel: React.FC = () => {
  const {
    suggestions,
    stats,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    processingIds,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    fetchSuggestions,
    updateSuggestionStatus,
    bulkUpdateStatus
  } = useAdminSuggestions({ pageSize: 20, autoRefresh: true, claimsOnly: false });

  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [selectedSuggestion, setSelectedSuggestion] = useState<AdminSuggestion | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuggestions(new Set(suggestions.map(s => s.id)));
    } else {
      setSelectedSuggestions(new Set());
    }
  };

  const handleSelectSuggestion = (suggestionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSuggestions);
    if (checked) {
      newSelected.add(suggestionId);
    } else {
      newSelected.delete(suggestionId);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleQuickAction = async (suggestion: AdminSuggestion, action: 'approve' | 'reject') => {
    await updateSuggestionStatus(
      suggestion.id,
      action === 'approve' ? 'approved' : 'rejected',
      undefined,
      action === 'approve'
    );
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedSuggestions.size === 0) return;
    
    await bulkUpdateStatus(
      Array.from(selectedSuggestions),
      action === 'approve' ? 'approved' : 'rejected'
    );
    
    setSelectedSuggestions(new Set());
  };

  const handleRowClick = (suggestion: AdminSuggestion) => {
    setSelectedSuggestion(suggestion);
    setReviewModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getSuggestedChangesPreview = (changes: any) => {
    const keys = Object.keys(changes || {});
    if (keys.length === 0) return 'No changes';
    
    if (keys.length === 1) return `Updated ${keys[0]}`;
    if (keys.length === 2) return `Updated ${keys[0]} and ${keys[1]}`;
    return `Updated ${keys[0]} and ${keys.length - 1} more`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.totalPending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.totalApproved}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.totalRejected}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">{stats.highPriority}</div>
            <div className="text-sm text-muted-foreground">High Priority</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.businessOwner}</div>
            <div className="text-sm text-muted-foreground">Business Owner</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.duplicates}</div>
            <div className="text-sm text-muted-foreground">Duplicates</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.closedBusiness}</div>
            <div className="text-sm text-muted-foreground">Closed Business</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Entity Suggestions Management
                <Badge variant="outline">
                  {totalCount} Total Suggestions
                </Badge>
              </CardTitle>
              <CardDescription>
                Review and manage user-submitted entity suggestions
              </CardDescription>
            </div>
            
            {selectedSuggestions.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedSuggestions.size} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('approve')}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('reject')}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suggestions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="place">Place</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="book">Book</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading suggestions...
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Changes</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No suggestions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      suggestions.map((suggestion) => (
                        <TableRow
                          key={suggestion.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(suggestion)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedSuggestions.has(suggestion.id)}
                              onCheckedChange={(checked) => 
                                handleSelectSuggestion(suggestion.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          
                          <TableCell>
                            {suggestion.entity ? (
                              <div className="flex items-center gap-3">
                                <ImageWithFallback
                                  src={suggestion.entity.image_url}
                                  alt={suggestion.entity.name}
                                  entityType={suggestion.entity.type}
                                  className="w-10 h-10 rounded object-cover"
                                />
                                <div>
                                  <div className="font-medium">{suggestion.entity.name}</div>
                                  <div className="text-sm text-muted-foreground capitalize">
                                    {suggestion.entity.type}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Deleted entity</span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {suggestion.user?.avatar_url ? (
                                <img
                                  src={suggestion.user.avatar_url}
                                  alt={suggestion.user.username || 'User'}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <User className="w-6 h-6 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {suggestion.user?.username || 'Unknown User'}
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm">
                              {getSuggestedChangesPreview(suggestion.suggested_changes)}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={getPriorityColor(suggestion.priority_score)}>
                              {getPriorityLabel(suggestion.priority_score)}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={getStatusColor(suggestion.status)}>
                              {suggestion.status}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex gap-1">
                              {suggestion.user_is_owner && (
                                <Badge variant="outline" className="text-blue-600">
                                  <Building className="w-3 h-3 mr-1" />
                                  Owner
                                </Badge>
                              )}
                              {suggestion.is_duplicate && (
                                <Badge variant="outline" className="text-orange-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Duplicate
                                </Badge>
                              )}
                              {suggestion.is_business_closed && (
                                <Badge variant="outline" className="text-red-600">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Closed
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(suggestion.created_at)}
                          </TableCell>
                          
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRowClick(suggestion)}
                                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {suggestion.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickAction(suggestion, 'approve')}
                                    disabled={processingIds.has(suggestion.id)}
                                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                                  >
                                    {processingIds.has(suggestion.id) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickAction(suggestion, 'reject')}
                                    disabled={processingIds.has(suggestion.id)}
                                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
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
                    Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} suggestions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSuggestions(currentPage - 1)}
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
                      onClick={() => fetchSuggestions(currentPage + 1)}
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

      {/* Review Modal */}
      <SuggestionReviewModal
        suggestion={selectedSuggestion}
        isOpen={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        onStatusUpdate={updateSuggestionStatus}
      />
    </div>
  );
};