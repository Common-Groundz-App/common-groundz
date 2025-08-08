import React from 'react';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

export type MentionResult = {
  kind: 'user' | 'entity';
  id: string;
  username?: string | null;
  name?: string;
  avatar_url?: string | null;
  image_url?: string | null;
};

interface MentionTypeaheadProps {
  query: string;
  onSelect: (item: MentionResult) => void;
  onClose: () => void;
}

export const MentionTypeahead: React.FC<MentionTypeaheadProps> = ({ query, onSelect, onClose }) => {
  console.log('🎯 [MentionTypeahead] Rendering with:', { query, queryLength: query.length });
  
  const { results, isLoading, error } = useUnifiedSearch(query, { skipProductSearch: true });

  console.log('🎯 [MentionTypeahead] Search results:', { results, isLoading, error });

  const users = results.users || [];
  const entities = results.entities || [];

  console.log('🎯 [MentionTypeahead] Processed data:', { 
    usersCount: users.length, 
    entitiesCount: entities.length,
    users: users.map(u => ({ id: u.id, username: u.username }))
  });

  // Show dropdown even for short queries to aid debugging
  if (!query) {
    console.log('🎯 [MentionTypeahead] No query provided, not rendering');
    return null;
  }

  return (
    <div className="rounded-md border bg-background shadow-lg z-50" style={{ 
      backgroundColor: 'white',
      border: '1px solid #ccc',
      minHeight: '60px'
    }}>
      <div className="p-2 text-xs text-gray-500 border-b">
        Debug: Query="{query}" Users={users.length} Entities={entities.length}
      </div>
      
      {isLoading && (
        <div className="p-2 text-sm text-muted-foreground">Searching…</div>
      )}

      {error && (
        <div className="p-2 text-sm text-red-500">Error: {error}</div>
      )}

      {!isLoading && !error && users.length === 0 && entities.length === 0 && query.length >= 2 && (
        <div className="p-2 text-sm text-muted-foreground">No matches for "{query}"</div>
      )}

      {!isLoading && !error && query.length < 2 && (
        <div className="p-2 text-sm text-muted-foreground">Type at least 2 characters</div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="py-1">
          <div className="px-2 py-1 text-xs text-muted-foreground">Users</div>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full px-2 py-2 flex items-center gap-2 hover:bg-accent/40"
              onClick={() => onSelect({ kind: 'user', id: u.id, username: u.username, avatar_url: u.avatar_url })}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={u.avatar_url || undefined} alt={u.username || 'User'} />
                <AvatarFallback>{(u.username || 'U')[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{u.username || 'User'}</span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && entities.length > 0 && (
        <div className="py-1 border-t">
          <div className="px-2 py-1 text-xs text-muted-foreground">Entities</div>
          {entities.map((e) => (
            <button
              key={e.id}
              type="button"
              className="w-full px-2 py-2 flex items-center gap-2 hover:bg-accent/40"
              onClick={() => onSelect({ kind: 'entity', id: e.id, name: e.name, image_url: e.image_url })}
            >
              <div className="h-6 w-6 overflow-hidden rounded">
                <ImageWithFallback src={e.image_url || ''} alt={e.name} className="h-6 w-6 object-cover" />
              </div>
              <span className="text-sm">{e.name}</span>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="w-full text-xs text-muted-foreground py-1 hover:bg-accent/30" onClick={onClose}>
        Close
      </button>
    </div>
  );
};

export default MentionTypeahead;
