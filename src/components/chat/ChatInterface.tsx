import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { PreferenceConfirmationChips, DetectedPreference } from './PreferenceConfirmationChips';
import { createUnifiedConstraint } from '@/utils/constraintUtils';
import { createPreferenceValue } from '@/utils/preferenceRouting';

interface Source {
  title: string;
  domain: string;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  detectedPreference?: DetectedPreference | null;
  preferenceActionTaken?: 'saved_avoid' | 'saved_preference' | 'dismissed' | null;
  sources?: Source[];
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterface({ isOpen, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<'typing' | 'searching' | 'thinking'>('typing');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { addUnifiedConstraint, addPreferenceValue } = usePreferences();

  // Process inline formatting: bold and citations
  const processInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (/^\[\d+\]$/.test(part)) {
        return (
          <span key={i} className="text-[10px] text-muted-foreground align-super ml-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Simple markdown-to-JSX renderer
  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    
    return lines.map((line, idx) => {
      // Horizontal divider
      if (line.trim() === '---') {
        return <hr key={idx} className="my-2 border-border/50" />;
      }
      
      // Headings (### text, ## text, # text) - render as styled text, no hash marks
      const headingMatch = line.trim().match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const sizes: Record<number, string> = {
          1: 'text-base font-bold mt-3 mb-1',
          2: 'text-sm font-semibold mt-2 mb-1',
          3: 'text-sm font-medium mt-2 mb-0.5'
        };
        return (
          <div key={idx} className={sizes[level] || sizes[3]}>
            {processInline(headingText)}
          </div>
        );
      }
      
      // Bullet points (•, -, *) - ensure bullet and text stay together
      const bulletMatch = line.trim().match(/^[•\-\*]\s*(.*)$/);
      if (bulletMatch) {
        const bulletContent = bulletMatch[1].trim();
        if (!bulletContent) return null; // Skip empty bullet lines
        return (
          <div key={idx} className="flex gap-2 ml-2 my-0.5">
            <span className="text-muted-foreground shrink-0">•</span>
            <span className="flex-1">{processInline(bulletContent)}</span>
          </div>
        );
      }
      
      // Numbered list
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-muted-foreground">{numMatch[1]}.</span>
            <span>{processInline(numMatch[2])}</span>
          </div>
        );
      }
      
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      
      // Regular paragraph
      return <p key={idx}>{processInline(line)}</p>;
    });
  };
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Map scope to preference field
  const scopeToPreferenceField = (scope: string): string => {
    const mapping: Record<string, string> = {
      'food': 'food_preferences',
      'skincare': 'skin_type',
      'haircare': 'hair_type',
      'entertainment': 'genre_preferences',
      'health': 'lifestyle',
      'general': 'lifestyle',
    };
    return mapping[scope] || 'lifestyle';
  };

  // Map scope to constraint scope
  const scopeToConstraintScope = (scope: string): 'global' | 'skincare' | 'food' | 'entertainment' => {
    const mapping: Record<string, 'global' | 'skincare' | 'food' | 'entertainment'> = {
      'food': 'food',
      'skincare': 'skincare',
      'haircare': 'skincare',
      'entertainment': 'entertainment',
      'health': 'global',
      'general': 'global',
    };
    return mapping[scope] || 'global';
  };

  const handleSaveAsAvoid = async (messageId: string, pref: DetectedPreference) => {
    // Use detected targetType with defensive fallback
    // If backend inference fails, use 'rule' for general/global scope, 'ingredient' otherwise
    const targetType = pref.targetType ?? 
      (pref.scope === 'general' || pref.scope === 'global' ? 'rule' : 'ingredient');
    
    const unified = createUnifiedConstraint(targetType, pref.value, {
      scope: scopeToConstraintScope(pref.scope),
      intent: 'avoid',
      source: 'explicit_user_confirmation',
    });
    
    const success = await addUnifiedConstraint(unified);
    
    if (success) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, preferenceActionTaken: 'saved_avoid' as const } : m
      ));
      
      // Mark as dismissed in memory so it won't appear in LFC
      await markPreferenceAsDismissedInMemory(pref.value, pref.scope, 'saved_as_avoid');
      
      toast({ 
        title: "Added to Things to Avoid",
        description: `"${pref.value}" will be avoided in recommendations`
      });
    }
  };

  const handleSaveAsPreference = async (messageId: string, pref: DetectedPreference) => {
    const preferenceField = scopeToPreferenceField(pref.scope);
    
    // Preserve original intent: if detected as 'avoid', store as 'avoid' intent
    const intentToStore = pref.type === 'avoid' ? 'avoid' : 'prefer';
    
    const newValue = createPreferenceValue(
      pref.value,
      'explicit_user_confirmation',
      intentToStore,
      pref.confidence
    );
    
    const success = await addPreferenceValue(preferenceField, newValue);
    
    if (success) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, preferenceActionTaken: 'saved_preference' as const } : m
      ));
      
      // Mark as dismissed in memory so it won't appear in LFC
      await markPreferenceAsDismissedInMemory(pref.value, pref.scope, 'saved_as_preference');
      
      toast({ 
        title: "Added to Your Preferences",
        description: `"${pref.value}" saved to your preferences`
      });
    }
  };

  const handleDismissPreference = async (messageId: string, pref: DetectedPreference) => {
    // Mark as dismissed so it won't appear in LFC
    await markPreferenceAsDismissedInMemory(pref.value, pref.scope, 'dismissed_inline');
    
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, preferenceActionTaken: 'dismissed' as const } : m
    ));
  };

  const markPreferenceAsDismissedInMemory = async (value: string, scope: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('user_conversation_memory')
        .select('metadata')
        .eq('user_id', user.id)
        .maybeSingle();

      const metadata = (existing?.metadata as Record<string, any>) || {};
      const dismissedInline = (metadata.dismissed_inline as any[]) || [];

      dismissedInline.push({
        value: value.toLowerCase(),
        scope,
        reason,
        dismissedAt: new Date().toISOString(),
        dismissedVia: 'inline_chip'
      });

      const updatedMetadata = { ...metadata, dismissed_inline: dismissedInline };

      if (existing) {
        await supabase
          .from('user_conversation_memory')
          .update({ metadata: updatedMetadata })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_conversation_memory')
          .insert([{
            user_id: user.id,
            memory_type: 'conversation',
            memory_summary: 'User preferences memory',
            metadata: updatedMetadata
          }]);
      }
    } catch (err) {
      console.error('Error marking preference as dismissed:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsLoading(true);
    setLoadingState('thinking');

    try {
      // Call the smart-assistant edge function
      const { data, error } = await supabase.functions.invoke('smart-assistant', {
        body: {
          conversationId: conversationId,
          message: messageText,
          context: {
            // Add any relevant context here (e.g., entity ID if viewing product page)
          }
        }
      });

      if (error) {
        console.error('Error calling assistant:', error);
        throw error;
      }

      // Update conversation ID if this was a new conversation
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add assistant's response to messages with detected preference
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        createdAt: new Date(),
        detectedPreference: data.detectedPreference || null,
        preferenceActionTaken: null,
        sources: data.sources || [],
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Extract user-friendly error message
      const errorMessage = error instanceof Error ? error.message : "Failed to send message. Please try again.";
      
      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Add error message to chat
      const assistantErrorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, ${errorMessage}`,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
    toast({
      title: "New conversation started",
      description: "Previous conversation saved",
    });
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) {
      // Just clear local state
      setMessages([]);
      setInput('');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      setMessages([]);
      setConversationId(null);
      setInput('');
      
      toast({
        title: "Conversation deleted",
        description: "Messages have been removed",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const handleResetMemory = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset your memory? This will delete all learned preferences and cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('user_conversation_memory')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({
        title: "Memory reset",
        description: "All learned preferences have been cleared",
      });
    } catch (error) {
      console.error('Error resetting memory:', error);
      toast({
        title: "Error",
        description: "Failed to reset memory",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-background border border-border rounded-lg shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-semibold text-foreground">Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            className="text-xs h-auto py-1.5 px-2"
          >
            New Chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteConversation}
            className="text-xs text-destructive h-auto py-1.5 px-2"
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetMemory}
            className="text-xs text-amber-500 h-auto py-1.5 px-2"
          >
            Reset Memory
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground text-sm mb-4">
              Start a conversation or try a quick action:
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                "Get personalized recommendations",
                "What do you know about my preferences?",
                "Find products for sensitive skin",
                "Show me my favorite genres"
              ].map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(action);
                    textareaRef.current?.focus();
                  }}
                  className="text-left justify-start h-auto py-2 px-3"
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                {/* Message bubble */}
                <div
                  className={cn(
                    "flex",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <div className="text-sm space-y-1">
                      {message.role === 'assistant' 
                        ? renderMarkdown(message.content)
                        : <p className="whitespace-pre-wrap">{message.content}</p>
                      }
                    </div>
                    
                    {/* Sources section - clean pill/chip design with favicons */}
                    {message.role === 'assistant' && message.sources && message.sources.length > 0 && (() => {
                      const messageKey = message.id || `msg-${messages.indexOf(message)}`;
                      const isExpanded = expandedSources.has(messageKey);
                      const visibleCount = isExpanded ? message.sources.length : 5;
                      
                      return (
                        <div className="mt-3 pt-2 border-t border-border/40">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-1">Sources:</span>
                            {message.sources.slice(0, visibleCount).map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] bg-background border border-border/60 hover:bg-muted px-2.5 py-1 rounded-full transition-colors"
                              >
                                <img 
                                  src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-sm"
                                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                                />
                                <span>{source.domain}</span>
                              </a>
                            ))}
                            {message.sources.length > 5 && !isExpanded && (
                              <button 
                                onClick={() => setExpandedSources(prev => {
                                  const next = new Set(prev);
                                  next.add(messageKey);
                                  return next;
                                })}
                                className="text-[11px] text-primary hover:underline self-center"
                              >
                                +{message.sources.length - 5} more
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Preference confirmation chips for assistant messages */}
                {message.role === 'assistant' && 
                 message.detectedPreference && 
                 !message.preferenceActionTaken && (
                  <PreferenceConfirmationChips
                    preference={message.detectedPreference}
                    onSaveAsAvoid={() => handleSaveAsAvoid(message.id, message.detectedPreference!)}
                    onSaveAsPreference={() => handleSaveAsPreference(message.id, message.detectedPreference!)}
                    onDismiss={() => handleDismissPreference(message.id, message.detectedPreference!)}
                  />
                )}

                {/* Confirmation after action */}
                {message.preferenceActionTaken === 'saved_avoid' && (
                  <div className="flex items-center gap-1 text-xs text-green-600 ml-2 mt-1">
                    <Check className="h-3 w-3" />
                    Added to Things to Avoid
                  </div>
                )}
                {message.preferenceActionTaken === 'saved_preference' && (
                  <div className="flex items-center gap-1 text-xs text-green-600 ml-2 mt-1">
                    <Check className="h-3 w-3" />
                    Added to Your Preferences
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {loadingState === 'typing' && 'AI is typing...'}
                    {loadingState === 'searching' && 'Searching reviews...'}
                    {loadingState === 'thinking' && 'Thinking...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            variant="gradient"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}
