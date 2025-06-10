
import { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  cover_url?: string;
  preferences?: any;
  created_at: string;
  updated_at: string;
}

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, userData?: { 
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => Promise<{ error: Error | null, user: User | null }>;
  signOut: () => Promise<{ error: Error | null }>;
};
