import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import SEOHead from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';

const Profile = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'posts';

  const profileUserId = id || user?.id;

  const [resolvedUsername, setResolvedUsername] = useState<string | null>(null);

  // Resolve username for canonical / redirect
  useEffect(() => {
    if (!profileUserId) return;

    const resolve = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', profileUserId)
        .maybeSingle();

      if (data?.username) {
        setResolvedUsername(data.username);
        // Client-side redirect to canonical URL
        navigate(`/u/${data.username}`, { replace: true });
      }
    };

    resolve();
  }, [profileUserId, navigate]);

  const siteUrl = 'https://common-groundz.lovable.app';
  const canonical = resolvedUsername ? `${siteUrl}/u/${resolvedUsername}` : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead noindex={true} canonical={canonical} />
      <NavBarComponent />
      <div className="flex-1">
        <ProfileContent profileUserId={profileUserId} defaultActiveTab={activeTab} />
      </div>
      <Footer />

      {/* Mobile Bottom Navigation - Only show on mobile screens */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Profile;
