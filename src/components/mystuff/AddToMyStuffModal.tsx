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
import { EntitySearch } from '@/components/recommendations/EntitySearch';
import { EntityAdapter } from '@/components/profile/circles/types';
import { useMyStuff } from '@/hooks/use-my-stuff';

interface AddToMyStuffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddToMyStuffModal = ({ open, onOpenChange }: AddToMyStuffModalProps) => {
  const [status, setStatus] = useState('currently_using');
  const [sentiment, setSentiment] = useState([0]);
  const [selectedEntity, setSelectedEntity] = useState<EntityAdapter | null>(null);
  const [entityType, setEntityType] = useState<'product' | 'book' | 'movie' | 'place' | 'food'>('product');
  
  const { addToMyStuff } = useMyStuff();

  const handleEntitySelect = (entity: EntityAdapter) => {
    setSelectedEntity(entity);
  };

  const handleSubmit = () => {
    if (!selectedEntity || !selectedEntity.id || selectedEntity.id.startsWith('temp-')) {
      return;
    }
    
    addToMyStuff({
      entity_id: selectedEntity.id,
      status,
      sentiment_score: sentiment[0],
    });
    
    // Reset form and close
    setSelectedEntity(null);
    setStatus('currently_using');
    setSentiment([0]);
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedEntity(null);
      setStatus('currently_using');
      setSentiment([0]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to My Stuff</DialogTitle>
          <DialogDescription>
            Search for an item and add it to your personal inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Type Selector */}
          <div className="space-y-2">
            <Label>What type of item?</Label>
            <Select value={entityType} onValueChange={(value: any) => {
              setEntityType(value);
              setSelectedEntity(null);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="place">Place</SelectItem>
                <SelectItem value="food">Restaurant/Cafe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity Search */}
          <div className="space-y-2">
            <Label>Search for item</Label>
            {selectedEntity ? (
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="flex items-center gap-3">
                  {selectedEntity.image_url && (
                    <img 
                      src={selectedEntity.image_url} 
                      alt={selectedEntity.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedEntity.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{selectedEntity.type}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedEntity(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <EntitySearch 
                type={entityType}
                onSelect={handleEntitySelect}
              />
            )}
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
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedEntity || !selectedEntity.id || selectedEntity.id.startsWith('temp-')}
          >
            Add to My Stuff
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToMyStuffModal;
