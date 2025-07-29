import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { reportPhoto } from '@/services/photoService';
import { MediaItem } from '@/types/media';
import { useToast } from '@/hooks/use-toast';

interface PhotoReportModalProps {
  photo: MediaItem & { source?: string; reviewId?: string };
  entityId: string;
  onClose: () => void;
  onReported: () => void;
}

const REPORT_REASONS = [
  { value: 'nsfw', label: 'NSFW / Nudity' },
  { value: 'spam', label: 'Spam / Irrelevant' },
  { value: 'low_quality', label: 'Low Quality / Blurry' },
  { value: 'inaccurate', label: 'Inaccurate / Misleading' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' }
];

export const PhotoReportModal: React.FC<PhotoReportModalProps> = ({
  photo,
  entityId,
  onClose,
  onReported
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      toast({
        title: 'Please select a reason',
        description: 'You must select a reason for reporting this photo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await reportPhoto(
        photo.url,
        photo.source || 'unknown',
        entityId,
        photo.reviewId,
        selectedReason,
        description || undefined
      );
      
      toast({
        title: 'Photo reported',
        description: 'Thank you for helping keep our community safe. We\'ll review your report.',
      });
      
      onReported();
    } catch (error) {
      console.error('Error reporting photo:', error);
      toast({
        title: 'Failed to report photo',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report Photo
          </DialogTitle>
          <DialogDescription>
            Please let us know why you're reporting this photo. Your report will be reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo preview */}
          <div className="flex justify-center">
            <img
              src={photo.url}
              alt="Reported photo"
              className="w-24 h-24 object-cover rounded-lg border"
            />
          </div>

          {/* Reason selection */}
          <div className="space-y-3">
            <Label>Reason for reporting</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {REPORT_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label 
                    htmlFor={reason.value} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional description */}
          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide any additional context that might help us understand the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive" 
              disabled={isSubmitting || !selectedReason}
            >
              {isSubmitting ? 'Reporting...' : 'Report Photo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};