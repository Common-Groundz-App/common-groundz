import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  ExternalLink,
  Award,
  Calendar,
  Mail,
  Download,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AdminSuggestion } from '@/hooks/admin/useAdminSuggestions';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Link } from 'react-router-dom';
import { downloadFileFromUrl } from '@/utils/downloadUtils';
import { toast } from 'sonner';

interface ClaimReviewModalProps {
  claim: AdminSuggestion | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: (
    claimId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
    applyChanges?: boolean
  ) => Promise<void>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const ClaimReviewModal: React.FC<ClaimReviewModalProps> = ({
  claim,
  isOpen,
  onOpenChange,
  onStatusUpdate
}) => {
  const [adminNotes, setAdminNotes] = useState('');
  const [applyChanges, setApplyChanges] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  if (!claim) return null;

  const handleApprove = async (forceReApply = false) => {
    setIsProcessing(true);
    try {
      const shouldApply = forceReApply || applyChanges;
      console.log('🔧 ClaimReviewModal: handleApprove called', {
        claimId: claim.id,
        forceReApply,
        applyChanges,
        shouldApply,
        status: 'approved'
      });
      
      await onStatusUpdate(claim.id, 'approved', adminNotes || undefined, shouldApply);
      onOpenChange(false);
      setAdminNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onStatusUpdate(claim.id, 'rejected', adminNotes || undefined, false);
      onOpenChange(false);
      setAdminNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (url: string) => {
    if (downloadingFiles.has(url)) return;
    
    setDownloadingFiles(prev => new Set(prev).add(url));
    
    try {
      await downloadFileFromUrl(url);
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    }
  };

  const renderFormField = (label: string, value: any, required = false) => {
    const hasValue = value !== null && value !== undefined && value !== '';
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm">{label}</span>
          {required && <span className="text-destructive text-xs">*</span>}
        </div>
        <div className={`p-2 rounded border text-sm ${
          hasValue 
            ? 'bg-green-50 border-green-200 text-green-900' 
            : 'bg-gray-50 border-gray-200 text-gray-500'
        }`}>
          {hasValue ? String(value) : 'Not provided'}
        </div>
      </div>
    );
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

  const changes = claim.suggested_changes || {};
  const entity = claim.entity;
  const currentMetadata = entity?.metadata || {};

  // Extract owner information from suggested changes for claims
  const ownerInfo = {
    name: changes.owner_name || '',
    title: changes.owner_title || '',
    email: changes.owner_email || '',
    phone: changes.owner_phone || '',
    ownershipDuration: changes.ownership_duration || '',
    contactPreferences: changes.contact_preferences || ''
  };
  const verificationDocs = claim.suggested_images || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Review Business Ownership Claim
          </DialogTitle>
          <DialogDescription>
            Review the business claim details and supporting documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entity Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Information</CardTitle>
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
                      <Badge variant="outline" className="capitalize">
                        {entity.type}
                      </Badge>
                      <Link
                        to={`/entity/${entity.id}?v=4`}
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

          {/* Step 1: Owner Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Step 1: Owner Information
              </CardTitle>
              <CardDescription>Information about the business owner making the claim</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">User Profile:</span>
                    <span>{claim.user?.username || 'Unknown User'}</span>
                  </div>
                  
                  {renderFormField('Full Name', ownerInfo.name, true)}
                  {renderFormField('Title/Position', ownerInfo.title)}
                  {renderFormField('Contact Email', ownerInfo.email, true)}
                </div>

                <div className="space-y-3">
                  {renderFormField('Phone Number', ownerInfo.phone, true)}
                  {renderFormField('Ownership Duration', ownerInfo.ownershipDuration, true)}
                  {renderFormField('Contact Preference', ownerInfo.contactPreferences)}
                  
                  <div className="flex items-center gap-2 mt-4 pt-2 border-t">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Submitted:</span>
                    <span className="text-sm">{formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Step 2: Business Information Updates
              </CardTitle>
              <CardDescription>Business details submitted by the claimant (filled and unfilled fields)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {renderFormField('Business Name', changes.name)}
                  {renderFormField('Business Phone', changes.phone)}
                  {renderFormField('Business Email', changes.email)}
                </div>
                <div className="space-y-3">
                  {renderFormField('Business Address', changes.address)}
                  {renderFormField('Website', changes.website)}
                </div>
              </div>

              {/* Business Hours */}
              {changes.hours && (
                <div className="mt-6">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Business Hours
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {DAYS.map(day => (
                      <div key={day} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="capitalize font-medium text-sm">{day}:</span>
                        <span className="text-sm">{changes.hours[day] || 'Not set'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Supporting Documents - Always Show */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Step 3: Supporting Documents
              </CardTitle>
              <CardDescription>
                Verification documents uploaded by the claimant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verificationDocs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {verificationDocs.map((doc, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{doc.name || `Document ${index + 1}`}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {doc.type || 'Unknown type'}
                      </div>
                      {doc.caption && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          {doc.caption}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDownload(doc.url)}
                          disabled={downloadingFiles.has(doc.url)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {downloadingFiles.has(doc.url) ? 'Downloading...' : 'Download'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <h4 className="font-medium text-base mb-1">No Documents Uploaded</h4>
                  <p className="text-sm">The claimant did not upload any verification documents</p>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                    <strong>Admin Note:</strong> You may want to request verification documents before approving this claim.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Claim Context */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Step 4: Claim Context & Justification
              </CardTitle>
              <CardDescription>Why the user is claiming this business</CardDescription>
            </CardHeader>
            <CardContent>
              {claim.context ? (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="whitespace-pre-wrap text-sm">{claim.context}</div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No context provided</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Claim Status and Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claim Status & Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${claim.priority_score >= 70 ? 'bg-red-100 text-red-800' : 
                  claim.priority_score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  Priority: {claim.priority_score >= 70 ? 'High' : 
                    claim.priority_score >= 40 ? 'Medium' : 'Low'}
                </Badge>

                <Badge variant="outline" className="text-blue-600">
                  <Building className="w-3 h-3 mr-1" />
                  Business Owner Claim
                </Badge>

                {claim.is_duplicate && (
                  <Badge variant="outline" className="text-orange-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Potential Duplicate
                  </Badge>
                )}

                {claim.is_business_closed && (
                  <Badge variant="outline" className="text-red-600">
                    <XCircle className="w-3 h-3 mr-1" />
                    Business Closed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>


          {/* Compare Current vs Suggested Changes (if any) */}
          {Object.keys(changes).some(key => !key.startsWith('owner_') && !key.includes('contact_preferences')) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current vs Suggested Changes</CardTitle>
                <CardDescription>
                  Compare current business information with suggested changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderChangeComparison('name', entity?.name, changes.name)}
                {renderChangeComparison('description', entity?.description, changes.description)}
                {renderChangeComparison('website', entity?.website_url, changes.website)}
                {renderChangeComparison('email', currentMetadata.email, changes.email)}
                {renderChangeComparison('address', currentMetadata.formatted_address || currentMetadata.address, changes.address)}
                {renderChangeComparison('phone', currentMetadata.phone, changes.phone)}
                {changes.hours && renderHoursComparison(currentMetadata.hours, changes.hours)}
              </CardContent>
            </Card>
          )}

          {/* Admin Review Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Admin Review & Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="admin-notes" className="text-sm font-medium">
                  Admin Review Notes
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes about verification status, documents reviewed, contact made, etc..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="apply-changes"
                  checked={applyChanges}
                  onCheckedChange={setApplyChanges}
                />
                <Label htmlFor="apply-changes" className="text-sm">
                  Mark entity as "Claimed" and apply suggested changes upon approval
                </Label>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                {claim.status === 'approved' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleApprove(true)}
                    disabled={isProcessing}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isProcessing ? 'Re-applying...' : 'Re-apply & Mark as Claimed'}
                  </Button>
                )}

                <Button
                  onClick={() => handleApprove()}
                  disabled={isProcessing || claim.status !== 'pending'}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Claim
                </Button>

                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isProcessing || claim.status !== 'pending'}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Claim
                </Button>

                {claim.status !== 'pending' && (
                  <div className="text-sm text-muted-foreground">
                    This claim has been {claim.status}
                    {claim.reviewed_at && (
                      <> {formatDistanceToNow(new Date(claim.reviewed_at), { addSuffix: true })}</>
                    )}
                    {claim.reviewer && (
                      <> by {claim.reviewer.username}</>
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