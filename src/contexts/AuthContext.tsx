
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Extend the Supabase User type to include profile fields
export interface User extends SupabaseUser {
  username?: string | null;
  avatar_url?: string | null;
}

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, userData?: { firstName?: string, lastName?: string, username?: string }) => Promise<{ error: Error | null, user: User | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event);
        setSession(currentSession);
        
        // If we have a user, fetch their profile data to get username and avatar
        if (currentSession?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', currentSession.user.id)
              .single();
              
            // Combine the user data with profile data
            const enrichedUser = {
              ...currentSession.user,
              username: profile?.username || null,
              avatar_url: profile?.avatar_url || null
            };
            
            setUser(enrichedUser);
          } catch (error) {
            console.error('Error fetching profile:', error);
            // Still set the user even if profile fetch fails
            setUser(currentSession.user);
          }
        } else {
          setUser(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('Initial session check:', currentSession ? 'logged in' : 'logged out');
      setSession(currentSession);
      
      if (currentSession?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', currentSession.user.id)
            .single();
            
          // Combine the user data with profile data
          const enrichedUser = {
            ...currentSession.user,
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null
          };
          
          setUser(enrichedUser);
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Still set the user even if profile fetch fails
          setUser(currentSession.user);
        }
      } else {
        setUser(null);
      }
      
      // Set loading to false regardless of the result
      setIsLoading(false);
    }).catch((error) => {
      console.error('Error checking session:', error);
      setIsLoading(false); // Make sure we end the loading state
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, userData?: { firstName?: string, lastName?: string, username?: string }) => {
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
    return { error, user: data?.user ? { ...data.user, username: userData?.username || null } as User : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
