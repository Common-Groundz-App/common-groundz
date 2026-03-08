
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCanonicalProfileUrl } from '@/hooks/useCanonicalProfileUrl';

const ProfileRedirect = () => {
  const { user } = useAuth();
  const { profileUrl, isLoading } = useCanonicalProfileUrl();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Wait for username to resolve before redirecting
  if (isLoading) {
    return null;
  }

  return <Navigate to={profileUrl} replace />;
};

export default ProfileRedirect;
