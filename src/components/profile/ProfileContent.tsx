import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Calendar, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileRecommendations from './ProfileRecommendations';
import { Card } from '@/components/ui/card';
const ProfileContent = () => {
  const {
    user
  } = useAuth();
  const [coverImage, setCoverImage] = useState<string>('/lovable-uploads/972742c1-8d73-43ee-9508-7a56b2bc2573.png');
  const [profileImage, setProfileImage] = useState<string>('https://images.unsplash.com/photo-1472396961693-142e6e269027');
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target?.result) {
          setCoverImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target?.result) {
          setProfileImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  return <div className="w-full bg-background pt-16 py-0"> {/* Added pt-16 to create space for the navbar */}
      {/* Cover Photo Section */}
      <div className="w-full h-[250px] relative overflow-hidden">
        <div style={{
        backgroundImage: `url(${coverImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }} className="w-full h-full bg-brand-orange mx-0 my-[12px]">
        </div>
        <label htmlFor="cover-upload" className="absolute bottom-4 right-4 bg-white/80 hover:bg-white backdrop-blur-sm px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors">
          Change Cover
        </label>
        <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card */}
          <Card className="relative md:w-[350px] bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="p-6 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white">
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow cursor-pointer">
                  <div className="w-8 h-8 flex items-center justify-center bg-brand-orange text-white rounded-full">
                    +
                  </div>
                </label>
                <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900">Ethan Smith</h2>
              <p className="text-gray-600 mb-4">Food Enthusiast</p>
              
              <div className="flex space-x-3 mb-6">
                <Button className="bg-brand-orange hover:bg-brand-orange/90">Follow</Button>
                <Button variant="outline">Message</Button>
              </div>
              
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center text-gray-700">
                  <MapPin className="w-5 h-5 mr-2" />
                  <span>New York, NY</span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <Calendar className="w-5 h-5 mr-2" />
                  <span>Member since January 2021</span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <Users className="w-5 h-5 mr-2" />
                  <span>120 following</span>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Content Area */}
          <div className="flex-1">
            <Tabs defaultValue="recommendations" className="mt-24">
              <TabsList className="border-b w-full rounded-none bg-transparent p-0 h-auto">
                <TabsTrigger value="recommendations" className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
                  Recommendations
                </TabsTrigger>
                <TabsTrigger value="circles" className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
                  Circles
                </TabsTrigger>
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-brand-orange data-[state=active]:text-black">
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
    </div>;
};
export default ProfileContent;