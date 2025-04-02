
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AtSign } from 'lucide-react';
import { validateUsernameFormat, checkUsernameUniqueness } from '@/utils/usernameValidation';

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
  
  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
    
    const formatError = validateUsernameFormat(value);
    setUsernameError(formatError);
    
    if (!formatError && value.length >= 3) {
      setIsCheckingUsername(true);
      const { isUnique, error } = await checkUsernameUniqueness(value);
      setUsernameError(error);
      setIsCheckingUsername(false);
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
      <p className="text-xs text-gray-500">Username must be lowercase, contain only letters, numbers, dots, and underscores.</p>
    </div>
  );
};

export default UsernameField;
