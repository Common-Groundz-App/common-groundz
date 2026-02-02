import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  UNVERIFIED_USER_RESTRICTIONS, 
  VERIFICATION_MESSAGES,
  RestrictionAction 
} from '@/config/authConfig';

/**
 * Centralized hook for email verification checks and UX
 * 
 * Usage:
 * const { canPerformAction, showVerificationRequired } = useEmailVerification();
 * 
 * // Check before action
 * if (!canPerformAction('canFollowUsers')) {
 *   showVerificationRequired('canFollowUsers');
 *   return;
 * }
 */
export const useEmailVerification = () => {
  const { user, isEmailVerified, resendVerificationEmail } = useAuth();
  const { toast } = useToast();

  /**
   * Check if user can perform a specific action
   * Returns true if verified OR if the action is allowed for unverified users
   */
  const canPerformAction = useCallback((action: RestrictionAction): boolean => {
    if (isEmailVerified) return true;
    return UNVERIFIED_USER_RESTRICTIONS[action];
  }, [isEmailVerified]);

  /**
   * Show a toast notification when an action is blocked due to verification
   */
  const showVerificationRequired = useCallback((action?: RestrictionAction) => {
    const actionDescription = action 
      ? VERIFICATION_MESSAGES.actionDescriptions[action as keyof typeof VERIFICATION_MESSAGES.actionDescriptions]
      : undefined;

    toast({
      title: VERIFICATION_MESSAGES.toastTitle,
      description: actionDescription 
        ? `Please verify your email to ${actionDescription}.`
        : 'Please verify your email to perform this action.',
    });
  }, [toast]);

  /**
   * Handle resending verification email with toast feedback
   */
  const handleResendEmail = useCallback(async () => {
    const { error } = await resendVerificationEmail();
    if (error) {
      toast({
        title: 'Error',
        description: VERIFICATION_MESSAGES.resendError,
        variant: 'destructive',
      });
      return false;
    }
    toast({
      title: 'Email sent',
      description: VERIFICATION_MESSAGES.resendSuccess,
    });
    return true;
  }, [resendVerificationEmail, toast]);

  return {
    isVerified: isEmailVerified,
    userEmail: user?.email,
    canPerformAction,
    showVerificationRequired,
    handleResendEmail,
  };
};
