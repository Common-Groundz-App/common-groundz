
import React from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Compute email verification status from user data
  const isEmailVerified = React.useMemo(() => {
    return user?.email_confirmed_at != null;
  }, [user]);

  React.useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        // Get initial session first (fast, from localStorage)
        const { data, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          console.log('Cached session found, validating with server...');
          
          // CRITICAL: Validate JWT with Supabase server using getUser()
          // This catches deleted users whose JWT is still in localStorage
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          if (!mounted) return;
          
          if (userError || !userData.user) {
            // User deleted or JWT invalid - clear everything
            console.log('User validation failed (user may be deleted), clearing session');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
          
          // Valid user - proceed with session
          console.log('User validated successfully');
          setSession(data.session);
          setUser(userData.user);
        } else {
          console.log('No cached session found');
          setSession(null);
          setUser(null);
        }
        
        if (mounted) {
          // Set up auth state listener for future changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, currentSession) => {
              console.log('Auth event:', event, currentSession ? 'Session present' : 'No session');
              
              if (!mounted) return;
              
              // Handle sign out event specifically
              if (event === 'SIGNED_OUT') {
                console.log('User signed out - clearing all state');
                setSession(null);
                setUser(null);
                return;
              }
              
              // Handle token refresh - revalidate user exists
              if (event === 'TOKEN_REFRESHED' && currentSession) {
                console.log('Token refreshed, revalidating user with server...');
                // Use setTimeout to avoid Supabase deadlock
                setTimeout(async () => {
                  if (!mounted) return;
                  const { data: userData, error: userError } = await supabase.auth.getUser();
                  if (userError || !userData.user) {
                    console.log('User no longer exists on token refresh, signing out');
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                  }
                }, 0);
              }
              
              // Normal state update
              setSession(currentSession);
              setUser(currentSession?.user ?? null);
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
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
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

  const resetPassword = React.useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updatePassword = React.useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const resendVerificationEmail = React.useCallback(async () => {
    try {
      if (!user?.email) {
        return { error: new Error('No email address found') };
      }
      
      // Use auth gateway for rate limiting
      const response = await fetch(
        'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/auth-gateway',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resend_verification',
            email: user.email,
            redirectTo: `${window.location.origin}/`,
          }),
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        return { error: new Error(result.error || 'Failed to resend verification email') };
      }
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user?.email]);

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
    isEmailVerified,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    resendVerificationEmail
  }), [user, session, isLoading, isEmailVerified, signIn, signUp, signOut, resetPassword, updatePassword, resendVerificationEmail]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
