
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyIcon, EyeIcon, EyeOffIcon, MailIcon, ArrowLeftIcon, UserIcon } from 'lucide-react';
import ForgotPasswordForm from './ForgotPasswordForm';
import { loginViaGateway, formatRateLimitError } from '@/lib/authGateway';
import { supabase } from '@/integrations/supabase/client';
import GoogleSignInButton from './GoogleSignInButton';
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [lastMethod] = useState(() => getLastAuthMethod());
  const emailInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    clearPendingGoogleAuth();
  }, []);

  // Auto-focus email input when email form is shown
  useEffect(() => {
    if (showEmailForm && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [showEmailForm]);

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

      {!showEmailForm ? (
        /* ── Initial view: two method buttons ── */
        <CardContent className="space-y-3 pt-0">
          <GoogleSignInButton showLastUsed={lastMethod === 'google'} />

          <div className="relative">
            {isEmailLastUsed && (
              <span className="absolute -top-3 -right-3 z-10 bg-brand-orange text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm animate-scale-in">
                Last used
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              className={`w-full gap-2 ${isEmailLastUsed ? 'ring-2 ring-brand-orange ring-offset-2' : ''}`}
              onClick={() => setShowEmailForm(true)}
            >
              <MailIcon className="h-5 w-5" />
              Continue with Email
            </Button>
          </div>
        </CardContent>
      ) : (
        /* ── Email form view ── */
        <form onSubmit={handleSubmit} className="animate-fade-in">
          <CardContent className="space-y-4 pt-0">
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
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
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

            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Back to all sign in options
            </button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
};

export default SignInForm;
