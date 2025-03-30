
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Calendar, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileRecommendations from './ProfileRecommendations';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ProfileContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<string>('/lovable-uploads/972742c1-8d73-43ee-9508-7a56b2bc2573.png');
  const [profileImage, setProfileImage] = useState<string>('https://images.unsplash.com/photo-1472396961693-142e6e269027');
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('Food Enthusiast');
  const [location, setLocation] = useState<string>('New York, NY');
  const [memberSince, setMemberSince] = useState<string>('January 2021');
  const [followingCount, setFollowingCount] = useState<number>(120);
  
  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          // Set username if available
          if (data.username) {
            setUsername(data.username);
          } else {
            // Fallback to email name if no username
            setUsername(user.email?.split('@')[0] || 'User');
          }
          
          // Set profile and cover images if available
          if (data.avatar_url) {
            setProfileImage(data.avatar_url);
          }
          
          if (data.cover_url) {
            setCoverImage(data.cover_url);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user]);
  
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      setIsLoading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/cover.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Update the cover_url in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) {
        toast({
          title: 'Failed to update profile',
          description: updateError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Update local state
      setCoverImage(publicUrl);
      
      toast({
        title: 'Cover image updated',
        description: 'Your new cover image has been saved.',
      });
    } catch (error) {
      console.error('Error uploading cover image:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      setIsLoading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Update the avatar_url in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) {
        toast({
          title: 'Failed to update profile',
          description: updateError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Update local state
      setProfileImage(publicUrl);
      
      toast({
        title: 'Profile image updated',
        description: 'Your new profile image has been saved.',
      });
    } catch (error) {
      console.error('Error uploading profile image:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-background pt-20">
      {/* Cover Photo Section */}
      <div className="w-full h-[250px] relative overflow-hidden">
        <div 
          className="w-full h-full bg-brand-orange"
          style={{ 
            backgroundImage: `url(${coverImage})`, 
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
        </div>
        <label 
          htmlFor="cover-upload" 
          className="absolute bottom-4 right-4 bg-white/80 hover:bg-white backdrop-blur-sm px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
        >
          {isLoading ? 'Uploading...' : 'Change Cover'}
        </label>
        <input 
          id="cover-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleCoverUpload}
          disabled={isLoading}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card */}
          <Card className="relative md:w-[350px] bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="p-6 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white">
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <label 
                  htmlFor="profile-upload" 
                  className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow cursor-pointer"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-brand-orange text-white rounded-full">
                    {isLoading ? '...' : '+'}
                  </div>
                </label>
                <input 
                  id="profile-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleProfileUpload}
                  disabled={isLoading}
                />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900">{username}</h2>
              <p className="text-gray-600 mb-4">{bio}</p>
              
              <div className="flex space-x-3 mb-6">
                <Button className="bg-brand-orange hover:bg-brand-orange/90">Follow</Button>
                <Button variant="outline">Message</Button>
              </div>
              
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center text-gray-700">
                  <MapPin className="w-5 h-5 mr-2" />
                  <span>{location}</span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <Calendar className="w-5 h-5 mr-2" />
                  <span>Member since {memberSince}</span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <Users className="w-5 h-5 mr-2" />
                  <span>{followingCount} following</span>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Content Area */}
          <div className="flex-1">
            <Tabs defaultValue="recommendations" className="mt-24">
              <TabsList className="border-b w-full rounded-none bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="recommendations"
                  className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
                >
                  Recommendations
                </TabsTrigger>
                <TabsTrigger 
                  value="circles"
                  className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
                >
                  Circles
                </TabsTrigger>
                <TabsTrigger 
                  value="about"
                  className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black"
                >
                  About
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommendations" className="mt-6">
                <ProfileRecommendations />
              </TabsContent>
              
              <TabsContent value="circles" className="mt-6">
                <div className="p-4 text-center text-gray-500">
                  Circles content will go here
                </div>
              </TabsContent>
              
              <TabsContent value="about" className="mt-6">
                <div className="p-4 text-center text-gray-500">
                  About content will go here
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
