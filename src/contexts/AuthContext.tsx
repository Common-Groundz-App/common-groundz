
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
    let authInitialized = false;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            console.log('🔄 Auth state changed:', event, currentSession?.user?.email || 'no user');
            
            if (mounted) {
              setSession(currentSession);
              setUser(currentSession?.user ?? null);
              
              // Only set loading to false once we've handled the auth state change
              if (!authInitialized) {
                authInitialized = true;
                console.log('✅ Auth initialized via state change');
                setIsLoading(false);
              }
            }
          }
        );

        // Add a timeout fallback to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (!authInitialized && mounted) {
            console.log('⏰ Auth initialization timeout, setting loading to false');
            authInitialized = true;
            setIsLoading(false);
          }
        }, 3000);

        // THEN check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          if (!authInitialized && mounted) {
            authInitialized = true;
            setIsLoading(false);
          }
          return;
        }

        console.log('📋 Initial session check:', data.session?.user?.email || 'no user');
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          
          // Set loading to false if we haven't already via the state change listener
          if (!authInitialized) {
            authInitialized = true;
            console.log('✅ Auth initialized via session check');
            setIsLoading(false);
          }
        }

        // Clear the timeout since we've completed initialization
        clearTimeout(timeoutId);

        return () => {
          console.log('🧹 Cleaning up auth subscription');
          subscription.unsubscribe();
          clearTimeout(timeoutId);
        };
      } catch (error) {
        console.error('❌ Error setting up auth:', error);
        if (mounted && !authInitialized) {
          authInitialized = true;
          setIsLoading(false);
        }
      }
    };

    const cleanup = initializeAuth();
    
    return () => {
      mounted = false;
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 Attempting sign in for:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, userData?: { 
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => {
    try {
      console.log('📝 Attempting sign up for:', email);
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
      console.error('❌ Sign up error:', error);
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Attempting sign out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error);
        return { error };
      }
      
      console.log('✅ Sign out successful - auth state will be cleared by onAuthStateChange');
      return { error: null };
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
