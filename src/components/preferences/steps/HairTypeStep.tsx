
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface HairTypeStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const hairTypes = ['Straight', 'Wavy', 'Curly', 'Frizzy', 'Oily', 'Dry', 'Other'];

const HairTypeStep: React.FC<HairTypeStepProps> = ({ onChange, initialData }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialData.hair_type || []);
  const [otherType, setOtherType] = useState<string>(initialData.other_hair_type || '');
  const [showOther, setShowOther] = useState<boolean>((initialData.hair_type || []).includes('Other'));

  useEffect(() => {
    const data: Record<string, any> = { hair_type: selectedTypes };
    if (showOther && otherType) {
      data.other_hair_type = otherType;
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
        <Label htmlFor="hair-type">What's your hair type?</Label>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {hairTypes.map((type) => (
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
          <Label htmlFor="other-hair-type">Please specify:</Label>
          <Input
            id="other-hair-type"
            placeholder="e.g., Thin, Color-treated"
            value={otherType}
            onChange={(e) => setOtherType(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default HairTypeStep;
