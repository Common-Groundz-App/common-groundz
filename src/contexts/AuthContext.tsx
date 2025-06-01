
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  console.log(`🔑 [AuthContext] Render #${renderCount.current} - isLoading: ${isLoading}, hasUser: ${!!user}`);

  React.useEffect(() => {
    let mounted = true;
    let hasInitialized = false;
    
    console.log('🔧 [AuthContext] Setting up auth listener...');

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`🔄 [AuthContext] Auth event: ${event}, hasUser: ${!!currentSession?.user}, mounted: ${mounted}`);
        
        if (mounted && !hasInitialized) {
          hasInitialized = true;
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setIsLoading(false);
          console.log('✅ [AuthContext] Initial auth state set');
        } else if (mounted && hasInitialized) {
          // Only update if this is a subsequent change
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      }
    );

    // Check for existing session - but only once
    const getInitialSession = async () => {
      if (hasInitialized) return;
      
      try {
        console.log('📋 [AuthContext] Checking initial session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Session error:', error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        console.log(`📋 [AuthContext] Initial session: ${!!data.session}`);
        
        if (mounted && !hasInitialized) {
          hasInitialized = true;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ [AuthContext] Setup error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      console.log('🧹 [AuthContext] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []); // No dependencies to prevent re-runs

  const signIn = React.useCallback(async (email: string, password: string) => {
    try {
      console.log('🔑 Attempting sign in for:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { error: error as Error };
    }
  }, []);

  const signUp = React.useCallback(async (email: string, password: string, userData?: { 
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
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      console.log('🚪 Attempting sign out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error);
        return { error };
      }
      
      console.log('✅ Sign out successful');
      return { error: null };
    } catch (error) {
      console.error('❌ Error during sign out:', error);
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
