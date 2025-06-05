
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// Global state reset function
const forceAuthStateReset = () => {
  console.log('🚨 FORCE AUTH STATE RESET - Clearing all auth data');
  
  // Clear any potential localStorage auth data
  try {
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-uyjtgybbktgapspodajy-auth-token');
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
  
  // Force navigate to home page
  if (window.location.pathname !== '/') {
    console.log('🔄 Forcing navigation to home page');
    window.location.href = '/';
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Session validation function
  const validateSession = React.useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('Session validation error:', error);
        if (user || session) {
          console.log('🚨 Session error but local state shows user - forcing reset');
          setUser(null);
          setSession(null);
          forceAuthStateReset();
        }
        return false;
      }
      
      // Check if local state is inconsistent with server state
      if (!currentSession && (user || session)) {
        console.log('🚨 No server session but local state shows user - forcing reset');
        setUser(null);
        setSession(null);
        forceAuthStateReset();
        return false;
      }
      
      if (currentSession && !user) {
        console.log('✅ Server session found but no local user - updating state');
        setSession(currentSession);
        setUser(currentSession.user);
        return true;
      }
      
      return !!currentSession;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }, [user, session]);

  React.useEffect(() => {
    let mounted = true;
    let sessionCheckInterval: NodeJS.Timeout;
    
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
              console.log('🔄 Auth event:', event, currentSession ? 'Session present' : 'No session');
              
              if (mounted) {
                // Handle SIGNED_OUT event with extra safeguards
                if (event === 'SIGNED_OUT') {
                  console.log('🚨 SIGNED_OUT event - forcing complete state reset');
                  setSession(null);
                  setUser(null);
                  
                  // Force clear any cached data and navigate away
                  setTimeout(() => {
                    forceAuthStateReset();
                  }, 100);
                  return;
                }
                
                // Handle other auth events
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                // Handle sign out event specifically (fallback)
                if (event === 'SIGNED_OUT' || (!currentSession && event === 'TOKEN_REFRESHED')) {
                  console.log('🚨 Auth state cleared - ensuring complete logout');
                  setSession(null);
                  setUser(null);
                  forceAuthStateReset();
                }
              }
            }
          );
          
          // Set up periodic session validation (every 2 minutes)
          sessionCheckInterval = setInterval(() => {
            validateSession();
          }, 120000);
          
          // Set up window focus session validation
          const handleWindowFocus = () => {
            console.log('🔍 Window focused - validating session');
            validateSession();
          };
          
          window.addEventListener('focus', handleWindowFocus);
          
          // Mark as fully initialized
          setIsLoading(false);
          
          return () => {
            mounted = false;
            subscription.unsubscribe();
            clearInterval(sessionCheckInterval);
            window.removeEventListener('focus', handleWindowFocus);
          };
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          // Force reset on initialization error
          forceAuthStateReset();
        }
      }
    };

    const cleanup = initializeAuth();
    
    return () => {
      mounted = false;
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, [validateSession]);

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
      console.log('🚪 Starting enhanced sign out process...');
      
      // Always clear local state first to prevent UI inconsistencies
      const hadSession = !!session;
      setSession(null);
      setUser(null);
      
      // Check if we have a valid session before attempting logout
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession && !hadSession) {
        console.log('✅ No active session found, state already cleared');
        forceAuthStateReset();
        return { error: null };
      }
      
      console.log('🔄 Active session found, proceeding with logout');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Logout API error:', error);
        // If logout fails due to session issues, still force state clear
        if (error.message?.includes('session') || error.message?.includes('missing') || error.message?.includes('expired')) {
          console.log('🚨 Session-related logout error - forcing state clear anyway');
          forceAuthStateReset();
          return { error: null }; // Don't return the error since we handled it
        }
        // For other errors, still clear state but return the error
        forceAuthStateReset();
        return { error };
      }
      
      console.log('✅ Logout API call successful');
      // Force complete state reset after successful logout
      forceAuthStateReset();
      return { error: null };
    } catch (error) {
      console.error('💥 Unexpected error during signOut:', error);
      // Force clear state on any error
      setSession(null);
      setUser(null);
      forceAuthStateReset();
      return { error: error as Error };
    }
  }, [session]);

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
