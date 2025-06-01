
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setIsLoading(false);
        }
      }
    );

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (mounted && !error) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signUp = React.useCallback(async (email: string, password: string, userData?: { 
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData?.firstName || '',
            last_name: userData?.lastName || '',
            username: userData?.username || '',
          }
        }
      });
      return { error, user: data?.user || null };
    } catch (error) {
      return { error: error as Error, user: null };
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const value = React.useMemo(() => ({
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut
  }), [user, session, isLoading, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
