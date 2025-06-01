
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true); // Start with loading true
  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    
    console.log('🔧 [AuthProvider] Starting initialization...');
    
    const initializeAuth = async () => {
      try {
        // Step 1: Get initial session first
        console.log('📋 [AuthProvider] Getting initial session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (mounted && !error) {
          console.log('✅ [AuthProvider] Initial session retrieved:', data.session ? 'Found' : 'None');
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
        
        if (mounted) {
          console.log('🎯 [AuthProvider] Setting up auth state listener...');
          
          // Step 2: Set up auth state listener for future changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (mounted) {
                console.log('🔄 [AuthProvider] Auth state changed:', event, currentSession ? 'Has session' : 'No session');
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
              }
            }
          );
          
          // Step 3: Mark as fully initialized
          setIsInitialized(true);
          setIsLoading(false);
          console.log('✨ [AuthProvider] Initialization complete!');
          
          return () => {
            mounted = false;
            subscription.unsubscribe();
          };
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true); // Still mark as initialized to prevent infinite loading
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
