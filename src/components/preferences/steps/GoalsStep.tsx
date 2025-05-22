
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface GoalsStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const suggestedGoals = [
  'Improve sleep',
  'Improve skin',
  'Build muscle',
  'Lose fat',
  'Read more',
  'Reduce screen time',
  'Wake up early'
];

const GoalsStep: React.FC<GoalsStepProps> = ({ onChange, initialData }) => {
  const [goals, setGoals] = useState<string[]>(initialData.goals || []);
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    onChange({ goals });
  }, [goals, onChange]);

  const addGoal = (goal: string) => {
    if (goal.trim() && !goals.includes(goal.trim())) {
      setGoals([...goals, goal.trim()]);
    }
  };

  const removeGoal = (goal: string) => {
    setGoals(goals.filter(g => g !== goal));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addGoal(inputValue);
      setInputValue('');
    }
  };

  const handleSuggestedGoalClick = (goal: string) => {
    if (!goals.includes(goal)) {
      setGoals([...goals, goal]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goals">What are your goals?</Label>
        <p className="text-sm text-muted-foreground">
          Add your personal goals or select from suggestions
        </p>
        
        <div className="mt-2">
          <Input
            id="goals"
            placeholder="Type a goal and press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        
        {/* Selected Goals */}
        {goals.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {goals.map((goal) => (
              <div 
                key={goal}
                className="bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1 text-sm flex items-center gap-1"
              >
                <span>{goal}</span>
                <button 
                  type="button"
                  onClick={() => removeGoal(goal)}
                  className="text-primary hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Suggested Goals */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedGoals
              .filter(goal => !goals.includes(goal))
              .map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => handleSuggestedGoalClick(goal)}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground rounded-full px-3 py-1 text-sm"
                >
                  {goal}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsStep;
