
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bell, User, Shield, Palette, Globe } from 'lucide-react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const Settings = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!user) {
    return <div>Loading...</div>;
  }
  
  // Using the getInitialActiveTab similar to Feed page
  const getInitialActiveTab = () => {
    return 'Settings';
  };

  const tabItems = [
    {
      value: "account",
      label: "Account",
      icon: User
    },
    {
      value: "notifications",
      label: "Notifications",
      icon: Bell
    },
    {
      value: "privacy",
      label: "Privacy",
      icon: Shield
    },
    {
      value: "appearance",
      label: "Appearance",
      icon: Palette
    },
    {
      value: "language",
      label: "Language",
      icon: Globe
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 pt-16 md:pl-64",
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            
            <TubelightTabs defaultValue="account" items={tabItems}>
              <TabsContent value="account">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Email</h3>
                      <p className="text-muted-foreground mb-2">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Your email is used for notifications and account recovery.
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium">Profile Information</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Update your profile information in the Profile page.
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Configure your notification preferences here. This feature will be available soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="privacy">
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Manage your privacy settings here. This feature will be available soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="appearance">
                <Card>
                  <CardHeader>
                    <CardTitle>Appearance Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ThemeToggle />
                    
                    <Separator />
                    
                    <p className="text-muted-foreground">
                      Additional appearance settings will be available soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="language">
                <Card>
                  <CardHeader>
                    <CardTitle>Language Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Change your language preferences here. This feature will be available soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </TubelightTabs>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Settings;
