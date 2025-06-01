
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [initStartTime] = React.useState(Date.now());

  React.useEffect(() => {
    let mounted = true;
    
    console.log('🔧 [AuthContext] Starting auth initialization...');

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const timestamp = new Date().toISOString();
        
        console.log(`🔄 [${timestamp}] Auth state changed:`, {
          event,
          hasUser: !!currentSession?.user,
          userId: currentSession?.user?.id || 'none',
          email: currentSession?.user?.email || 'none',
          mounted
        });
        
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    const getInitialSession = async () => {
      try {
        console.log('📋 [AuthContext] Checking for existing session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Error getting session:', error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        console.log(`📋 [AuthContext] Initial session check:`, {
          hasSession: !!data.session,
          hasUser: !!data.session?.user,
          userId: data.session?.user?.id || 'none',
          email: data.session?.user?.email || 'none'
        });
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ [AuthContext] Error setting up auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Cleanup function
    return () => {
      mounted = false;
      console.log('🧹 [AuthContext] Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to prevent re-runs

  // Log context state changes (but don't use this in useEffect dependencies)
  React.useEffect(() => {
    const timeSinceInit = Date.now() - initStartTime;
    console.log(`📊 [AuthContext] State update (+${timeSinceInit}ms):`, {
      isLoading,
      hasUser: !!user,
      hasSession: !!session
    });
  }, [isLoading, user, session]);

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
      
      console.log('✅ Sign out successful - auth state will be cleared by onAuthStateChange');
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
