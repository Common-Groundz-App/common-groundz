import { useState, useEffect } from 'react';
import { resolveUsername } from '@/services/usernameRedirectService';
import { supabase } from '@/integrations/supabase/client';
import { fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';

interface PublicProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  location: string | null;
  cover_url: string | null;
  is_verified: boolean | null;
  created_at: string | null;
}

interface UsePublicProfileResult {
  profile: PublicProfile | null;
  followerCount: number;
  followingCount: number;
  isLoading: boolean;
  error: string | null;
  wasRedirected: boolean;
  currentUsername: string | null;
  notFound: boolean;
}

export const usePublicProfile = (username: string | undefined): UsePublicProfileResult => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasRedirected, setWasRedirected] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const resolution = await resolveUsername(username);

        if (cancelled) return;

        if (resolution.notFound) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setWasRedirected(resolution.wasRedirected);
        setCurrentUsername(resolution.currentUsername);

        // Fetch profile with explicit safe columns
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, first_name, last_name, bio, location, cover_url, is_verified, created_at')
          .eq('id', resolution.userId)
          .single();

        if (cancelled) return;

        if (profileError) {
          setError('Failed to load profile');
          setIsLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch counts in parallel
        const [followers, following] = await Promise.all([
          fetchFollowerCount(resolution.userId),
          fetchFollowingCount(resolution.userId),
        ]);

        if (cancelled) return;

        setFollowerCount(followers);
        setFollowingCount(following);
      } catch (e) {
        if (!cancelled) {
          setError('An unexpected error occurred');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [username]);

  return { profile, followerCount, followingCount, isLoading, error, wasRedirected, currentUsername, notFound };
};
