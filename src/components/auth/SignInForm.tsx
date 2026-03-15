
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserIcon, KeyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import ForgotPasswordForm from './ForgotPasswordForm';
import { loginViaGateway, formatRateLimitError } from '@/lib/authGateway';
import { supabase } from '@/integrations/supabase/client';
import GoogleSignInButton from './GoogleSignInButton';
import { Separator } from '@/components/ui/separator';
import { getLastAuthMethod, setLastAuthMethod, clearPendingGoogleAuth } from '@/lib/lastAuthMethod';

const getFriendlyAuthError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('user not found')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email before signing in. Check your inbox.';
  }
  return 'Something went wrong. Please try again.';
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const SignInForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [lastMethod] = useState(() => getLastAuthMethod());
  const emailInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Clear any stale pending Google auth flag on mount
  useEffect(() => {
    clearPendingGoogleAuth();
  }, []);

  // Auto-focus email input if email was last used method
  useEffect(() => {
    if (lastMethod === 'email' && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [lastMethod]);

  // Clear inline error when user types
  useEffect(() => {
    if (formError) setFormError('');
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setFormError('Please enter your password.');
      return;
    }
    
    if (retryCountdown && retryCountdown > 0) {
      toast.error(`Please wait ${retryCountdown} seconds before trying again`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await loginViaGateway({ email: email.trim(), password });
      
      if (result.error) {
        if (result.code === 'RATE_LIMITED' && result.retryAfter) {
          toast.error(formatRateLimitError(result.retryAfter));
          startRetryCountdown(result.retryAfter);
          return;
        }
        throw new Error(result.error);
      }

      if (result.data?.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.data.session.access_token,
          refresh_token: result.data.session.refresh_token,
        });
        
        if (sessionError) throw sessionError;
      }
      
      setLastAuthMethod('email');
      toast.success('Successfully signed in!');
      navigate('/home');
    } catch (error: any) {
      setFormError(getFriendlyAuthError(error.message || 'Error signing in'));
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

  if (showForgotPassword) {
    return <ForgotPasswordForm onBackToSignIn={() => setShowForgotPassword(false)} />;
  }

  const isEmailLastUsed = lastMethod === 'email';

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl text-center">Welcome Back!</CardTitle>
        <CardDescription className="text-center">
          Sign in to access your personalized recommendations
        </CardDescription>
      </CardHeader>

      {/* Google sign-in — always on top */}
      <div className="px-6">
        <GoogleSignInButton showLastUsed={lastMethod === 'google'} />
      </div>

      {/* Separator */}
      <div className="px-6">
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-0">
          <div className={`relative ${isEmailLastUsed ? 'ring-2 ring-brand-orange ring-offset-2 rounded-lg p-4' : ''}`}>
            {isEmailLastUsed && (
              <span className="absolute -top-3 -right-3 z-10 bg-brand-orange text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm animate-scale-in">
                Last used
              </span>
            )}
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="signin-email" 
                  ref={emailInputRef}
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
          </div>

          {/* Progressive disclosure: password appears after email input */}
          {email.length > 0 && (
            <div className="space-y-4 animate-fade-in">
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
                    className={`pl-10 pr-10 ${formError ? 'border-destructive' : ''}`}
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
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-brand-orange hover:text-brand-orange/80 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          )}
        </CardContent>

        {email.length > 0 && (
          <CardFooter className="animate-fade-in">
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
        )}
      </form>
    </Card>
  );
};

export default SignInForm;
