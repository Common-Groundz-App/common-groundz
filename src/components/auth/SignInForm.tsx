
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserIcon, KeyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import ForgotPasswordForm from './ForgotPasswordForm';
import { loginViaGateway, formatRateLimitError } from '@/lib/authGateway';
import { supabase } from '@/integrations/supabase/client';

const SignInForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (retryCountdown && retryCountdown > 0) {
      toast.error(`Please wait ${retryCountdown} seconds before trying again`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await loginViaGateway({ email, password });
      
      if (result.error) {
        // Handle rate limiting
        if (result.code === 'RATE_LIMITED' && result.retryAfter) {
          toast.error(formatRateLimitError(result.retryAfter));
          startRetryCountdown(result.retryAfter);
          return;
        }
        throw new Error(result.error);
      }

      // Set the session from the gateway response
      if (result.data?.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.data.session.access_token,
          refresh_token: result.data.session.refresh_token,
        });
        
        if (sessionError) throw sessionError;
      }
      
      toast.success('Successfully signed in!');
      navigate('/home');
    } catch (error: any) {
      toast.error(error.message || 'Error signing in');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const startRetryCountdown = (seconds: number) => {
    setRetryCountdown(seconds);
    const interval = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Show forgot password form
  if (showForgotPassword) {
    return <ForgotPasswordForm onBackToSignIn={() => setShowForgotPassword(false)} />;
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl text-center">Welcome Back!</CardTitle>
        <CardDescription className="text-center">
          Sign in to access your personalized recommendations
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
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
                disabled={retryCountdown !== null}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="signin-password" 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 pr-10"
                disabled={retryCountdown !== null}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-brand-orange hover:text-brand-orange/80 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white" 
            disabled={isLoading || retryCountdown !== null}
          >
            {retryCountdown !== null 
              ? `Try again in ${retryCountdown}s`
              : isLoading 
                ? 'Signing In...' 
                : 'Sign In'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default SignInForm;
