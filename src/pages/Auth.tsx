
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Glow } from '@/components/ui/glow';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';

const Auth = () => {
  const [activeTab, setActiveTab] = useState('signin');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  console.log('🔐 [Auth] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  useEffect(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'signup') {
      setActiveTab('signup');
    } else if (tabParam === 'signin') {
      setActiveTab('signin');
    }
  }, [location.search]);

  // Redirect authenticated users to home
  useEffect(() => {
    if (!isLoading && user) {
      console.log('🔀 [Auth] User is authenticated, redirecting to /home');
      navigate('/home', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Show loading state while auth is initializing
  if (isLoading) {
    console.log('⏳ [Auth] Auth loading, showing spinner...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render auth forms if user is already authenticated
  if (user) {
    return null; // This will be brief before redirect
  }

  console.log('📝 [Auth] Showing auth forms');

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Left side - Brand visuals and value proposition */}
      <AuthBrandPanel />
      
      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="lg:hidden absolute top-8 left-8">
          <Logo size="md" />
        </div>
        
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="max-w-md w-full mt-16 lg:mt-0">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50">
            <TabsTrigger value="signin" className="data-[state=active]:bg-brand-orange data-[state=active]:text-white">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-brand-orange data-[state=active]:text-white">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <SignInForm />
          </TabsContent>
          
          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </div>
      
      <Glow variant="bottom" className="opacity-70" />
    </div>
  );
};

export default Auth;
