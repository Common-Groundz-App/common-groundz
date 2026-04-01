
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { getInitialsFromName } from '@/utils/profileUtils';
import { cn } from '@/lib/utils';

interface MentionUser {
  id: string;
  username: string;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface MentionAutocompleteProps {
  query: string;
  visible: boolean;
  onSelect: (username: string) => void;
  onClose: () => void;
  className?: string;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  visible,
  onSelect,
  onClose,
  className,
}) => {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !query) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, first_name, last_name')
          .ilike('username', `${query}%`)
          .is('deleted_at', null)
          .limit(5);

        if (error) throw error;
        setUsers((data || []).filter(u => u.username) as MentionUser[]);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Mention search error:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 200);
    return () => clearTimeout(debounce);
  }, [query, visible]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || users.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % users.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + users.length) % users.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      onSelect(users[selectedIndex].username);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [visible, users, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!visible || (users.length === 0 && !loading)) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden",
        className
      )}
    >
      {loading && users.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
      ) : (
        users.map((user, index) => {
          const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
          return (
            <button
              key={user.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(user.username);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {getInitialsFromName(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">@{user.username}</div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

export default MentionAutocomplete;
