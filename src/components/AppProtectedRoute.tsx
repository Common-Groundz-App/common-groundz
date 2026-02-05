 import React from 'react';
 import ProtectedRoute from '@/components/ProtectedRoute';
 import RequireCompleteProfile from '@/components/auth/RequireCompleteProfile';
 
 interface AppProtectedRouteProps {
   children: React.ReactNode;
 }
 
 /**
  * Full protection wrapper for app routes.
  * Combines authentication + profile completion + soft-delete checks.
  * 
  * Use this for ALL normal protected routes.
  * Use ProtectedRoute + RequireCompleteProfile(allowIncomplete) only for /complete-profile.
  */
 const AppProtectedRoute: React.FC<AppProtectedRouteProps> = ({ children }) => {
   return (
     <ProtectedRoute>
       <RequireCompleteProfile>
         {children}
       </RequireCompleteProfile>
     </ProtectedRoute>
   );
 };
 
 export default AppProtectedRoute;