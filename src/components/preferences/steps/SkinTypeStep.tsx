
import React, { useState, useEffect } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SkinTypeStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const skinTypes = ['Dry', 'Oily', 'Combination', 'Sensitive', 'Normal', 'Other'];

const SkinTypeStep: React.FC<SkinTypeStepProps> = ({ onChange, initialData }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialData.skin_type || []);
  const [otherType, setOtherType] = useState<string>(initialData.other_skin_type || '');
  const [showOther, setShowOther] = useState<boolean>((initialData.skin_type || []).includes('Other'));

  useEffect(() => {
    const data: Record<string, any> = { skin_type: selectedTypes };
    if (showOther && otherType) {
      data.other_skin_type = otherType;
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
        <Label htmlFor="skin-type">What's your skin type?</Label>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {skinTypes.map((type) => (
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
          <Label htmlFor="other-skin-type">Please specify:</Label>
          <Input
            id="other-skin-type"
            placeholder="e.g., Eczema-prone"
            value={otherType}
            onChange={(e) => setOtherType(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default SkinTypeStep;
