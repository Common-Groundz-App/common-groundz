
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Glow } from '@/components/ui/glow';
import Logo from '@/components/Logo';
import { UserIcon, KeyIcon, MessageSquare, Heart, Coffee } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'signup') {
      setActiveTab('signup');
    }
  }, [location]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      toast.success('Successfully signed in!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Error signing in');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error, user } = await signUp(email, password);
      if (error) throw error;
      
      if (user) {
        toast.success('Registration successful! Please check your email to confirm your account.');
      } else {
        toast.info('Please check your email to confirm your registration.');
      }
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Error signing up');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Features or benefits to display on the authentication page
  const features = [
    { 
      icon: <MessageSquare className="h-6 w-6 text-brand-orange" />, 
      title: "Trusted Recommendations", 
      description: "Find recommendations from people you know and trust."
    },
    { 
      icon: <Heart className="h-6 w-6 text-brand-blue" />, 
      title: "Share What You Love", 
      description: "Easily share your favorite books, movies, and more."
    },
    { 
      icon: <Coffee className="h-6 w-6 text-brand-teal" />, 
      title: "Discover New Favorites", 
      description: "Expand your horizons with new discoveries from your network."
    }
  ];

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Left side - Brand visuals and value proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-orange/10 via-brand-blue/10 to-brand-teal/10 flex-col items-center justify-center p-12 relative">
        <div className="max-w-md text-center mb-12">
          <h2 className="text-4xl font-bold mb-6 text-brand-orange">Find Common Ground</h2>
          <p className="text-lg mb-8">
            Discover recommendations from people who share your interests and tastes.
          </p>
          
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start p-4 rounded-lg bg-white/50 backdrop-blur-sm shadow-sm">
                <div className="mr-4 mt-1">{feature.icon}</div>
                <div className="text-left">
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full bg-brand-orange/20 animate-pulse-delay-0 filter blur-xl"></div>
        <div className="absolute top-20 left-10 h-24 w-24 rounded-full bg-brand-blue/20 animate-pulse-delay-2 filter blur-xl"></div>
        <div className="absolute bottom-40 left-20 h-16 w-16 rounded-full bg-brand-teal/20 animate-pulse-delay-0 filter blur-xl"></div>
      </div>
      
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
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-center">Welcome Back!</CardTitle>
                <CardDescription className="text-center">
                  Sign in to access your personalized recommendations
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signin-email" 
                        type="email" 
                        placeholder="your@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signin-password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white" disabled={isLoading}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-center">Join the Community</CardTitle>
                <CardDescription className="text-center">
                  Create an account to discover recommendations you'll love
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="your@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signup-password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white" disabled={isLoading}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <Glow variant="bottom" className="opacity-70" />
    </div>
  );
};

export default Auth;
