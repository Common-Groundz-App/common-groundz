
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
    
    const initializeAuth = async () => {
      try {
        // Get initial session first
        const { data, error } = await supabase.auth.getSession();
        
        if (mounted && !error) {
          console.log('Initial session:', data.session ? 'Found' : 'None');
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
        
        if (mounted) {
          // Set up auth state listener for future changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              console.log('Auth event:', event, currentSession ? 'Session present' : 'No session');
              
              if (mounted) {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                // Handle sign out event specifically
                if (event === 'SIGNED_OUT') {
                  console.log('User signed out - clearing all state');
                  setSession(null);
                  setUser(null);
                }
              }
            }
          );
          
          // Mark as fully initialized
          setIsLoading(false);
          
          return () => {
            mounted = false;
            subscription.unsubscribe();
          };
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    const cleanup = initializeAuth();
    
    return () => {
      mounted = false;
      cleanup?.then(cleanupFn => cleanupFn?.());
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
      console.log('Attempting to sign out...');
      
      // Check if we have a valid session before attempting logout
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.log('No active session found, clearing local state');
        // Force clear state even if no session
        setSession(null);
        setUser(null);
        return { error: null };
      }
      
      console.log('Active session found, proceeding with logout');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        // If logout fails due to session issues, still clear local state
        if (error.message?.includes('session') || error.message?.includes('missing')) {
          console.log('Session error during logout, forcing local state clear');
          setSession(null);
          setUser(null);
          return { error: null }; // Don't return the error since we handled it
        }
        return { error };
      }
      
      console.log('Logout successful');
      // Force clear state immediately after successful logout
      setSession(null);
      setUser(null);
      return { error: null };
    } catch (error) {
      console.error('Unexpected error during signOut:', error);
      // Force clear state on any error
      setSession(null);
      setUser(null);
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
