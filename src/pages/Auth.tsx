
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Glow } from '@/components/ui/glow';
import Logo from '@/components/Logo';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';

const Auth = () => {
  const [activeTab, setActiveTab] = useState('signin');
  const location = useLocation();

  useEffect(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'signup') {
      setActiveTab('signup');
    }
  }, [location]);

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Left side - Brand visuals and value proposition */}
      <AuthBrandPanel />
      
      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="absolute top-8 left-8 lg:left-auto lg:right-8">
          <Logo size="md" />
        </div>
        
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="max-w-md w-full">
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
