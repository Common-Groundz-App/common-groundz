
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LifestyleStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const lifestyleTypes = ['Minimalist', 'Active', 'Busy', 'Tech-Savvy', 'Mindful', 'Other'];

const LifestyleStep: React.FC<LifestyleStepProps> = ({ onChange, initialData }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialData.lifestyle || []);
  const [otherType, setOtherType] = useState<string>(initialData.other_lifestyle || '');
  const [showOther, setShowOther] = useState<boolean>((initialData.lifestyle || []).includes('Other'));

  useEffect(() => {
    const data: Record<string, any> = { lifestyle: selectedTypes };
    if (showOther && otherType) {
      data.other_lifestyle = otherType;
    }
    onChange(data);
  }, [selectedTypes, otherType, showOther, onChange]);

  const handleTypeChange = (value: string) => {
    let newSelected;
    
    if (selectedTypes.includes(value)) {
      newSelected = selectedTypes.filter(item => item !== value);
    } else {
      newSelected = [...selectedTypes, value];
    }
    
    setSelectedTypes(newSelected);
    
    if (value === 'Other') {
      setShowOther(!showOther);
      if (showOther) {
        setOtherType('');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lifestyle">How would you describe your lifestyle?</Label>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {lifestyleTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2 rounded-full border text-sm
                ${selectedTypes.includes(type) 
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted/50 border-input'
                }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {showOther && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="other-lifestyle">Please specify:</Label>
          <Input
            id="other-lifestyle"
            placeholder="e.g., Outdoor enthusiast, Night owl"
            value={otherType}
            onChange={(e) => setOtherType(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default LifestyleStep;
