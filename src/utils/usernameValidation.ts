
import { supabase } from '@/integrations/supabase/client';

export const validateUsernameFormat = (value: string): string => {
  if (!value) return 'Username is required';
  if (value !== value.toLowerCase()) return 'Username must be lowercase';
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (value.length > 20) return 'Username must be less than 20 characters';
  if (!/^[a-z0-9._]+$/.test(value)) return 'Username can only contain lowercase letters, numbers, dots, and underscores';
  return '';
};

export const checkUsernameUniqueness = async (value: string): Promise<{ isUnique: boolean; error: string }> => {
  try {
    // Ensure lowercase
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
