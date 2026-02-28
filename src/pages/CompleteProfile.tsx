 import React, { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import SEOHead from '@/components/seo/SEOHead';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { LoadingSpinner } from '@/components/ui/loading-spinner';
 import ProfileEditForm from '@/components/profile/ProfileEditForm';
 import Logo from '@/components/Logo';
 
 const CompleteProfile = () => {
   const { user } = useAuth();
   const navigate = useNavigate();
   const [isFormOpen, setIsFormOpen] = useState(true);
 
   // Fetch current profile data
   const { data: profile, isLoading } = useQuery({
     queryKey: ['profile-for-completion', user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
       
       const { data, error } = await supabase
         .from('profiles')
         .select('id, username, bio, location, first_name, last_name, username_changed_at')
         .eq('id', user.id)
         .single();
       
       if (error) {
         console.error('Error fetching profile:', error);
         return null;
       }
       
       return data;
     },
     enabled: !!user?.id,
   });
 
   // Get first/last name from user metadata (for OAuth users)
   const firstName = profile?.first_name || user?.user_metadata?.first_name || user?.user_metadata?.given_name || '';
   const lastName = profile?.last_name || user?.user_metadata?.last_name || user?.user_metadata?.family_name || '';
 
   // If user already has a username, redirect to home
   useEffect(() => {
     if (profile?.username) {
       navigate('/home', { replace: true });
     }
   }, [profile?.username, navigate]);
 
   const handleProfileUpdate = () => {
     // Navigate to home after successful profile completion
     navigate('/home', { replace: true });
   };
 
   if (isLoading) {
     return (
       <LoadingSpinner 
         size="lg" 
         text="Loading..." 
         className="min-h-screen flex items-center justify-center" 
       />
     );
   }
 
   return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <SEOHead noindex={true} title="Complete Profile — Common Groundz" />
      <div className="mb-8">
         <Logo size="lg" />
       </div>
       
       <div className="w-full max-w-md">
         <div className="text-center mb-6">
           <h1 className="text-2xl font-bold">Complete Your Profile</h1>
           <p className="text-muted-foreground mt-2">
             Welcome! Choose a username to get started.
           </p>
         </div>
         
         <ProfileEditForm
           isOpen={isFormOpen}
           onClose={() => {}} // Cannot close in onboarding mode
           username={profile?.username || ''}
           bio={profile?.bio || ''}
           location={profile?.location || ''}
           firstName={firstName}
           lastName={lastName}
           onProfileUpdate={handleProfileUpdate}
           usernameChangedAt={profile?.username_changed_at || null}
           mode="onboarding"
         />
       </div>
     </div>
   );
 };
 
 export default CompleteProfile;