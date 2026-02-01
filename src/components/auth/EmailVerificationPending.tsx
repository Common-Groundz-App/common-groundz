import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_CONFIG } from '@/config/authConfig';
import { toast } from 'sonner';

interface EmailVerificationPendingProps {
  email: string;
  onBackToSignIn: () => void;
}

const EmailVerificationPending = ({ email, onBackToSignIn }: EmailVerificationPendingProps) => {
  const { resendVerificationEmail } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    
    setIsResending(true);
    try {
      const { error } = await resendVerificationEmail();
      if (error) throw error;
      toast.success('Verification email sent!');
      setCooldown(AUTH_CONFIG.VERIFICATION_RESEND_COOLDOWN);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-brand-orange" />
        </div>
        <CardTitle className="text-2xl">Check Your Email</CardTitle>
        <CardDescription className="text-base">
          We've sent a verification link to
        </CardDescription>
        <p className="font-medium text-foreground mt-1">{email}</p>
      </CardHeader>
      
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Click the link in the email to verify your account. 
          If you don't see it, check your spam folder.
        </p>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
        >
          {isResending ? 'Sending...' : 
           cooldown > 0 ? `Resend in ${cooldown}s` : 
           'Resend Verification Email'}
        </Button>
        
        <Button
          variant="ghost"
          className="w-full"
          onClick={onBackToSignIn}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign In
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmailVerificationPending;
