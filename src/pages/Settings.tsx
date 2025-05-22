
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import PreferencesSection from '@/components/settings/PreferencesSection';
import { User, Settings as SettingsIcon, Bell, Shield, Palette, Languages, UserCog } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 container mx-auto py-8 px-4 md:px-6">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        <div className="max-w-4xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">Account</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden md:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden md:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden md:inline">Appearance</span>
              </TabsTrigger>
              <TabsTrigger value="language" className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <span className="hidden md:inline">Language</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span className="hidden md:inline">Advanced</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="account" className="space-y-8">
              <div className="grid gap-8">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-4">Account Settings</h2>
                    <p className="text-muted-foreground">
                      Manage your account information and preferences.
                    </p>
                  </div>
                  
                  {/* Profile Information Section */}
                  <div className="bg-card rounded-lg border p-6 shadow-sm">
                    <h3 className="text-xl font-medium mb-4">Profile Information</h3>
                    {/* Profile information form would go here */}
                    <div className="text-muted-foreground">
                      Update your account profile information
                    </div>
                  </div>
                  
                  {/* Personalization Preferences Section */}
                  <PreferencesSection />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="notifications" className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Notification Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Control what types of notifications you receive.
                </p>
                
                <div className="bg-card rounded-lg border p-6 shadow-sm">
                  {/* Notification settings would go here */}
                  <div className="text-muted-foreground">
                    Configure your notification preferences
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="privacy" className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Privacy Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Manage your privacy and security preferences.
                </p>
                
                <div className="bg-card rounded-lg border p-6 shadow-sm">
                  {/* Privacy settings would go here */}
                  <div className="text-muted-foreground">
                    Adjust who can see your profile and content
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="appearance" className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Appearance Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Customize how the application looks.
                </p>
                
                <div className="bg-card rounded-lg border p-6 shadow-sm">
                  <ThemeToggle />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="language" className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Language Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Select your preferred language.
                </p>
                
                <div className="bg-card rounded-lg border p-6 shadow-sm">
                  {/* Language settings would go here */}
                  <div className="text-muted-foreground">
                    Choose your preferred language
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Advanced Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Manage advanced application settings.
                </p>
                
                <div className="bg-card rounded-lg border p-6 shadow-sm">
                  {/* Advanced settings would go here */}
                  <div className="text-muted-foreground">
                    Configure advanced application settings
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;
