import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveUsername } from '@/services/usernameRedirectService';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicProfile } from '@/hooks/use-public-profile';
import { trackGuestEvent } from '@/utils/guestConversionTracker';
import { Loader2 } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import GuestNavBar from '@/components/profile/GuestNavBar';
import PublicProfileView from '@/components/profile/PublicProfileView';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasTracked = useRef(false);

  const {
    profile,
    followerCount,
    followingCount,
    isLoading,
    error,
    wasRedirected,
    currentUsername,
    notFound,
  } = usePublicProfile(username);

  // Handle old-username redirects (301-style)
  useEffect(() => {
    if (wasRedirected && currentUsername && currentUsername !== username) {
      navigate(`/u/${currentUsername}`, { replace: true });
    }
  }, [wasRedirected, currentUsername, username, navigate]);

  // Idempotent guest tracking
  useEffect(() => {
    if (!user && profile && !hasTracked.current) {
      hasTracked.current = true;
      trackGuestEvent('guest_viewed_profile', {
        profileId: profile.id,
        username: profile.username,
      });
    }
  }, [user, profile]);

  // Reset tracking ref when username changes
  useEffect(() => {
    hasTracked.current = false;
  }, [username]);

  const siteUrl = 'https://common-groundz.lovable.app';
  const profileUrl = `${siteUrl}/u/${username}`;

  // --- Not found ---
  if (notFound) {
    return (
      <>
        <SEOHead
          title={`User not found — Common Groundz`}
          noindex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-foreground">User not found</h1>
            <p className="text-muted-foreground">
              The username @{username} doesn't exist.
            </p>
          </div>
        </div>
      </>
    );
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <>
        <SEOHead
          title="Common Groundz"
          url={profileUrl}
          canonical={profileUrl}
        />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  // --- Error ---
  if (error || !profile) {
    return (
      <>
        <SEOHead title="Error — Common Groundz" noindex={true} />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">{error || 'Unable to load profile.'}</p>
          </div>
        </div>
      </>
    );
  }

  // Build SEO props from profile data
  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.first_name || profile.username || 'User';

  const seoTitle = `${displayName} (@${profile.username}) — Common Groundz`;
  const seoDescription = profile.bio
    ? profile.bio.slice(0, 155)
    : `Check out ${displayName}'s profile on Common Groundz`;

  // --- Authenticated user ---
  if (user) {
    return (
      <>
        <SEOHead
          title={seoTitle}
          description={seoDescription}
          image={profile.avatar_url || undefined}
          url={profileUrl}
          canonical={profileUrl}
        />
        <div className="min-h-screen flex flex-col">
          <NavBarComponent />
          <div className="flex-1">
            <ProfileContent profileUserId={profile.id} />
          </div>
          <Footer />
          <div className="xl:hidden">
            <BottomNavigation />
          </div>
        </div>
      </>
    );
  }

  // --- Guest ---
  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image={profile.avatar_url || undefined}
        url={profileUrl}
        canonical={profileUrl}
      />
      <div className="min-h-screen flex flex-col bg-background">
        <GuestNavBar />
        <div className="flex-1">
          <PublicProfileView
            profile={profile}
            followerCount={followerCount}
            followingCount={followingCount}
          />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default UserProfile;
