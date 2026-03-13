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
import type { AuthPromptConfig } from '@/contexts/AuthPromptContext';

/** Copy mapping per action */
const ACTION_COPY: Record<string, { verb: string; description: string }> = {
  follow: { verb: 'follow', description: 'Get updates and see what your circle recommends.' },
  save: { verb: 'save', description: 'Build your personal collection.' },
  like: { verb: 'like this', description: 'Show your appreciation to the community.' },
  review: { verb: 'write a review', description: 'Share your experience with the community.' },
  recommend: { verb: 'recommend', description: 'Help your circle discover great things.' },
  comment: { verb: 'join the conversation', description: 'Share your thoughts with the community.' },
  claim: { verb: 'claim', description: 'Manage your business on Common Groundz.' },
  suggest_edit: { verb: 'suggest edits', description: 'Help keep information accurate.' },
  upload_media: { verb: 'add photos', description: 'Share your photos with the community.' },
  timeline: { verb: 'start a timeline', description: 'Track how your experience evolves over time.' },
  save_insight: { verb: 'save this', description: 'Keep track of insights that matter to you.' },
  create_post: { verb: 'create a post', description: 'Share your thoughts with the community.' },
  create_entity: { verb: 'add a place', description: 'Help the community discover new places.' },
  generic: { verb: 'continue', description: 'Unlock all features on Common Groundz.' },
};

interface AuthPromptModalProps {
  isOpen: boolean;
  config: AuthPromptConfig | null;
  onClose: () => void;
}

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, config, onClose }) => {
  const navigate = useNavigate();

  if (!config) return null;

  const copy = ACTION_COPY[config.action] ?? ACTION_COPY.generic;
  const entityLabel = config.entityName ? ` ${config.entityName}` : '';
  const title = `Sign up to ${copy.verb}${entityLabel}`;
  const description = config.description || copy.description;

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
    // GoogleSignInButton handles its own OAuth flow — modal stays open until redirect
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
      <AlertDialogContent className="max-w-md w-[90vw] p-0 gap-0 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-4">
          {/* Title */}
          <AlertDialogTitle className="text-xl font-semibold leading-tight">
            {title}
          </AlertDialogTitle>

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
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AuthPromptModal;
