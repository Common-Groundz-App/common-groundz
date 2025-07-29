import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Eye, Check, X, User, Flag, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReportedPhoto {
  id: string;
  url: string;
  caption?: string;
  entity_id: string;
  user_id: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  moderated_at?: string;
  moderated_by?: string;
  moderation_reason?: string;
  entity_name?: string;
  uploader_username?: string;
  reports: {
    id: string;
    reason: string;
    description?: string;
    user_id: string;
    created_at: string;
    reporter_username?: string;
  }[];
}

export const AdminPhotoModerationPanel = () => {
  const [photos, setPhotos] = useState<ReportedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<ReportedPhoto | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const fetchReportedPhotos = async () => {
    try {
      setIsLoading(true);
      
      // Fetch entity photos with their reports
      const { data: entityPhotos, error: entityError } = await supabase
        .from('entity_photos')
        .select(`
          id,
          url,
          caption,
          entity_id,
          user_id,
          moderation_status,
          created_at,
          moderated_at,
          moderated_by,
          moderation_reason,
          entities!inner(name)
        `)
        .order('created_at', { ascending: false });

      if (entityError) throw entityError;

      // Get usernames for entity photos
      const entityPhotoUserIds = entityPhotos?.map(p => p.user_id) || [];
      const { data: entityPhotoProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', entityPhotoUserIds);

      // Get photo reports for these photos
      const { data: reports, error: reportsError } = await supabase
        .from('photo_reports')
        .select(`
          id,
          photo_url,
          reason,
          description,
          user_id,
          created_at,
          status
        `)
        .eq('status', 'pending');

      if (reportsError) throw reportsError;

      // Get usernames for reporters
      const reporterUserIds = reports?.map(r => r.user_id) || [];
      const { data: reporterProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', reporterUserIds);

      // Create lookup maps for usernames
      const uploaderUsernameMap = (entityPhotoProfiles || []).reduce((acc, profile) => {
        acc[profile.id] = profile.username;
        return acc;
      }, {} as Record<string, string>);

      const reporterUsernameMap = (reporterProfiles || []).reduce((acc, profile) => {
        acc[profile.id] = profile.username;
        return acc;
      }, {} as Record<string, string>);

      // Group reports by photo URL and match with entity photos
      const reportsByUrl = reports?.reduce((acc, report) => {
        if (!acc[report.photo_url]) {
          acc[report.photo_url] = [];
        }
        acc[report.photo_url].push({
          id: report.id,
          reason: report.reason,
          description: report.description,
          user_id: report.user_id,
          created_at: report.created_at,
          reporter_username: reporterUsernameMap[report.user_id] || 'Unknown'
        });
        return acc;
      }, {} as Record<string, any[]>) || {};

      // Combine entity photos with their reports
      const photosWithReports: ReportedPhoto[] = (entityPhotos || [])
        .map(photo => ({
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          entity_id: photo.entity_id,
          user_id: photo.user_id,
          moderation_status: photo.moderation_status as 'pending' | 'approved' | 'rejected',
          created_at: photo.created_at,
          moderated_at: photo.moderated_at,
          moderated_by: photo.moderated_by,
          moderation_reason: photo.moderation_reason,
          entity_name: photo.entities?.name || 'Unknown Entity',
          uploader_username: uploaderUsernameMap[photo.user_id] || 'Unknown User',
          reports: reportsByUrl[photo.url] || []
        }))
        .filter(photo => 
          // Show photos that have reports or are pending moderation
          photo.reports.length > 0 || photo.moderation_status !== 'approved'
        );

      setPhotos(photosWithReports);
    } catch (error) {
      console.error('Error fetching reported photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reported photos',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeratePhoto = async (photo: ReportedPhoto, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('entity_photos')
        .update({
          moderation_status: action === 'approve' ? 'approved' : 'rejected',
          moderated_by: (await supabase.auth.getUser()).data.user?.id,
          moderated_at: new Date().toISOString(),
          moderation_reason: moderationReason || null
        })
        .eq('id', photo.id);

      if (error) throw error;

      // Update report status for all reports on this photo
      if (photo.reports.length > 0) {
        const { error: reportError } = await supabase
          .from('photo_reports')
          .update({
            status: action === 'approve' ? 'dismissed' : 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by: (await supabase.auth.getUser()).data.user?.id,
            resolution_reason: moderationReason || null
          })
          .eq('photo_url', photo.url);

        if (reportError) throw reportError;
      }

      toast({
        title: 'Photo moderated',
        description: `Photo has been ${action}d successfully`,
      });

      setSelectedPhoto(null);
      setModerationReason('');
      fetchReportedPhotos();
    } catch (error) {
      console.error('Error moderating photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to moderate photo',
        variant: 'destructive'
      });
    }
  };

  const getFilteredPhotos = () => {
    switch (activeTab) {
      case 'pending':
        return photos.filter(p => p.moderation_status === 'pending');
      case 'approved':
        return photos.filter(p => p.moderation_status === 'approved');
      case 'rejected':
        return photos.filter(p => p.moderation_status === 'rejected');
      default:
        return photos.filter(p => 
          // Show photos that have reports or need moderation
          p.reports.length > 0 || p.moderation_status === 'pending'
        );
    }
  };

  useEffect(() => {
    fetchReportedPhotos();
  }, []);

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'approved': return 'default';
      case 'rejected': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Photo Moderation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading reported photos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Photo Moderation
          </CardTitle>
          <CardDescription>
            Review and moderate reported entity photos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All ({photos.filter(p => p.reports.length > 0 || p.moderation_status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({photos.filter(p => p.moderation_status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({photos.filter(p => p.moderation_status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({photos.filter(p => p.moderation_status === 'rejected').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {getFilteredPhotos().length === 0 ? (
                <div className="text-center py-8">
                  <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No photos to moderate in this category</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Uploader</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredPhotos().map((photo) => (
                      <TableRow key={photo.id}>
                        <TableCell>
                          <img
                            src={photo.url}
                            alt="Photo thumbnail"
                            className="w-16 h-16 object-cover rounded-lg border"
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{photo.entity_name}</p>
                            {photo.caption && (
                              <p className="text-sm text-muted-foreground truncate max-w-32">
                                {photo.caption}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {photo.uploader_username}
                          </div>
                        </TableCell>
                        <TableCell>
                          {photo.reports.length > 0 ? (
                            <Badge variant="destructive">
                              {photo.reports.length} report{photo.reports.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(photo.moderation_status)}>
                            {photo.moderation_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPhoto(photo)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Photo Review Modal */}
      {selectedPhoto && (
        <Dialog open={true} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Photo</DialogTitle>
              <DialogDescription>
                Review this photo and take appropriate moderation action
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Photo Display */}
              <div className="flex justify-center">
                <img
                  src={selectedPhoto.url}
                  alt="Photo for review"
                  className="max-w-full max-h-64 object-contain rounded-lg border"
                />
              </div>

              {/* Photo Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Entity</p>
                  <p>{selectedPhoto.entity_name}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Uploader</p>
                  <p>{selectedPhoto.uploader_username}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Status</p>
                  <Badge variant={getBadgeVariant(selectedPhoto.moderation_status)}>
                    {selectedPhoto.moderation_status}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Uploaded</p>
                  <p>{formatDistanceToNow(new Date(selectedPhoto.created_at), { addSuffix: true })}</p>
                </div>
              </div>

              {selectedPhoto.caption && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Caption</p>
                  <p className="text-sm">{selectedPhoto.caption}</p>
                </div>
              )}

              {/* Reports */}
              {selectedPhoto.reports.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground mb-2">Reports ({selectedPhoto.reports.length})</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedPhoto.reports.map((report) => (
                      <div key={report.id} className="border rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline">{report.reason}</Badge>
                          <span className="text-muted-foreground">{report.reporter_username}</span>
                        </div>
                        {report.description && (
                          <p className="text-muted-foreground">{report.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Reason */}
              <div>
                <Label htmlFor="moderation-reason">Admin Notes (Optional)</Label>
                <Textarea
                  id="moderation-reason"
                  placeholder="Add any notes about your moderation decision..."
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedPhoto(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleModeratePhoto(selectedPhoto, 'reject')}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleModeratePhoto(selectedPhoto, 'approve')}
                  className="flex items-center gap-1"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};