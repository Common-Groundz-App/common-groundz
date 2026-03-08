import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProfileUrl } from '@/utils/getProfileUrl';

export function useCanonicalProfileUrl() {
  const { user } = useAuth();

  const { data: username, isLoading } = useQuery({
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

  return {
    profileUrl: getProfileUrl(username),
    username: username ?? null,
    isLoading,
  };
}
