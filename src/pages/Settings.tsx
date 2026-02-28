import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SEOHead from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, setLocationStatus } from '@/contexts/LocationContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bell, User, Shield, Palette, MapPin, Info, AlertTriangle, Mail, Route, Sparkles, Download, Key, LogOut, CheckCircle2, XCircle } from 'lucide-react';
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
import PreferencesSection from '@/components/preferences/PreferencesSection';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import ChangePasswordModal from '@/components/settings/ChangePasswordModal';
import DeleteAccountModal from '@/components/settings/DeleteAccountModal';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
  const { user, signOut, resendVerificationEmail } = useAuth();
  const { 
    locationEnabled, 
    enableLocation, 
    disableLocation, 
    position, 
    permissionStatus,
    timestamp,
    isLoading: locationLoading
  } = useLocation();
  const { preferences, learnedPreferences } = usePreferences();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { 
    preferences: notifPrefs, 
    isLoading: notifLoading, 
    toggleWeeklyDigest,
    toggleJourneyNotifications 
  } = useNotificationPreferences();
  const { isVerified } = useEmailVerification();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  // Detect if user is OAuth-only (no email/password identity)
  const isOAuthOnlyUser = !user?.identities?.some(i => i.provider === 'email');

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    try {
      const { error } = await resendVerificationEmail();
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to send verification email',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email sent',
          description: 'Verification email has been sent to your inbox.',
        });
      }
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    setIsLoggingOutAll(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast({
        title: 'Logged out',
        description: 'You have been logged out from all devices.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to logout from all devices',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingOutAll(false);
    }
  };
  
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

  // Export data handler
  const handleExportData = () => {
    const exportData = {
      preferences,
      learnedPreferences,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `common-groundz-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tabItems = [
    {
      value: "personalization",
      label: "Personalization",
      icon: Sparkles
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
      value: "account",
      label: "Account",
      icon: User
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead noindex={true} title="Settings — Common Groundz" />
      {/* Mobile Header - Only show on mobile screens */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1">
        {/* Desktop Sidebar - Only show on xl+ screens */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4" 
          />
        </div>
        
        <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            
            <TubelightTabs defaultValue="personalization" items={tabItems}>
              {/* Personalization Tab - First Tab */}
              <TabsContent value="personalization">
                <PreferencesSection />
              </TabsContent>
              
              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Route className="h-5 w-5" />
                      Journey Notifications
                    </CardTitle>
                    <CardDescription>
                      Get notified when similar users make relevant journeys
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="journey-toggle" className="font-medium">
                          Enable Journey Notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified for items you're watching
                        </p>
                      </div>
                      <Switch
                        id="journey-toggle"
                        checked={notifPrefs?.journey_notifications_enabled ?? true}
                        onCheckedChange={toggleJourneyNotifications}
                        disabled={notifLoading}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="digest-toggle" className="font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Weekly Digest
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive a weekly summary of journey insights
                        </p>
                      </div>
                      <Switch
                        id="digest-toggle"
                        checked={notifPrefs?.weekly_digest_enabled ?? false}
                        onCheckedChange={toggleWeeklyDigest}
                        disabled={notifLoading}
                      />
                    </div>
                    
                    <div className="bg-accent/30 rounded-md p-4 flex items-start space-x-3">
                      <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">How journey notifications work</p>
                        <p className="text-xs text-muted-foreground">
                          To get notified about specific items, tap the bell icon on any item in My Stuff. 
                          You'll only receive notifications for watched items when similar users make relevant journeys.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Other Notifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Additional notification settings will be available soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Privacy Tab */}
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
                      <div className="rounded-md bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
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
                
                {/* Data Transparency & Export */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Your Data & Transparency
                    </CardTitle>
                    <CardDescription>
                      See everything the AI knows about you
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      View a complete, read-only report of all your preferences, constraints, and AI-learned data.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" asChild>
                        <a href="/your-data">View Full Data Report</a>
                      </Button>
                      <Button variant="outline" onClick={handleExportData} className="gap-2">
                        <Download className="h-4 w-4" />
                        Export as JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Policy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Your data is encrypted and stored securely. Your preferences power personalized recommendations, 
                      and you have full control over what data is collected and how it's used.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Appearance Tab */}
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
              
              {/* Account Tab - Last Tab */}
              <TabsContent value="account">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-muted-foreground">{user.email}</p>
                        {isVerified ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                      {!isVerified && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto mt-1"
                          onClick={handleResendVerification}
                          disabled={isResendingVerification}
                        >
                          {isResendingVerification ? 'Sending...' : 'Resend verification email'}
                        </Button>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {!isOAuthOnlyUser && (
                      <>
                        <div>
                          <h3 className="text-lg font-medium flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Password
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            Change your password to keep your account secure.
                          </p>
                          <Button variant="outline" size="sm" onClick={() => setShowChangePasswordModal(true)}>
                            Change Password
                          </Button>
                        </div>
                        <Separator />
                      </>
                    )}
                    
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Active Sessions
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Sign out from all devices at once.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleLogoutAllDevices}
                        disabled={isLoggingOutAll}
                      >
                        {isLoggingOutAll ? 'Logging out...' : 'Logout from all devices'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Danger Zone */}
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Once deleted, your account can be recovered within 30 days by contacting support.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteAccountModal(true)}>
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </TubelightTabs>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
      
      {/* Modals */}
      <ChangePasswordModal 
        isOpen={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)} 
      />
      <DeleteAccountModal 
        isOpen={showDeleteAccountModal} 
        onClose={() => setShowDeleteAccountModal(false)} 
      />
    </div>
  );
};

export default Settings;
