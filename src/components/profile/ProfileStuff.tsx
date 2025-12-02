import React from 'react';
import { Package, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MyStuffItemCard from '@/components/mystuff/MyStuffItemCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProfileStuffProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileStuff = ({ profileUserId, isOwnProfile }: ProfileStuffProps) => {
  // Don't show this component for own profile - user should use My Stuff page
  if (isOwnProfile) {
    return null;
  }

  const { data: stuffItems, isLoading } = useQuery({
    queryKey: ['profile-stuff', profileUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stuff')
        .select(`
          *,
          entity:entities(id, name, type, image_url, slug)
        `)
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!profileUserId && !isOwnProfile,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // For now, show a placeholder since we don't have privacy settings yet
  // In the future, this will check if user has made their stuff public
  const isPublic = true; // TODO: Add privacy settings

  if (!isPublic) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">This user's stuff is private</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          They haven't made their inventory public yet.
        </p>
      </div>
    );
  }

  if (!stuffItems || stuffItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No items yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          This user hasn't added anything to their stuff yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stuffItems.map((item) => (
          <MyStuffItemCard
            key={item.id}
            item={item}
            readOnly
          />
        ))}
      </div>
    </div>
  );
};

export default ProfileStuff;
