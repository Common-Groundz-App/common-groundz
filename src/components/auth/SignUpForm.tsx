
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { validateUsernameFormat, checkUsernameUniqueness } from '@/utils/usernameValidation';
import { calculatePasswordStrength } from '@/utils/passwordStrength';
import UserInfoFields from './UserInfoFields';
import CredentialFields from './CredentialFields';
import UsernameField from './UsernameField';
import EmailVerificationPending from './EmailVerificationPending';
import TurnstileWidget from './TurnstileWidget';
import { signUpViaGateway, formatRateLimitError } from '@/lib/authGateway';

interface SignUpFormProps {
  onSwitchToSignIn?: () => void;
}

const SignUpForm = ({ onSwitchToSignIn }: SignUpFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationPending, setShowVerificationPending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Clear password error when passwords change
  useEffect(() => {
    setPasswordError('');
  }, [password, confirmPassword]);

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const handleTurnstileError = () => {
    setTurnstileToken(null);
    toast.error('Security verification failed. Please refresh the page.');
  };

  const handleTurnstileExpire = () => {
    setTurnstileToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password strength
    const strength = calculatePasswordStrength(password);
    if (!strength.meetsMinimum) {
      setPasswordError('Please choose a stronger password');
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const formatError = validateUsernameFormat(username);
    if (formatError) {
      setUsernameError(formatError);
      return;
    }

    // Verify Turnstile token
    if (!turnstileToken) {
      toast.error('Please wait for security verification to complete');
      return;
    }
    
    setIsLoading(true);
    
    const { isUnique, error: usernameCheckError } = await checkUsernameUniqueness(username);
    if (!isUnique) {
      setUsernameError(usernameCheckError);
      setIsLoading(false);
      return;
    }
    
    try {
      const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      const formattedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
      
      const result = await signUpViaGateway(
        {
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              first_name: formattedFirstName,
              last_name: formattedLastName,
              username: username.toLowerCase(),
            },
          },
        },
        turnstileToken
      );
      
      if (result.error) {
        // Handle rate limiting
        if (result.code === 'RATE_LIMITED') {
          toast.error(formatRateLimitError(result.retryAfter));
          return;
        }
        throw new Error(result.error);
      }
      
      // Show verification pending screen instead of navigating away
      setShowVerificationPending(true);
    } catch (error: any) {
      toast.error(error.message || 'Error signing up');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show verification pending screen after successful signup
  if (showVerificationPending) {
    return (
      <EmailVerificationPending 
        email={email}
        onBackToSignIn={() => {
          setShowVerificationPending(false);
          onSwitchToSignIn?.();
        }}
      />
    );
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl text-center">Join the Community</CardTitle>
        <CardDescription className="text-center">
          Create an account to discover recommendations you'll love
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <UserInfoFields 
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
          />
          
          <CredentialFields 
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            passwordError={passwordError}
            showConfirmField={true}
            showStrengthIndicator={true}
          />
          
          <UsernameField 
            username={username}
            setUsername={setUsername}
            usernameError={usernameError}
            setUsernameError={setUsernameError}
            isCheckingUsername={isCheckingUsername}
            setIsCheckingUsername={setIsCheckingUsername}
          />

          {/* Invisible Turnstile CAPTCHA */}
          <TurnstileWidget
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
            onExpire={handleTurnstileExpire}
          />
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white" 
            disabled={isLoading || !!usernameError || isCheckingUsername || !turnstileToken}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default SignUpForm;
