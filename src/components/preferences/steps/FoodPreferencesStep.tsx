
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FoodPreferencesStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const dietaryPreferences = [
  'Vegetarian', 
  'Vegan', 
  'Non-Vegetarian', 
  'No Onion/Garlic', 
  'Gluten-Free',
  'Other'
];

const FoodPreferencesStep: React.FC<FoodPreferencesStepProps> = ({ onChange, initialData }) => {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
    initialData.food_preferences || []
  );
  const [otherPreference, setOtherPreference] = useState<string>(
    initialData.other_food_preferences || ''
  );
  const [showOther, setShowOther] = useState<boolean>(
    (initialData.food_preferences || []).includes('Other')
  );

  useEffect(() => {
    const data: Record<string, any> = { food_preferences: selectedPreferences };
    if (showOther && otherPreference) {
      data.other_food_preferences = otherPreference;
    }
    onChange(data);
  }, [selectedPreferences, otherPreference, showOther, onChange]);

  const handlePreferenceChange = (value: string) => {
    let newSelected;
    
    if (selectedPreferences.includes(value)) {
      newSelected = selectedPreferences.filter(item => item !== value);
    } else {
      newSelected = [...selectedPreferences, value];
    }
    
    setSelectedPreferences(newSelected);
    
    if (value === 'Other') {
      setShowOther(!showOther);
      if (showOther) {
        setOtherPreference('');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="food-preferences">What are your food preferences?</Label>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {dietaryPreferences.map((preference) => (
            <button
              key={preference}
              type="button"
              onClick={() => handlePreferenceChange(preference)}
              className={`px-4 py-2 rounded-full border text-sm
                ${selectedPreferences.includes(preference) 
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted/50 border-input'
                }`}
            >
              {preference}
            </button>
          ))}
        </div>
      </div>

      {showOther && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="other-food-preferences">Please specify:</Label>
          <Input
            id="other-food-preferences"
            placeholder="e.g., Keto, Dairy-free"
            value={otherPreference}
            onChange={(e) => setOtherPreference(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default FoodPreferencesStep;
