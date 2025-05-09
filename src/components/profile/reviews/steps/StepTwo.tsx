
import React from 'react';
import CategorySelector from '@/components/profile/reviews/CategorySelector';

interface StepTwoProps {
  category: string;
  onChange: (category: string) => void;
}

const StepTwo = ({ category, onChange }: StepTwoProps) => {
  return (
    <div className="flex flex-col items-center py-6 px-4 space-y-6 w-full">
      <h2 className="text-xl font-medium text-center">
        What are you reviewing?
      </h2>
      
      <CategorySelector selected={category} onChange={onChange} />
      
      <p className="text-center text-muted-foreground">
        {category 
          ? `You've selected ${category}. You can change your selection anytime.` 
          : "Select a category that best matches what you're reviewing."}
      </p>
    </div>
  );
};

export default StepTwo;
