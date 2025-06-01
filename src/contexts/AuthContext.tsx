
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
    let hasInitialized = false;
    const startTime = Date.now();

    console.log('🔧 [AuthContext] Starting auth initialization...');

    const initializeAuth = async () => {
      try {
        // Set up auth state listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            const timestamp = new Date().toISOString();
            const timeSinceStart = Date.now() - startTime;
            
            console.log(`🔄 [${timestamp}] Auth state changed (+${timeSinceStart}ms):`, {
              event,
              hasUser: !!currentSession?.user,
              userId: currentSession?.user?.id || 'none',
              email: currentSession?.user?.email || 'none',
              mounted,
              hasInitialized
            });
            
            if (mounted) {
              setSession(currentSession);
              setUser(currentSession?.user ?? null);
              
              // Only set loading to false after we've processed the first auth event
              if (!hasInitialized) {
                hasInitialized = true;
                // Add minimum 100ms to prevent flash
                const minLoadTime = 100;
                const elapsed = Date.now() - startTime;
                const delay = Math.max(0, minLoadTime - elapsed);
                
                setTimeout(() => {
                  if (mounted) {
                    console.log(`✅ [${new Date().toISOString()}] Auth initialized via state change (+${Date.now() - startTime}ms)`);
                    setIsLoading(false);
                  }
                }, delay);
              }
            }
          }
        );

        // Then check for existing session
        console.log('📋 [AuthContext] Checking for existing session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Error getting session:', error);
          if (mounted && !hasInitialized) {
            hasInitialized = true;
            setIsLoading(false);
          }
          return;
        }

        const timeSinceStart = Date.now() - startTime;
        console.log(`📋 [AuthContext] Initial session check (+${timeSinceStart}ms):`, {
          hasSession: !!data.session,
          hasUser: !!data.session?.user,
          userId: data.session?.user?.id || 'none',
          email: data.session?.user?.email || 'none'
        });
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          
          // If no auth state change has occurred yet, initialize here
          if (!hasInitialized) {
            hasInitialized = true;
            const minLoadTime = 100;
            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, minLoadTime - elapsed);
            
            setTimeout(() => {
              if (mounted) {
                console.log(`✅ [AuthContext] Auth initialized via session check (+${Date.now() - startTime}ms)`);
                setIsLoading(false);
              }
            }, delay);
          }
        }

        return () => {
          console.log('🧹 [AuthContext] Cleaning up auth subscription');
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('❌ [AuthContext] Error setting up auth:', error);
        if (mounted && !hasInitialized) {
          hasInitialized = true;
          setIsLoading(false);
        }
      }
    };

    const cleanup = initializeAuth();
    
    // Failsafe timeout
    const failsafeTimeout = setTimeout(() => {
      if (mounted && !hasInitialized) {
        console.log('⏰ [AuthContext] Failsafe timeout triggered, setting loading to false');
        hasInitialized = true;
        setIsLoading(false);
      }
    }, 5000);
    
    return () => {
      mounted = false;
      clearTimeout(failsafeTimeout);
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // Log context state changes
  React.useEffect(() => {
    const timeSinceInit = Date.now() - initStartTime;
    console.log(`📊 [AuthContext] State update (+${timeSinceInit}ms):`, {
      isLoading,
      hasUser: !!user,
      hasSession: !!session
    });
  }, [isLoading, user, session, initStartTime]);

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
