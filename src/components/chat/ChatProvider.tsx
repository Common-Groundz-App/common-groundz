import { FloatingChatButton } from './FloatingChatButton';
import { ChatInterface } from './ChatInterface';
import { useChat } from '@/hooks/useChat';

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { isOpen, toggle, close } = useChat();

  return (
    <>
      {children}
      <FloatingChatButton isOpen={isOpen} onClick={toggle} />
      <ChatInterface isOpen={isOpen} onClose={close} />
    </>
  );
}
