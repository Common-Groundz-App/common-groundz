import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

interface AddEditRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine?: any;
}

const AddEditRoutineModal = ({ open, onOpenChange, routine }: AddEditRoutineModalProps) => {
  const [name, setName] = useState(routine?.routine_name || '');
  const [description, setDescription] = useState(routine?.description || '');
  const [category, setCategory] = useState(routine?.category || 'custom');
  const [frequency, setFrequency] = useState(routine?.frequency || 'daily');
  const [timeOfDay, setTimeOfDay] = useState(routine?.time_of_day || '');
  const [steps, setSteps] = useState<Array<{ step_name: string; notes: string }>>(
    routine?.steps || []
  );

  const handleAddStep = () => {
    setSteps([...steps, { step_name: '', notes: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: 'step_name' | 'notes', value: string) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = () => {
    // TODO: Implement save logic
    console.log({ name, description, category, frequency, timeOfDay, steps });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine ? 'Edit Routine' : 'Create New Routine'}</DialogTitle>
          <DialogDescription>
            Build a routine with steps that work for you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Routine Name</Label>
            <Input
              placeholder="e.g., Morning Skincare"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Describe your routine..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skincare">Skincare</SelectItem>
                <SelectItem value="haircare">Haircare</SelectItem>
                <SelectItem value="workout">Workout</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="night">Night</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time of Day */}
          <div className="space-y-2">
            <Label>Time of Day (optional)</Label>
            <Select value={timeOfDay} onValueChange={setTimeOfDay}>
              <SelectTrigger>
                <SelectValue placeholder="Select time..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
                <SelectItem value="night">Night</SelectItem>
                <SelectItem value="anytime">Anytime</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steps</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>

            <div className="space-y-3 mt-2">
              {steps.map((step, index) => (
                <div key={index} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-semibold text-muted-foreground mt-2">
                      {index + 1}.
                    </span>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Step name"
                        value={step.step_name}
                        onChange={(e) => handleStepChange(index, 'step_name', e.target.value)}
                      />
                      <Textarea
                        placeholder="Notes (optional)"
                        value={step.notes}
                        onChange={(e) => handleStepChange(index, 'notes', e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStep(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {steps.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No steps added yet. Click "Add Step" to get started.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {routine ? 'Save Changes' : 'Create Routine'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditRoutineModal;
