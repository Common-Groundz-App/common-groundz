import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, setLocationStatus } from '@/contexts/LocationContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bell, User, Shield, Palette, Globe, MapPin, Info, AlertTriangle } from 'lucide-react';
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
                    <CardDescription>
                      Manage how your location data is used within the app
                    </CardDescription>
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
                    </div>
                    
                    <div className="bg-accent/30 rounded-md p-4 flex items-start space-x-3">
                      <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Data Usage Policy</p>
                        <p className="text-xs text-muted-foreground">
                          Your location data is only used within the app and is not shared with third parties. 
                          We store your last known position to provide location-based features when you need them. 
                          You can disable location services at any time.
                        </p>
                      </div>
                    </div>
                    
                    {permissionStatus === 'denied' && (
                      <div className="rounded-md bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-900">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          <div className="space-y-2">
                            <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                              Location access is blocked in your browser settings
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                              You'll need to update your browser settings to enable location services.
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
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Settings</CardTitle>
                    <CardDescription>
                      Control how your personal data is used and accessed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Your Data</h3>
                      <p className="text-sm text-muted-foreground">
                        You can request a copy of your data or delete your account at any time.
                      </p>
                      <div className="flex space-x-2 mt-2">
                        <Button variant="outline" size="sm">Request Data Export</Button>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Cookie Preferences</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage how we use cookies to enhance your experience.
                      </p>
                      <div className="flex flex-col space-y-4 mt-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="essential-cookies" className="text-sm">Essential Cookies</Label>
                          <Switch id="essential-cookies" checked disabled />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="analytics-cookies" className="text-sm">Analytics Cookies</Label>
                          <Switch id="analytics-cookies" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="marketing-cookies" className="text-sm">Marketing Cookies</Label>
                          <Switch id="marketing-cookies" />
                        </div>
                      </div>
                    </div>
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
