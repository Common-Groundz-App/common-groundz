import { useLocation } from 'react-router-dom';
import { FloatingChatButton } from './FloatingChatButton';
import { ChatInterface } from './ChatInterface';
import { useChat } from '@/hooks/useChat';

interface ChatProviderProps {
  children: React.ReactNode;
}

// Routes where the floating chat assistant should be hidden to avoid distraction
const HIDDEN_ROUTES = ['/create'];

export function ChatProvider({ children }: ChatProviderProps) {
  const { isOpen, toggle, close } = useChat();
  const { pathname } = useLocation();
  const hidden = HIDDEN_ROUTES.includes(pathname);

  return (
    <>
      {children}
      {!hidden && <FloatingChatButton isOpen={isOpen} onClick={toggle} />}
      {!hidden && <ChatInterface isOpen={isOpen} onClose={close} />}
    </>
  );
}
