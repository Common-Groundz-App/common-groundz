import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, setLocationStatus } from '@/contexts/LocationContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bell, User, Shield, Palette, Globe, MapPin } from 'lucide-react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { locationEventBus } from '@/hooks/use-geolocation';

const Settings = () => {
  const { user } = useAuth();
  const { 
    locationEnabled, 
    enableLocation, 
    disableLocation, 
    position, 
    permissionStatus,
    timestamp,
    isLoading: locationLoading
  } = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Subscribe to location events to keep UI in sync
  useEffect(() => {
    const unsubscribe = locationEventBus.subscribe('change', (detail) => {
      // We don't need to do anything here because the useLocation hook
      // will automatically update when the location state changes
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }
  
  // Using the getInitialActiveTab similar to Feed page
  const getInitialActiveTab = () => {
    return 'Settings';
  };

  // Format the last position timestamp if available
  const formattedTimestamp = timestamp ? 
    format(new Date(timestamp), 'MMM d, yyyy h:mm a') : 
    'Never';

  const handleLocationToggle = (enabled: boolean) => {
    if (enabled) {
      enableLocation();
    } else {
      disableLocation();
    }
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
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Location Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="location-toggle" className="font-medium">
                        Enable Location Services
                      </Label>
                      <Switch
                        id="location-toggle"
                        checked={locationEnabled}
                        onCheckedChange={handleLocationToggle}
                        disabled={permissionStatus === 'denied' || locationLoading}
                      />
                    </div>
                    
                    <div className="text-sm space-y-2">
                      <div>
                        <span className="font-medium">Status: </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs",
                          permissionStatus === 'granted' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" :
                          permissionStatus === 'denied' ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" :
                          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                        )}>
                          {permissionStatus === 'granted' ? 'Allowed' :
                           permissionStatus === 'denied' ? 'Blocked' :
                           permissionStatus === 'prompt' ? 'Not yet requested' : 'Unknown'}
                        </span>
                        
                        {locationLoading && (
                          <span className="ml-2 text-xs animate-pulse">Updating...</span>
                        )}
                      </div>
                      
                      <div>
                        <span className="font-medium">Last used: </span>
                        <span>{formattedTimestamp}</span>
                      </div>
                      
                      {position && (
                        <div className="text-xs text-muted-foreground">
                          Current coordinates: {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="text-sm space-y-4">
                      <p className="text-muted-foreground">
                        Enabling location services helps us provide:
                      </p>
                      <ul className="list-disc list-inside space-y-1 pl-2 text-muted-foreground">
                        <li>Nearby restaurants and places</li>
                        <li>Distance information in search results</li>
                        <li>More accurate recommendations</li>
                      </ul>
                      
                      <p className="text-muted-foreground">
                        Your location data is only used within the app and is not shared with third parties.
                      </p>
                    </div>
                    
                    {permissionStatus === 'denied' && (
                      <div className="rounded-md bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-900">
                        <p className="text-red-800 dark:text-red-200 text-sm mb-2">
                          Location access is blocked in your browser settings
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                          onClick={() => window.open('about:settings', '_blank')}
                        >
                          Open Browser Settings
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Manage additional privacy settings here. This feature will be available soon.
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
