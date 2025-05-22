
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SelectablePillsProps {
  options: Array<{ label: string; value: string; emoji?: string }>;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allowMultiple?: boolean;
  allowOther?: boolean;
  otherValues?: string[];
  onOtherChange?: (values: string[]) => void;
  conflictGroups?: Record<string, string[]>;
}

const SelectablePills: React.FC<SelectablePillsProps> = ({
  options,
  selectedValues,
  onChange,
  allowMultiple = true,
  allowOther = true,
  otherValues = [],
  onOtherChange,
  conflictGroups = {}
}) => {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInput, setOtherInput] = useState('');
  
  // Reset "Other" state when selectedValues change (which happens on step change)
  useEffect(() => {
    // Only reset if "other" is not in selectedValues
    if (!selectedValues.includes('other')) {
      setShowOtherInput(false);
    }
  }, [selectedValues]);

  const handlePillClick = (value: string) => {
    if (value === 'other') {
      setShowOtherInput(true);
      return;
    }

    let newSelectedValues;
    
    // Handle conflicts
    if (conflictGroups) {
      // Find if the clicked value belongs to a conflict group
      const conflictingGroup = Object.entries(conflictGroups).find(([groupName, values]) => 
        values.includes(value)
      );
      
      if (conflictingGroup) {
        const [groupName, conflictValues] = conflictingGroup;
        
        // If the value is already selected, just remove it
        if (selectedValues.includes(value)) {
          newSelectedValues = selectedValues.filter(v => v !== value);
        } else {
          // If selecting a new value from a conflict group, remove other values from the same group
          newSelectedValues = [
            ...selectedValues.filter(v => !conflictValues.includes(v)),
            value
          ];
        }
      } else if (allowMultiple) {
        // Normal toggle behavior for non-conflicting values
        if (selectedValues.includes(value)) {
          newSelectedValues = selectedValues.filter(v => v !== value);
        } else {
          newSelectedValues = [...selectedValues, value];
        }
      } else {
        newSelectedValues = [value];
      }
    } else if (allowMultiple) {
      // Fall back to original behavior if no conflict groups defined
      if (selectedValues.includes(value)) {
        newSelectedValues = selectedValues.filter(v => v !== value);
      } else {
        newSelectedValues = [...selectedValues, value];
      }
    } else {
      newSelectedValues = [value];
    }
    
    onChange(newSelectedValues);
  };

  const handleAddOtherValue = () => {
    if (!otherInput.trim()) return;
    
    const newOtherValues = [...otherValues, otherInput.trim()];
    onOtherChange?.(newOtherValues);
    setOtherInput('');
    
    // Auto-deselect "other" once a custom value is added
    const otherIndex = selectedValues.indexOf('other');
    if (otherIndex !== -1) {
      const newSelectedValues = [...selectedValues];
      newSelectedValues.splice(otherIndex, 1);
      onChange(newSelectedValues);
    }
  };

  const handleRemoveOtherValue = (valueToRemove: string) => {
    const newOtherValues = otherValues.filter(v => v !== valueToRemove);
    onOtherChange?.(newOtherValues);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {options.map(option => (
          <Button
            key={option.value}
            type="button"
            variant={selectedValues.includes(option.value) ? "default" : "outline"}
            className={cn(
              "rounded-full h-auto py-1 px-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0", 
              selectedValues.includes(option.value) ? "bg-brand-orange text-white" : ""
            )}
            onClick={() => handlePillClick(option.value)}
          >
            {option.emoji && <span className="mr-1">{option.emoji}</span>}
            {option.label}
          </Button>
        ))}
        
        {allowOther && (
          <Button
            type="button"
            variant={showOtherInput ? "default" : "outline"}
            className={cn(
              "rounded-full h-auto py-1 px-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0", 
              showOtherInput ? "bg-brand-orange text-white" : ""
            )}
            onClick={() => setShowOtherInput(!showOtherInput)}
          >
            ✏️ Other
          </Button>
        )}
      </div>

      {showOtherInput && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={otherInput}
              onChange={e => setOtherInput(e.target.value)}
              placeholder="Add custom option..."
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={handleAddOtherValue} 
              disabled={!otherInput.trim()}
              className="focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Add
            </Button>
          </div>
          
          {otherValues.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {otherValues.map((value, index) => (
                <div 
                  key={index}
                  className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-sm flex items-center"
                >
                  {value}
                  <button 
                    onClick={() => handleRemoveOtherValue(value)}
                    className="ml-1 p-0.5 rounded-full hover:bg-brand-orange/30"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectablePills;
