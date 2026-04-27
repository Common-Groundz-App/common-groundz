import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { EnhancedCreatePostForm } from '@/components/feed/EnhancedCreatePostForm';
import { useAuth } from '@/contexts/AuthContext';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { fetchUserProfile } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';
import type { Entity } from '@/services/recommendation/types';
import type { UIPostType } from '@/components/feed/utils/postUtils';

const VALID_UI_POST_TYPES: ReadonlyArray<UIPostType> = ['journal', 'watching'];

const CreatePost = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<any>(null);

  // Email verification gate
  useEffect(() => {
    if (!canPerformAction('canCreatePosts')) {
      showVerificationRequired('canCreatePosts');
      navigateBack();
    }
  }, []);

  // Defensive query param parsing
  const initialEntity: Entity | undefined = (() => {
    const entityId = searchParams.get('entityId');
    const entityName = searchParams.get('entityName');
    if (!entityId || !entityName) return undefined;
    return {
      id: entityId,
      name: entityName,
      type: (searchParams.get('entityType') as any) || 'product',
    } as Entity;
  })();

  // Whitelisted postType param — anything else is ignored to keep state safe
  const rawPostType = searchParams.get('postType');
  const defaultPostType: UIPostType | undefined = VALID_UI_POST_TYPES.includes(
    rawPostType as UIPostType
  )
    ? (rawPostType as UIPostType)
    : undefined;

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const profile = await fetchUserProfile(user.id);
        setProfileData(profile);
      } catch (err) {
        console.error('Error fetching profile data:', err);
        toast({
          title: 'Could not load profile data',
          description: 'Your post will use default profile information',
          variant: 'destructive',
        });
      }
    };
    loadProfile();
  }, [user, toast]);

  const navigateBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  }, [navigate]);

  const handleSuccess = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0 bg-background">
      <div className="flex flex-1">
        {/* Desktop Left Nav */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar className="fixed left-0 top-0 h-screen pt-4 pl-4 z-50" />
        </div>

        <div className="flex-1 xl:ml-64 min-w-0">
          {/* Composer is now full-bleed — owns its own sticky top + bottom bars */}
          <EnhancedCreatePostForm
            profileData={profileData}
            onSuccess={handleSuccess}
            onCancel={navigateBack}
            initialEntity={initialEntity}
            defaultPostType={defaultPostType}
          />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default CreatePost;
