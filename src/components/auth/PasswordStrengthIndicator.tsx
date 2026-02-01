import React from 'react';
import { calculatePasswordStrength, PasswordStrength } from '@/utils/passwordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;

  const strength = calculatePasswordStrength(password);

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= strength.score ? strength.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      {/* Label and feedback */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${
          strength.score < 2 ? 'text-destructive' : 
          strength.score < 3 ? 'text-yellow-600 dark:text-yellow-400' : 
          'text-green-600 dark:text-green-400'
        }`}>
          {strength.label}
        </span>
      </div>
      
      {/* Improvement tips */}
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {strength.feedback.map((tip, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="text-muted-foreground">•</span>
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
