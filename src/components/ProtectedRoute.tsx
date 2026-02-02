
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, isLoading } = useAuth();

  // Show loading state while authentication is being checked
  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading your account..." className="min-h-screen flex items-center justify-center" />;
  }

  // More strict authentication check - require both user AND valid session
  if (!user || !session) {
    console.log('ProtectedRoute: No user or session, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  // Additional session validation
  if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
    console.log('ProtectedRoute: Session expired, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  console.log('ProtectedRoute: User authenticated, rendering protected content');
  // If user is authenticated with valid session, render the children with chat
  return (
    <ChatProvider>
      <EmailVerificationBanner />
      {children}
    </ChatProvider>
  );
};


export default ProtectedRoute;
