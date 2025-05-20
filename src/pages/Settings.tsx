
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { NavBarComponent } from '@/components/NavBarComponent';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { useToast } from '@/hooks/use-toast';
import { AdminSection } from '@/components/settings/AdminSection';

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast({
        title: 'Signed out successfully',
        description: 'You have been logged out of your account.',
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error signing out',
        description: 'There was a problem signing you out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      
      <div className="container max-w-4xl mx-auto py-8 px-4 pb-24">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        {/* User Profile Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Email:</span>
                <p>{user?.email}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardFooter>
        </Card>
        
        {/* Admin Section - Only visible to admins */}
        <AdminSection />
        
        {/* Appearance Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how the application looks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <BottomNavigation />
    </div>
  );
};

export default Settings;
