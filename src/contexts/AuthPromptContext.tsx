import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { trackGuestEvent } from '@/utils/guestConversionTracker';
import AuthPromptModal from '@/components/auth/AuthPromptModal';

export interface AuthPromptConfig {
  action: string;
  entityName?: string;
  entityId?: string;
  postId?: string;
  recommendationId?: string;
  description?: string;
  surface: string;
}

interface AuthPromptContextValue {
  /** Opens the auth prompt modal. No-op if already open. */
  showAuthPrompt: (config: AuthPromptConfig) => void;
  /** Returns true if user is authenticated. If not, opens the modal and returns false. */
  requireAuth: (config: AuthPromptConfig) => boolean;
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

export const AuthPromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AuthPromptConfig | null>(null);

  const showAuthPrompt = useCallback((cfg: AuthPromptConfig) => {
    // Spam prevention: no-op if already open
    if (isOpen) return;

    setConfig(cfg);
    setIsOpen(true);

    trackGuestEvent('auth_prompt_shown', {
      action: cfg.action,
      entityId: cfg.entityId,
      entityName: cfg.entityName,
      postId: cfg.postId,
      recommendationId: cfg.recommendationId,
      surface: cfg.surface,
    });
  }, [isOpen]);

  const requireAuth = useCallback((cfg: AuthPromptConfig): boolean => {
    if (user) return true;
    showAuthPrompt(cfg);
    return false;
  }, [user, showAuthPrompt]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
  }, []);

  return (
    <AuthPromptContext.Provider value={{ showAuthPrompt, requireAuth }}>
      {children}
      <AuthPromptModal isOpen={isOpen} config={config} onClose={handleClose} />
    </AuthPromptContext.Provider>
  );
};

export const useAuthPrompt = (): AuthPromptContextValue => {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) throw new Error('useAuthPrompt must be used within AuthPromptProvider');
  return ctx;
};
