
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AtSign } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { validateUsernameFormat, checkUsernameUniqueness, checkUsernameNotHistorical } from '@/utils/usernameValidation';

interface UsernameFieldProps {
  username: string;
  setUsername: (value: string) => void;
  usernameError: string;
  setUsernameError: (error: string) => void;
  isCheckingUsername: boolean;
  setIsCheckingUsername: (isChecking: boolean) => void;
}

const UsernameField = ({ 
  username, 
  setUsername, 
  usernameError, 
  setUsernameError, 
  isCheckingUsername, 
  setIsCheckingUsername 
}: UsernameFieldProps) => {
  
  // Debounced availability check (400ms delay)
  const debouncedCheckAvailability = useDebouncedCallback(
    async (value: string) => {
      if (value.length >= 3) {
        setIsCheckingUsername(true);
        
        // Check historical first
        const { isAvailable, error: historyError } = await checkUsernameNotHistorical(value);
        if (!isAvailable) {
          setUsernameError(historyError);
          setIsCheckingUsername(false);
          return;
        }
        
        // Then check uniqueness
        const { isUnique, error: uniqueError } = await checkUsernameUniqueness(value);
        if (!isUnique) {
          setUsernameError(uniqueError);
        }
        setIsCheckingUsername(false);
      }
    },
    400
  );

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
    
    // Immediate format validation
    const formatError = validateUsernameFormat(value);
    setUsernameError(formatError);
    
    // Only check availability if format is valid
    if (!formatError && value.length >= 3) {
      debouncedCheckAvailability(value);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="signup-username">Username</Label>
      <div className="relative">
        <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          id="signup-username" 
          placeholder="username" 
          value={username}
          onChange={handleUsernameChange}
          required
          className={`pl-10 ${usernameError ? 'border-red-500' : ''}`}
        />
      </div>
      {usernameError && (
        <p className="text-red-500 text-xs mt-1">{usernameError}</p>
      )}
      {isCheckingUsername && (
        <p className="text-gray-500 text-xs mt-1">Checking username availability...</p>
      )}
      <p className="text-xs text-gray-500">
        3-20 characters. Letters, numbers, dots, and underscores only. Cannot start or end with dots/underscores.
      </p>
    </div>
  );
};

export default UsernameField;
