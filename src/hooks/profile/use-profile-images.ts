import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/profileService';

// Key for localStorage caching
const PROFILE_IMAGES_CACHE_KEY = 'profile_images_cache';

interface CachedImages {
  profileId: string;
  coverImage: string;
  profileImage: string;
  timestamp: number;
}

export const useProfileImages = (defaultCoverImage: string) => {
  const [coverImage, setCoverImage] = useState<string>(defaultCoverImage);
  const [profileImage, setProfileImage] = useState<string>('');
  const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load cached images on component mount
  useEffect(() => {
    try {
      const cachedImages = localStorage.getItem(PROFILE_IMAGES_CACHE_KEY);
      if (cachedImages) {
        const parsed = JSON.parse(cachedImages) as CachedImages[];
        // We'll use this data when setting initial images
        console.log('Loaded cached profile images:', parsed);
      }
    } catch (e) {
      console.error('Error loading cached images:', e);
    }
  }, []);

  useEffect(() => {
    setHasChanges(!!tempCoverImage);
  }, [tempCoverImage]);

  // Cache images when they change
  const cacheImages = useCallback((userId: string, coverUrl: string, profileUrl: string) => {
    try {
      const cacheKey = PROFILE_IMAGES_CACHE_KEY;
      let existingCache: CachedImages[] = [];
      
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          existingCache = JSON.parse(cached);
        }
      } catch (e) {
        console.error('Error parsing cached images:', e);
      }
      
      // Remove old entry for this user if it exists
      const filteredCache = existingCache.filter(item => item.profileId !== userId);
      
      // Add new entry
      const newCache = [
        ...filteredCache,
        {
          profileId: userId,
          coverImage: coverUrl,
          profileImage: profileUrl,
          timestamp: Date.now()
        }
      ];
      
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log('Updated image cache for user:', userId);
    } catch (e) {
      console.error('Error caching images:', e);
    }
  }, []);

  const handleProfileImageChange = (url: string) => {
    setProfileImage(url);
  };

  const handleCoverImageChange = (url: string) => {
    setCoverImage(url);
  };

  const handleCoverImageUpdated = (url: string | null) => {
    setTempCoverImage(url);
  };
  
  // Get cached image URL if available, otherwise apply timestamp
  const getCachedOrTimestampedUrl = useCallback((
    userId: string, 
    imageUrl: string | null, 
    fallback: string,
    type: 'cover' | 'avatar'
  ) => {
    if (!imageUrl) {
      return type === 'cover' ? fallback : '';
    }
    
    try {
      // Check cache first
      const cachedString = localStorage.getItem(PROFILE_IMAGES_CACHE_KEY);
      if (cachedString) {
        const cache = JSON.parse(cachedString) as CachedImages[];
        const userCache = cache.find(item => item.profileId === userId);
        
        if (userCache) {
          const cachedUrl = type === 'cover' 
            ? userCache.coverImage 
            : userCache.profileImage;
          
          // If the base URLs match, use the cached one that already has a timestamp
          if (cachedUrl && cachedUrl.split('?')[0] === imageUrl.split('?')[0]) {
            console.log(`Using cached ${type} URL:`, cachedUrl);
            return cachedUrl;
          }
        }
      }
    } catch (e) {
      console.error('Error retrieving cached image:', e);
    }
    
    // Add timestamp to force browser to reload the image if it's not in cache or has changed
    const timestampedUrl = `${imageUrl}?t=${Date.now()}`;
    console.log(`Adding timestamp to ${type} URL:`, timestampedUrl);
    return timestampedUrl;
  }, []);
  
  const setInitialImages = useCallback((profileData: any) => {
    if (!profileData) return;
    
    setProfileId(profileData.id);
    
    let newCoverImage = defaultCoverImage;
    let newProfileImage = '';
    
    if (profileData?.cover_url) {
      newCoverImage = getCachedOrTimestampedUrl(
        profileData.id, 
        profileData.cover_url, 
        defaultCoverImage,
        'cover'
      );
    }
    
    if (profileData?.avatar_url) {
      newProfileImage = getCachedOrTimestampedUrl(
        profileData.id, 
        profileData.avatar_url, 
        '',
        'avatar'
      );
    }
    
    setCoverImage(newCoverImage);
    setProfileImage(newProfileImage);
    
    // Update the cache with these resolved URLs
    cacheImages(profileData.id, newCoverImage, newProfileImage);
  }, [defaultCoverImage, getCachedOrTimestampedUrl, cacheImages]);

  const handleSaveChanges = async (userId: string) => {
    try {
      if (tempCoverImage) {
        await updateUserProfile(userId, { cover_url: tempCoverImage });
        
        // Update the cache with the new URL (without timestamp)
        const baseUrl = tempCoverImage.split('?')[0];
        const timestampedUrl = `${baseUrl}?t=${Date.now()}`;
        
        setCoverImage(timestampedUrl);
        setTempCoverImage(null);
        setHasChanges(false);
        
        // Update cache
        cacheImages(userId, timestampedUrl, profileImage);
        
        toast({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.'
        });
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Memoize the image URLs to prevent unnecessary re-renders
  const memoizedUrls = useMemo(() => ({
    coverImage,
    profileImage
  }), [coverImage, profileImage]);

  return {
    coverImage: memoizedUrls.coverImage,
    profileImage: memoizedUrls.profileImage,
    tempCoverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges,
    setInitialImages
  };
};
