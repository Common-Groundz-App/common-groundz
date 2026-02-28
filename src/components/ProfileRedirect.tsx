
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ProfileRedirect = () => {
  const { user } = useAuth();

  const { data: username } = useQuery({
    queryKey: ['profile-username', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      return data?.username || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (username) {
    return <Navigate to={`/u/${username}`} replace />;
  }

  return <Navigate to={`/profile/${user.id}`} replace />;
};

export default ProfileRedirect;
