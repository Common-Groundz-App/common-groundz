import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface AddToMyStuffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddToMyStuffModal = ({ open, onOpenChange }: AddToMyStuffModalProps) => {
  const [status, setStatus] = useState('currently_using');
  const [sentiment, setSentiment] = useState([0]);

  const handleSubmit = () => {
    // TODO: Implement add to my stuff logic
    console.log({ status, sentiment: sentiment[0] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to My Stuff</DialogTitle>
          <DialogDescription>
            Search for an item and add it to your personal inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Search - TODO: Integrate EntitySearch component */}
          <div className="space-y-2">
            <Label>Search for item</Label>
            <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
              Entity search will be integrated here
            </div>
          </div>

          {/* Status Selector */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="currently_using">Currently Using</SelectItem>
                <SelectItem value="used_before">Used Before</SelectItem>
                <SelectItem value="want_to_try">Want to Try</SelectItem>
                <SelectItem value="wishlist">Wishlist</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sentiment Score */}
          <div className="space-y-2">
            <Label>How do you feel about it? ({sentiment[0]})</Label>
            <div className="pt-2">
              <Slider
                value={sentiment}
                onValueChange={setSentiment}
                min={-5}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Hate it (-5)</span>
                <span>Neutral (0)</span>
                <span>Love it (+5)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add to My Stuff
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToMyStuffModal;
