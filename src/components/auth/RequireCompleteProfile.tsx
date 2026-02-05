import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface RequireCompleteProfileProps {
  children: React.ReactNode;
  allowIncomplete?: boolean; // Skip username check, but still check soft-delete
}

// Type for profile data including orphaned marker
interface ProfileData {
  id: string;
  username: string | null;
  deleted_at: string | null;
  _orphaned?: boolean;
}

/**
 * Route guard that ensures:
 * 1. User is not orphaned (has JWT but no profile - forces sign out)
 * 2. User is not soft-deleted (forces sign out if deleted)
 * 3. User has a complete profile with username (redirects to /complete-profile if not)
 * 
 * Set allowIncomplete=true to skip the username check (used for /complete-profile route).
 */
const RequireCompleteProfile: React.FC<RequireCompleteProfileProps> = ({ 
  children, 
  allowIncomplete = false 
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Fetch profile including deleted_at status
  const { data: profile, isLoading } = useQuery<ProfileData | null>({
    queryKey: ['profile-completion-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, deleted_at')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // CRITICAL: Check for PGRST116 ("not found") - this means orphaned auth state
        // User has valid JWT but no profile record = user was deleted
        if (error.code === 'PGRST116') {
          console.error('Profile not found for authenticated user - orphaned auth state detected');
          return { _orphaned: true } as ProfileData;
        }
        
        // Other errors (network, temporary DB issues) - do NOT force logout
        // Just log and return null, let component handle gracefully
        console.error('Error fetching profile for completion check:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Handle orphaned auth state: user has JWT but no profile record
  // This happens when user is manually deleted from Supabase but JWT still valid
  useEffect(() => {
    if (profile?._orphaned) {
      console.log('Orphaned auth state detected (no profile for authenticated user), forcing sign out');
      signOut();
      navigate('/', { replace: true });
    }
  }, [profile?._orphaned, signOut, navigate]);

  // Handle soft-deleted user: force sign out and redirect
  useEffect(() => {
    if (profile?.deleted_at) {
      console.log('Soft-deleted user detected, forcing sign out');
      signOut();
      navigate('/account-deleted', { replace: true });
    }
  }, [profile?.deleted_at, signOut, navigate]);

  // Show loading while checking profile
  if (isLoading) {
    return (
      <LoadingSpinner 
        size="lg" 
        text="Loading your profile..." 
        className="min-h-screen flex items-center justify-center" 
      />
    );
  }

  // If orphaned, don't render children (redirect is handled by useEffect)
  if (profile?._orphaned) {
    return null;
  }

  // If deleted, don't render children (redirect is handled by useEffect)
  if (profile?.deleted_at) {
    return null;
  }

  // If no username, redirect to profile completion (unless allowIncomplete)
  if (!allowIncomplete && profile && !profile.username) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Profile is complete, render children
  return <>{children}</>;
};

export default RequireCompleteProfile;
 
 export default RequireCompleteProfile;