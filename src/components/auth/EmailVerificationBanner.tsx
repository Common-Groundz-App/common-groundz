import React, { useState, useEffect } from 'react';
import { X, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { AUTH_CONFIG, VERIFICATION_MESSAGES } from '@/config/authConfig';

const STORAGE_KEY = 'email-verification-banner-dismissed';

/**
 * Persistent banner for unverified users
 * - Shows amber warning styling
 * - Displays user's email address
 * - "Resend verification email" button with cooldown
 * - Dismissible (persists to localStorage)
 * - Only shows for authenticated, unverified users
 */
export const EmailVerificationBanner: React.FC = () => {
  const { isVerified, userEmail, handleResendEmail } = useEmailVerification();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  // Don't show if verified, dismissed, or no user email
  if (isVerified || isDismissed || !userEmail) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleResend = async () => {
    if (cooldownRemaining > 0 || isResending) return;
    
    setIsResending(true);
    const success = await handleResendEmail();
    setIsResending(false);
    
    if (success) {
      setCooldownRemaining(AUTH_CONFIG.VERIFICATION_RESEND_COOLDOWN);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="container max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {VERIFICATION_MESSAGES.bannerTitle}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
              {userEmail} • {VERIFICATION_MESSAGES.bannerDescription}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={cooldownRemaining > 0 || isResending}
            className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            {isResending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            {cooldownRemaining > 0 
              ? `Resend (${cooldownRemaining}s)` 
              : VERIFICATION_MESSAGES.resendButton
            }
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
