
import { supabase } from '@/integrations/supabase/client';

// Reserved usernames for immediate frontend feedback
// (Database trigger is the source of truth)
const RESERVED_USERNAMES = [
  'admin', 'administrator', 'support', 'help', 'api', 
  'system', 'root', 'mod', 'moderator', 'staff',
  'commongroundz', 'official', 'verified', 'null', 'undefined',
  'rishab_sr', 'linda_williams'
];

export const validateUsernameFormat = (value: string): string => {
  if (!value) return 'Username is required';
  if (value !== value.toLowerCase()) return 'Username must be lowercase';
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (value.length > 20) return 'Username must be less than 20 characters';
  
  // Check for reserved usernames
  if (RESERVED_USERNAMES.includes(value.toLowerCase())) {
    return 'This username is reserved';
  }
  
  // Basic character check
  if (!/^[a-z0-9._]+$/.test(value)) {
    return 'Username can only contain lowercase letters, numbers, dots, and underscores';
  }
  
  // No leading/trailing dots or underscores
  if (/^[._]|[._]$/.test(value)) {
    return 'Username cannot start or end with a dot or underscore';
  }
  
  // No consecutive dots or underscores
  if (/[._]{2,}/.test(value)) {
    return 'Username cannot have consecutive dots or underscores';
  }
  
  return '';
};

export const checkUsernameUniqueness = async (value: string): Promise<{ isUnique: boolean; error: string }> => {
  try {
    const lowercaseValue = value.toLowerCase();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', lowercaseValue)
      .maybeSingle();
    
    if (error) throw error;
    
    if (data) {
      return { isUnique: false, error: 'Username is already taken' };
    } else {
      return { isUnique: true, error: '' };
    }
  } catch (error) {
    console.error('Error checking username:', error);
    return { isUnique: false, error: 'Error checking username availability' };
  }
};

export const checkUsernameNotHistorical = async (
  value: string
): Promise<{ isAvailable: boolean; error: string }> => {
  try {
    const normalizedValue = value.toLowerCase();
    
    const { data, error } = await supabase
      .from('username_history')
      .select('user_id')
      .eq('old_username', normalizedValue)
      .maybeSingle();
    
    if (error) throw error;
    
    if (data) {
      return { 
        isAvailable: false, 
        error: 'This username was previously used and is no longer available' 
      };
    }
    return { isAvailable: true, error: '' };
  } catch (error) {
    console.error('Error checking username history:', error);
    return { isAvailable: false, error: 'Error checking username availability' };
  }
};
