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
  CheckCircle,
  XCircle,
  Clock,
  User,
  Loader2,
  Eye,
  Plus,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminNewSubmissions, NewSubmissionEntity } from '@/hooks/admin/useAdminNewSubmissions';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const AdminNewSubmissionsPanel: React.FC = () => {
  const {
    submissions,
    stats,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    processingIds,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    fetchSubmissions,
    updateSubmissionStatus,
    bulkUpdateStatus,
    runDuplicateDetection
  } = useAdminNewSubmissions({ pageSize: 20, autoRefresh: true });

  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(new Set(submissions.map(s => s.id)));
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const handleSelectSubmission = (submissionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSubmissions);
    if (checked) {
      newSelected.add(submissionId);
    } else {
      newSelected.delete(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  const handleQuickAction = async (submission: NewSubmissionEntity, action: 'approve' | 'reject') => {
    await updateSubmissionStatus(submission.id, action === 'approve' ? 'approved' : 'rejected');
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedSubmissions.size === 0) return;
    
    await bulkUpdateStatus(Array.from(selectedSubmissions), action === 'approve' ? 'approved' : 'rejected');
    setSelectedSubmissions(new Set());
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.totalPending}</div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
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
            <div className="text-2xl font-bold text-orange-600">{stats.pendingDuplicates}</div>
            <div className="text-sm text-muted-foreground">Pending Duplicates</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Entity Submissions
                <Badge variant="outline">
                  {totalCount} Total Submissions
                </Badge>
              </CardTitle>
              <CardDescription>
                Review and approve user-created entities awaiting moderation
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={runDuplicateDetection}
                className="gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Detect Duplicates
              </Button>
              
              {selectedSubmissions.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedSubmissions.size} selected
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
                </>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search submissions..."
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
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                <SelectItem value="software">Software</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="brand">Brand</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchSubmissions(currentPage)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading submissions...
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No submissions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      submissions.map((submission) => (
                        <TableRow
                          key={submission.id}
                          className="hover:bg-muted/50"
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedSubmissions.has(submission.id)}
                              onCheckedChange={(checked) => 
                                handleSelectSubmission(submission.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ImageWithFallback
                                src={submission.image_url}
                                alt={submission.name}
                                entityType={submission.type}
                                className="w-10 h-10 rounded object-cover"
                              />
                              <div>
                                <div className="font-medium">{submission.name}</div>
                                {submission.venue && (
                                  <div className="text-sm text-muted-foreground">
                                    {submission.venue}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {submission.type}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {submission.user?.avatar_url ? (
                                <img
                                  src={submission.user.avatar_url}
                                  alt={submission.user.username || 'User'}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <User className="w-6 h-6 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {submission.user?.username || 'Unknown User'}
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={getStatusColor(submission.approval_status)}>
                              {submission.approval_status}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(submission.created_at)}
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {submission.approval_status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickAction(submission, 'approve')}
                                    disabled={processingIds.has(submission.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickAction(submission, 'reject')}
                                    disabled={processingIds.has(submission.id)}
                                    className="gap-1"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              
                              {submission.approval_status !== 'pending' && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {submission.reviewed_at && formatDate(submission.reviewed_at)}
                                </div>
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
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} submissions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSubmissions(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSubmissions(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};