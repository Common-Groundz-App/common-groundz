 import React, { useEffect } from 'react';
 import { Navigate, useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { LoadingSpinner } from '@/components/ui/loading-spinner';
 
 interface RequireCompleteProfileProps {
   children: React.ReactNode;
 }
 
 /**
  * Route guard that ensures:
  * 1. User is not soft-deleted (forces sign out if deleted)
  * 2. User has a complete profile with username (redirects to /complete-profile if not)
  */
 const RequireCompleteProfile: React.FC<RequireCompleteProfileProps> = ({ children }) => {
   const { user, signOut } = useAuth();
   const navigate = useNavigate();
 
   // Fetch profile including deleted_at status
   const { data: profile, isLoading, error } = useQuery({
     queryKey: ['profile-completion-check', user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
       
       const { data, error } = await supabase
         .from('profiles')
         .select('id, username, deleted_at')
         .eq('id', user.id)
         .single();
       
       if (error) {
         console.error('Error fetching profile for completion check:', error);
         return null;
       }
       
       return data;
     },
     enabled: !!user?.id,
     staleTime: 30 * 1000, // 30 seconds
   });
 
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
 
   // If deleted, don't render children (redirect is handled by useEffect)
   if (profile?.deleted_at) {
     return null;
   }
 
   // If no username, redirect to profile completion
   if (profile && !profile.username) {
     return <Navigate to="/complete-profile" replace />;
   }
 
   // Profile is complete, render children
   return <>{children}</>;
 };
 
 export default RequireCompleteProfile;