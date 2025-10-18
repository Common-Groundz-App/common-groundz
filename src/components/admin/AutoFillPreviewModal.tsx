import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';

interface AutoFillPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictions: any;
  onApply: () => void;
}

interface PreviewFieldProps {
  label: string;
  value: string | string[];
  multiline?: boolean;
  isImage?: boolean;
}

const PreviewField: React.FC<PreviewFieldProps> = ({ label, value, multiline, isImage }) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  
  const displayValue = Array.isArray(value) ? value.join(', ') : value;
  
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {isImage ? (
        <img 
          src={displayValue} 
          alt={label} 
          className="mt-2 rounded-md max-h-32 object-cover w-full" 
        />
      ) : multiline ? (
        <p className="text-sm leading-relaxed">{displayValue}</p>
      ) : (
        <p className="text-sm font-medium">{displayValue}</p>
      )}
    </div>
  );
};

export const AutoFillPreviewModal: React.FC<AutoFillPreviewModalProps> = ({
  open,
  onOpenChange,
  predictions,
  onApply
}) => {
  if (!predictions?.predictions) return null;
  
  const pred = predictions.predictions;
  const confidence = pred.confidence || 0;
  const isHighConfidence = confidence > 0.8;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis Results
          </DialogTitle>
          <DialogDescription>
            Review the predicted information before applying to the form
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Confidence Badge */}
          <div className="flex items-center gap-3">
            {isHighConfidence ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            <Badge 
              variant={isHighConfidence ? "default" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {Math.round(confidence * 100)}% Confidence
            </Badge>
            {!isHighConfidence && (
              <span className="text-xs text-muted-foreground">
                Please review carefully
              </span>
            )}
          </div>
          
          {/* Predictions Grid */}
          <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
            <PreviewField 
              label="Type" 
              value={pred.type ? getEntityTypeLabel(pred.type) : ''} 
            />
            <PreviewField label="Name" value={pred.name} />
            <PreviewField 
              label="Category" 
              value={pred.matched_category_name || pred.suggested_category_path} 
            />
            <PreviewField label="Tags" value={pred.tags} />
            <PreviewField 
              label="Description" 
              value={pred.description} 
              multiline 
            />
            
            {/* Show first image if available */}
            {pred.images && pred.images.length > 0 && (
              <PreviewField 
                label="Primary Image" 
                value={pred.images[0]} 
                isImage 
              />
            )}
            
            {/* Additional Data */}
            {pred.additional_data && Object.keys(pred.additional_data).length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Additional Information</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(pred.additional_data).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* AI Reasoning */}
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>AI Reasoning</AlertTitle>
            <AlertDescription className="text-sm">
              {pred.reasoning}
            </AlertDescription>
          </Alert>
          
          {/* Warning for low confidence */}
          {!isHighConfidence && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Low Confidence Prediction</AlertTitle>
              <AlertDescription className="text-xs">
                The AI has low confidence in these predictions. 
                Please review and edit the fields manually after applying.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={onApply} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Apply to Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
