import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import {
  CheckCircle,
  XCircle,
  User,
  Building,
  Phone,
  Globe,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AdminSuggestion } from '@/hooks/admin/useAdminSuggestions';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Link } from 'react-router-dom';

interface SuggestionReviewModalProps {
  suggestion: AdminSuggestion | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: (
    suggestionId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
    applyChanges?: boolean
  ) => Promise<void>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const SuggestionReviewModal: React.FC<SuggestionReviewModalProps> = ({
  suggestion,
  isOpen,
  onOpenChange,
  onStatusUpdate
}) => {
  const [adminNotes, setAdminNotes] = useState('');
  const [applyChanges, setApplyChanges] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!suggestion) return null;

  const handleApprove = async (forceReApply = false) => {
    setIsProcessing(true);
    try {
      const shouldApply = forceReApply || applyChanges;
      await onStatusUpdate(suggestion.id, 'approved', adminNotes || undefined, shouldApply);
      onOpenChange(false);
      setAdminNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onStatusUpdate(suggestion.id, 'rejected', adminNotes || undefined, false);
      onOpenChange(false);
      setAdminNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderChangeComparison = (field: string, currentValue: any, suggestedValue: any) => {
    if (suggestedValue === undefined || suggestedValue === null) return null;

    const formatValue = (value: any) => {
      if (value === null || value === undefined || value === '') return 'Not set';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };

    return (
      <div className="space-y-2">
        <div className="font-medium text-sm capitalize">{field.replace(/([A-Z])/g, ' $1')}</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Current</div>
            <div className="p-2 bg-red-50 rounded border-l-4 border-red-200">
              {formatValue(currentValue)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Suggested</div>
            <div className="p-2 bg-green-50 rounded border-l-4 border-green-200">
              {formatValue(suggestedValue)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHoursComparison = (currentHours: any, suggestedHours: any) => {
    if (!suggestedHours) return null;

    return (
      <div className="space-y-2">
        <div className="font-medium text-sm">Business Hours</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Current</div>
            <div className="space-y-1">
              {DAYS.map(day => (
                <div key={day} className="flex justify-between p-1 bg-red-50 rounded">
                  <span className="capitalize font-medium">{day}:</span>
                  <span>{currentHours?.[day] || 'Not set'}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Suggested</div>
            <div className="space-y-1">
              {DAYS.map(day => (
                <div key={day} className="flex justify-between p-1 bg-green-50 rounded">
                  <span className="capitalize font-medium">{day}:</span>
                  <span>{suggestedHours[day] || 'Not set'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const changes = suggestion.suggested_changes || {};
  const entity = suggestion.entity;
  const currentMetadata = entity?.metadata || {};

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Entity Suggestion
          </DialogTitle>
          <DialogDescription>
            Review the suggested changes and decide whether to approve or reject them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entity Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entity Information</CardTitle>
            </CardHeader>
            <CardContent>
              {entity ? (
                <div className="flex items-start gap-4">
                  <ImageWithFallback
                    src={entity.image_url}
                    alt={entity.name}
                    entityType={entity.type}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{entity.name}</h3>
                      <Badge variant="outline">
                        {getEntityTypeLabel(entity.type)}
                      </Badge>
                      <Link
                        to={`/entity/${entity.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        target="_blank"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                    {entity.description && (
                      <p className="text-muted-foreground mt-1">{entity.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {entity.website_url && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          <span>Website</span>
                        </div>
                      )}
                      {currentMetadata.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <span>Phone</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  This entity has been deleted
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggestion Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suggestion Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Submitted by:</span>
                  <span>{suggestion.user?.username || 'Unknown User'}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge className={`${suggestion.priority_score >= 70 ? 'bg-red-100 text-red-800' : 
                  suggestion.priority_score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  Priority: {suggestion.priority_score >= 70 ? 'High' : 
                    suggestion.priority_score >= 40 ? 'Medium' : 'Low'}
                </Badge>

                {suggestion.user_is_owner && (
                  <Badge variant="outline" className="text-blue-600">
                    <Building className="w-3 h-3 mr-1" />
                    Business Owner
                  </Badge>
                )}

                {suggestion.is_duplicate && (
                  <Badge variant="outline" className="text-orange-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Potential Duplicate
                  </Badge>
                )}

                {suggestion.is_business_closed && (
                  <Badge variant="outline" className="text-red-600">
                    <XCircle className="w-3 h-3 mr-1" />
                    Business Closed
                  </Badge>
                )}
              </div>

              {suggestion.context && (
                <div>
                  <div className="font-medium text-sm mb-1">User Context:</div>
                  <div className="p-3 bg-muted rounded text-sm">
                    {suggestion.context}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Changes Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suggested Changes</CardTitle>
              <CardDescription>
                Compare current values with suggested changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.keys(changes).length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No changes suggested
                </div>
              ) : (
                <>
                  {renderChangeComparison('name', entity?.name, changes.name)}
                  {renderChangeComparison('description', entity?.description, changes.description)}
                  {renderChangeComparison('website', entity?.website_url, changes.website)}
                  {renderChangeComparison('phone', currentMetadata.phone, changes.phone)}
                  {changes.hours && renderHoursComparison(currentMetadata.hours, changes.hours)}
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Review Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Admin Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="admin-notes" className="text-sm font-medium">
                  Admin Notes (Optional)
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add any notes about this review decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="apply-changes"
                  checked={applyChanges}
                  onCheckedChange={setApplyChanges}
                />
                <Label htmlFor="apply-changes" className="text-sm">
                  Apply changes to entity immediately upon approval
                </Label>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                {suggestion.status === 'approved' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleApprove(true)}
                    disabled={isProcessing}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isProcessing ? 'Re-applying...' : 'Re-apply Changes'}
                  </Button>
                )}

                <Button
                  onClick={() => handleApprove()}
                  disabled={isProcessing || suggestion.status !== 'pending'}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Suggestion
                </Button>

                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isProcessing || suggestion.status !== 'pending'}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Suggestion
                </Button>

                {suggestion.status !== 'pending' && (
                  <div className="text-sm text-muted-foreground">
                    This suggestion has already been {suggestion.status}
                    {suggestion.reviewed_at && (
                      <> {formatDistanceToNow(new Date(suggestion.reviewed_at), { addSuffix: true })}</>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};