import React from 'react';
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { buildAuthUrl } from '@/utils/authUrlBuilder';
import { trackGuestEvent } from '@/utils/guestConversionTracker';
import { useTheme } from '@/contexts/ThemeContext';
import type { AuthPromptConfig } from '@/contexts/AuthPromptContext';

/** Copy mapping per action */
const ACTION_COPY: Record<string, { verb: string; description: string }> = {
  follow: { verb: 'follow', description: 'See what people in your circle recommend.' },
  save: { verb: 'save', description: 'Build your personal collection.' },
  like: { verb: 'like this', description: 'Show your appreciation and shape recommendations.' },
  review: { verb: 'write a review', description: 'Share your experience with people you trust.' },
  recommend: { verb: 'recommend', description: 'Help people you trust discover great things.' },
  comment: { verb: 'join the conversation', description: 'Join the conversation with your circle.' },
  claim: { verb: 'claim', description: 'Manage your business on Common Groundz.' },
  suggest_edit: { verb: 'suggest edits', description: 'Help keep information accurate.' },
  upload_media: { verb: 'add photos', description: 'Share your photos with the community.' },
  timeline: { verb: 'start a timeline', description: 'Track how your experience evolves over time.' },
  save_insight: { verb: 'save this', description: 'Keep track of insights that matter to you.' },
  create_post: { verb: 'create a post', description: 'Share your thoughts with your circle.' },
  create_entity: { verb: 'add a place', description: 'Help your circle discover new places.' },
  generic: { verb: 'continue', description: 'Unlock all features on Common Groundz.' },
};

interface AuthPromptModalProps {
  isOpen: boolean;
  config: AuthPromptConfig | null;
  onClose: () => void;
}

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, config, onClose }) => {
  const navigate = useNavigate();
  const { getThemedValue } = useTheme();

  if (!config) return null;

  const copy = ACTION_COPY[config.action] ?? ACTION_COPY.generic;
  const description = config.description || copy.description;

  const logoSrc = getThemedValue(
    "/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png",
    "/lovable-uploads/d4621fe6-4a75-45d1-a171-c55f4ad5fa28.png"
  );

  const analyticsPayload = {
    action: config.action,
    entityId: config.entityId,
    entityName: config.entityName,
    postId: config.postId,
    recommendationId: config.recommendationId,
    surface: config.surface,
  };

  const handleGoogleClick = () => {
    trackGuestEvent('auth_prompt_google_clicked', analyticsPayload);
  };

  const handleEmailClick = () => {
    trackGuestEvent('auth_prompt_email_clicked', analyticsPayload);
    onClose();
    navigate(buildAuthUrl('signup'));
  };

  const handleLoginClick = () => {
    trackGuestEvent('auth_prompt_login_clicked', analyticsPayload);
    onClose();
    navigate(buildAuthUrl('login'));
  };

  const handleDismiss = () => {
    trackGuestEvent('auth_prompt_dismissed', analyticsPayload);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="z-[109]" />
        <AlertDialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[110] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg w-[90vw] p-0 gap-0 overflow-hidden"
        >
        {/* Brand accent bar */}
        <div className="h-[2px] bg-brand-orange/80 w-full" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-6 flex flex-col items-center text-center gap-4">
          {/* Brand logo */}
          <img
            src={logoSrc}
            alt="Common Groundz"
            className="h-6 w-auto mx-auto mb-2"
            loading="eager"
          />

          {/* Title — split hierarchy when entityName exists */}
          {config.entityName ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-base font-medium text-muted-foreground">
                {copy.verb.charAt(0).toUpperCase() + copy.verb.slice(1)} for
              </span>
              <AlertDialogTitle className="text-xl font-semibold leading-tight">
                {config.entityName}
              </AlertDialogTitle>
            </div>
          ) : (
            <AlertDialogTitle className="text-xl font-semibold leading-tight">
              Sign up to {copy.verb}
            </AlertDialogTitle>
          )}

          {/* Description */}
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>

          {/* Actions */}
          <div className="w-full flex flex-col gap-3 mt-2">
            <div onClick={handleGoogleClick}>
              <GoogleSignInButton className="w-full" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleEmailClick}
            >
              Continue with Email
            </Button>
          </div>

          {/* Login link */}
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={handleLoginClick}
              className="text-primary font-medium hover:underline"
            >
              Log in
            </button>
          </p>

          {/* Not now */}
          <button
            onClick={handleDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Not now
          </button>
        </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
};

export default AuthPromptModal;
