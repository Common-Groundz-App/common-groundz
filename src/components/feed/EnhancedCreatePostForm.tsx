
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UnifiedEntitySelector } from '@/components/feed/UnifiedEntitySelector';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { Badge } from '@/components/ui/badge';
import { X, Image, Smile, Tag, MapPin, MoreHorizontal, Globe, Lock, Users, ChevronDown, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/services/profileService';
import { getInitialsFromName } from '@/utils/profileUtils';
import { TwitterStyleMediaPreview } from '@/components/media/TwitterStyleMediaPreview';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { LocationSearchInput } from './LocationSearchInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cleanStructuredFields, DURATION_OPTIONS } from '@/types/structuredFields';
import { analytics } from '@/services/analytics';
import { POST_TYPE_OPTIONS, getPlaceholderForType } from './utils/postUtils';
import type { DatabasePostType } from './utils/postUtils';
import { extractHashtagsDetailed, normalizeHashtag, extractHashtags } from '@/utils/hashtag';
import { getSuggestedTags } from '@/utils/hashtagSuggestions';
import { processPostHashtags } from '@/services/hashtagService';

interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  profileData?: any;
  initialEntity?: Entity;
}

type VisibilityOption = 'public' | 'private' | 'circle';

// Map UI visibility types to database visibility types
const mapVisibilityToDatabase = (visibility: VisibilityOption): 'public' | 'private' | 'circle_only' => {
  switch (visibility) {
    case 'public': return 'public';
    case 'private': return 'private';
    case 'circle': return 'circle_only';
    default: return 'public';
  }
};

export function EnhancedCreatePostForm({ onSuccess, onCancel, profileData, initialEntity }: EnhancedCreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitySelectorVisible, setEntitySelectorVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>('public');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState<{
    name: string;
    address: string;
    placeId: string;
    coordinates: { lat: number; lng: number };
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Structured fields state
  const [structuredOpen, setStructuredOpen] = useState(false);
  const [whatWorked, setWhatWorked] = useState('');
  const [whatDidnt, setWhatDidnt] = useState('');
  const [duration, setDuration] = useState('');
  const [goodFor, setGoodFor] = useState('');
  const [reuseIntent, setReuseIntent] = useState<'' | 'yes' | 'no'>('');
  const whatWorkedRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(uuidv4()).current;
  const [cursorPosition, setCursorPosition] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [selectorPrefillQuery, setSelectorPrefillQuery] = useState('');
  const MAX_MEDIA_COUNT = 4;
  const [postType, setPostType] = useState<DatabasePostType>('story');
  
  // Prefill entity when passed from parent (e.g. "Share your experience")
  useEffect(() => {
    if (initialEntity?.id) {
      setEntities(prev =>
        prev.some(e => e.id === initialEntity.id) ? prev : [...prev, initialEntity]
      );
    }
  }, [initialEntity]);

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle click outside for emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerVisible && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setEmojiPickerVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [emojiPickerVisible]);

  // Save cursor position when textarea is focused or clicked
  const saveCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      });
    }
  };

  // Handle emoji selection and insertion
  const handleEmojiSelect = (emoji: any) => {
    if (textareaRef.current) {
      const start = cursorPosition.start;
      const end = cursorPosition.end;
      
      // Insert emoji at cursor position
      const newContent = 
        content.substring(0, start) + 
        emoji.native + 
        content.substring(end);
      
      setContent(newContent);
      
      // Update cursor position for next insertion
      const newPosition = start + emoji.native.length;
      setCursorPosition({ start: newPosition, end: newPosition });
      
      // Focus back on textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          
          // Ensure textarea height is adjusted
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 10);
    }
    
    // Close emoji picker after selection
    setEmojiPickerVisible(false);
  };

  // Handle keyboard shortcut for posting (Cmd/Ctrl + Enter)
  useEffect(() => {
    const isPostButtonDisabled = (!content.trim() && media.length === 0) || isSubmitting;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isPostButtonDisabled) {
        handleSubmit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [content, media, isSubmitting]);

  // Handle drag and drop for the entire form
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.add('bg-accent/20');
      }
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.remove('bg-accent/20');
      }
    };
    
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.remove('bg-accent/20');
      }
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          // Handle file upload logic here if you have direct access
          // For now, we'll let the MediaUploader handle it
        }
      }
    };
    
    const currentRef = formRef.current;
    if (currentRef) {
      currentRef.addEventListener('dragover', handleDragOver, { passive: true });
      currentRef.addEventListener('dragleave', handleDragLeave, { passive: true });
      currentRef.addEventListener('drop', handleDrop);
    }
    
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('dragover', handleDragOver);
        currentRef.removeEventListener('dragleave', handleDragLeave);
        currentRef.removeEventListener('drop', handleDrop);
      }
    };
  }, []);

  const handleMediaUpload = (mediaItem: MediaItem) => {
    if (media.length < MAX_MEDIA_COUNT) {
      setMedia((prev) => [...prev, { ...mediaItem, order: prev.length }]);
    } else {
      toast({
        title: 'Media limit reached',
        description: `You can only upload up to ${MAX_MEDIA_COUNT} media items`,
        variant: 'destructive',
      });
    }
  };

  const removeMedia = (itemToRemove: MediaItem) => {
    setMedia((prev) => 
      prev
        .filter((item) => item.url !== itemToRemove.url)
        .map((item, index) => ({ ...item, order: index }))
    );
  };

  const replaceAtTrigger = (
    currentContent: string,
    liveCursorPos: number,
    replacement: string
  ): { newContent: string; newCursorPos: number } | null => {
    // Scan backward from cursor to find @ trigger
    const textBefore = currentContent.substring(0, liveCursorPos);
    const triggerMatch = textBefore.match(/(^|\s)@(\w*)$/);
    if (!triggerMatch) return null;
    
    const atIndex = liveCursorPos - triggerMatch[0].length + triggerMatch[1].length;
    // Validate: @ must be at start or preceded by whitespace
    if (atIndex > 0 && !/\s/.test(currentContent[atIndex - 1])) return null;
    
    const newContent = currentContent.substring(0, atIndex) + replacement + currentContent.substring(liveCursorPos);
    const newCursorPos = atIndex + replacement.length;
    return { newContent, newCursorPos };
  };

  const handleEntitiesChange = (newEntities: Entity[]) => {
    // If triggered via @, clean up the @query text from content
    if (selectorPrefillQuery !== '') {
      const liveCursor = textareaRef.current?.selectionStart ?? cursorPosition.start;
      const result = replaceAtTrigger(content, liveCursor, '');
      if (result) {
        setContent(result.newContent);
        setCursorPosition({ start: result.newCursorPos, end: result.newCursorPos });
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(result.newCursorPos, result.newCursorPos);
          }
        }, 10);
      }
    }
    setEntities(newEntities);
    setEntitySelectorVisible(false);
    setSelectorPrefillQuery('');
  };

  const removeEntity = (entityId: string) => {
    setEntities(prev => prev.filter(entity => entity.id !== entityId));
  };

  const handleSubmit = async () => {
    if (!requireAuth({ action: 'create_post', surface: 'create_post_form' })) return;

    if (!content.trim() && media.length === 0) {
      toast({
        title: 'Empty post',
        description: 'Please add some content or media to your post',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Map visibility to database enum type
      const dbVisibility = mapVisibilityToDatabase(visibility);
      
      // Clean media items for database
      const mediaToSave = media.map(item => ({
        id: item.id || uuidv4(),
        url: item.url,
        type: item.type,
        caption: item.caption || '',
        alt: item.alt || '',
        order: item.order,
        is_deleted: false,
        thumbnail_url: item.thumbnail_url || item.url
      }));

      // Store location as a tag if it exists, instead of in metadata
      const tags = location ? [location.name] : [];

      // Clean structured fields
      const cleanedStructured = cleanStructuredFields({
        what_worked: whatWorked,
        what_didnt: whatDidnt,
        duration: duration || undefined,
        good_for: goodFor,
        reuse_intent: reuseIntent || undefined,
      });

      // Prepare post data for database - explicitly type the post_type
      const postData: Record<string, any> = {
        title: title.trim() || null,
        content,
        media: mediaToSave,
        visibility: dbVisibility,
        user_id: user.id,
        post_type: postType || 'story',
        tags: tags,
      };

      // Only include structured_fields when there's actual data
      if (cleanedStructured) {
        postData.structured_fields = cleanedStructured;

        // Analytics: track which fields are used
        analytics.track('post_structured_fields_used', {
          has_pros: !!cleanedStructured.what_worked,
          has_cons: !!cleanedStructured.what_didnt,
          has_duration: !!cleanedStructured.duration,
          has_good_for: !!cleanedStructured.good_for,
          has_reuse: !!cleanedStructured.reuse_intent,
        });
      }

      // Track post type selection when non-default
      if (postType && postType !== 'story') {
        analytics.track('post_type_selected', { post_type: postType });
      }

      console.log('Submitting post:', postData);
      
      // Save to database
      const { data: newPost, error } = await supabase
        .from('posts')
        .insert(postData as any)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log('Post created:', newPost);
      
      // Add entity relationships if any
      if (entities.length > 0 && newPost) {
        for (const entity of entities) {
          const { error: entityError } = await supabase
            .from('post_entities')
            .insert({
              post_id: newPost.id,
              entity_id: entity.id
            });
            
          if (entityError) {
            console.error('Error saving entity relationship:', entityError);
          }
        }
      }
      
      // ===== Hashtag persistence (non-blocking) =====
      const { all: detectedTags, source: hashtagSource } = extractHashtagsDetailed(title, content);
      const filteredPayload = detectedTags
        .map(t => ({ original: t, normalized: normalizeHashtag(t) }))
        .filter(p => p.normalized.length > 0 && p.normalized.length <= 50);

      // Defensive duplicate guard (in case upstream dedup logic ever changes)
      const uniquePayload = Array.from(
        new Map(filteredPayload.map(p => [p.normalized, p])).values()
      );

      if (uniquePayload.length > 0 && newPost) {
        try {
          const ok = await processPostHashtags(newPost.id, uniquePayload);
          if (!ok) throw new Error('processPostHashtags returned false');
        } catch (err: any) {
          console.error('Hashtag linking failed (non-blocking):', err);
          analytics.track('post_hashtag_link_failed', {
            source: 'create',
            tag_count: uniquePayload.length,
            error_code: err?.code || err?.message || 'unknown',
          });
          toast({
            title: "Tags couldn't be saved",
            description: 'You can edit your post to add them again.',
          });
        }
      }

      analytics.track('post_hashtags_extracted', {
        source: 'create',
        count: uniquePayload.length,
        has_hashtags: uniquePayload.length > 0,
        hashtag_source: hashtagSource,
      });
      
      // Optimistic cache update — prepend new post to feed
      try {
        const optimisticItem = {
          ...newPost,
          is_post: true,
          is_optimistic: true,
          username: profileData?.username || null,
          displayName: profileData?.display_name || profileData?.username || null,
          avatar_url: profileData?.avatar_url || null,
          likes: 0,
          is_liked: false,
          is_saved: false,
          comment_count: 0,
          tagged_entities: entities,
          hashtags: uniquePayload.map(p => p.normalized),
          created_at: newPost.created_at || new Date().toISOString(),
        };

        const updateFeedCache = (oldData: any) => {
          if (!oldData?.pages?.[0]?.items) return oldData;
          const firstPage = oldData.pages[0];
          if (firstPage.items.some((item: any) => item.id === newPost.id)) return oldData;
          return {
            ...oldData,
            pages: [
              { ...firstPage, items: [optimisticItem, ...firstPage.items] },
              ...oldData.pages.slice(1),
            ],
          };
        };

        // Update all cached feed variants for this user
        queryClient.setQueriesData(
          { queryKey: ['infinite-feed'] },
          updateFeedCache
        );
      } catch (e) {
        console.warn('Optimistic update failed, relying on invalidation', e);
      }

      // Broad invalidation for background sync across all feed variants
      queryClient.invalidateQueries({ queryKey: ['infinite-feed'], exact: false });

      // Keep entity-specific refresh events for entity pages
      const refreshEntityId = entities[0]?.id;
      if (refreshEntityId) {
        window.dispatchEvent(new CustomEvent('refresh-posts', {
          detail: { entityId: refreshEntityId }
        }));
      }
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));

      toast({
        title: 'Experience shared',
        description: 'Your experience has been shared successfully',
      });

      // Reset form and notify parent
      setTitle('');
      setWhatWorked('');
      setWhatDidnt('');
      setDuration('');
      setGoodFor('');
      setReuseIntent('');
      setStructuredOpen(false);
      setPostType('story');
      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  function getVisibilityIcon() {
    switch (visibility) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'circle':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  }

  function getEntityIcon(type: string) {
    switch (type) {
      case 'place':
        return '🏠';
      case 'food':
        return '🍽️';
      case 'movie':
        return '🎬';
      case 'book':
        return '📚';
      case 'product':
        return '💄';
      default:
        return '🏷️';
    }
  }

  // Computed properties
  const isPostButtonDisabled = (!content.trim() && media.length === 0) || isSubmitting;

  // Live-detected hashtags for the composer chip row (read-only preview)
  const detectedHashtagsForChips = useMemo(() => {
    const { all } = extractHashtagsDetailed(title, content);
    return all
      .map(t => normalizeHashtag(t))
      .filter(n => n.length > 0 && n.length <= 50);
  }, [title, content]);

  // Phase 2: Suggested hashtags (entity + postType driven)
  const suggestedHashtags = useMemo(() => getSuggestedTags({
    entities,
    postType,
    existingTags: detectedHashtagsForChips,
  }), [entities, postType, detectedHashtagsForChips]);

  // Single-source dedup: track impression once per meaningful context signature
  const lastTrackedSuggestionsSignatureRef = useRef<string>('');
  useEffect(() => {
    if (suggestedHashtags.length === 0) return;
    const signature = JSON.stringify({
      tags: suggestedHashtags,
      entityIds: entities.map(e => e.id),
      postType: postType || null,
    });
    if (lastTrackedSuggestionsSignatureRef.current === signature) return;
    lastTrackedSuggestionsSignatureRef.current = signature;
    analytics.track('hashtag_suggestions_shown', {
      count: suggestedHashtags.length,
      tags: suggestedHashtags,
      entity_count: entities.length,
      post_type: postType || null,
    });
  }, [suggestedHashtags, entities, postType]);

  const handleSuggestedHashtagClick = useCallback((tag: string) => {
    // Reuse existing extractor — no regex drift vs Phase 1 persistence
    const present = new Set(extractHashtags(`${title || ''} ${content || ''}`));
    if (present.has(tag.toLowerCase())) return;

    const tagToken = `#${tag}`;
    const position = suggestedHashtags.indexOf(tag);

    if (content?.trim()) {
      setContent(prev => {
        const base = (prev || '').trimEnd();
        return base ? `${base} ${tagToken} ` : `${tagToken} `;
      });
    } else if (title?.trim()) {
      setTitle(prev => {
        const base = (prev || '').trimEnd();
        return base ? `${base} ${tagToken}` : tagToken;
      });
    } else {
      setContent(`${tagToken} `);
    }

    analytics.track('hashtag_suggestion_clicked', {
      tag,
      tag_position: position,
      entity_count: entities.length,
      post_type: postType || null,
      source: 'suggested_chip',
    });
  }, [title, content, suggestedHashtags, entities, postType]);
  
  // Get user display name using the profileData or fallback to user metadata
  const userDisplayName = user ? (
    profileData ? getDisplayName(user, profileData) : 
    (user.user_metadata?.username || user.email?.split('@')[0] || 'User')
  ) : 'User';

  // Get avatar URL from profileData
  const avatarUrl = profileData?.avatar_url || null;

  return (
    <div 
      ref={formRef} 
      className={`bg-background rounded-xl shadow-sm p-5 transition-all ${showLocationInput ? 'location-search-active' : ''}`}
    >
      {/* User Info + Text Input */}
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 cursor-pointer hover:opacity-90 transition-opacity">
          <AvatarImage src={avatarUrl || ''} alt={userDisplayName} />
          <AvatarFallback className="bg-brand-orange text-white font-semibold">
            {getInitialsFromName(userDisplayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{userDisplayName}</p>
          
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title (optional)"
            maxLength={120}
            aria-label="Post title"
            className="text-lg font-semibold border-none outline-none bg-transparent w-full placeholder:text-muted-foreground/50"
           />

          {/* Post Type Chips */}
          <div className="flex flex-wrap gap-1.5 py-1">
            {POST_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPostType(prev => prev === option.value ? 'story' : option.value);
                }}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs border transition-colors",
                  postType === option.value
                    ? "bg-accent text-accent-foreground border-accent-foreground/20"
                    : "border-input text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Entity Section — compact-expandable */}
          {entities.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 py-1">
              {entities.map((entity) => (
                <Badge 
                  key={entity.id} 
                  variant="outline" 
                  className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs bg-accent/30"
                >
                  <span>{getEntityIcon(entity.type)}</span>
                  <span>{entity.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 rounded-full hover:bg-muted"
                    onClick={() => removeEntity(entity.id)}
                  >
                    <X size={10} />
                  </Button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSelectorPrefillQuery('');
                  setEntitySelectorVisible(true);
                  setEmojiPickerVisible(false);
                  setShowLocationInput(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                + Add more
              </button>
            </div>
          ) : !entitySelectorVisible ? (
            <button
              type="button"
              onClick={() => {
                setSelectorPrefillQuery('');
                setEntitySelectorVisible(true);
                setEmojiPickerVisible(false);
                setShowLocationInput(false);
              }}
              className="flex items-center gap-2 w-full text-left cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors"
            >
              <Tag className="h-4 w-4" />
              <span>What are you sharing about?</span>
            </button>
          ) : null}

          {/* Inline Entity Selector */}
          {entitySelectorVisible && (
            <div className="p-3 border rounded-lg bg-background animate-fade-in">
              <UnifiedEntitySelector 
                onEntitiesChange={handleEntitiesChange}
                initialEntities={entities}
                initialQuery={selectorPrefillQuery}
                autoFocusSearch={true}
                maxEntities={3}
                onMentionInsert={(username) => {
                  const sanitized = username.replace(/[^a-z0-9._]/gi, '');
                  if (!sanitized) return;
                  const mentionText = `@${sanitized} `;
                  
                  // Use live cursor from textarea ref
                  const liveCursor = textareaRef.current?.selectionStart ?? cursorPosition.start;
                  const result = replaceAtTrigger(content, liveCursor, mentionText);
                  
                  let newContent: string;
                  let newCursorPos: number;
                  
                  if (result) {
                    newContent = result.newContent;
                    newCursorPos = result.newCursorPos;
                  } else {
                    // Fallback: insert at cursor
                    const start = liveCursor;
                    newContent = content.substring(0, start) + mentionText + content.substring(start);
                    newCursorPos = start + mentionText.length;
                  }
                  
                  setContent(newContent);
                  setCursorPosition({ start: newCursorPos, end: newCursorPos });
                  
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    }
                  }, 10);
                  
                  setEntitySelectorVisible(false);
                  setSelectorPrefillQuery('');
                }}
              />
            </div>
          )}

          <Textarea
            ref={textareaRef}
            placeholder={getPlaceholderForType(postType)}
            value={content}
            onChange={(e) => {
              const newContent = e.target.value;
              setContent(newContent);
              
              // Check for @ mention trigger
              const textarea = e.target;
              const cursorPos = textarea.selectionStart;
              
              // Look for @ symbol followed by text
              const textBeforeCursor = newContent.substring(0, cursorPos);
              const mentionMatch = textBeforeCursor.match(/(^|\s)@(\w*)$/);
              
              if (mentionMatch) {
                const mentionText = mentionMatch[2]; // Text after @
                setSelectorPrefillQuery(mentionText);
                setEntitySelectorVisible(true);
                setEmojiPickerVisible(false);
                setShowLocationInput(false);
              }
            }}
            className="min-h-[100px] resize-none border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/70"
            onClick={saveCursorPosition}
            onKeyUp={saveCursorPosition}
            onFocus={saveCursorPosition}
          />
          <p className="text-xs text-muted-foreground/60 mt-1">What worked? · What didn't? · Who is this useful for?</p>

          {/* Suggested hashtags chip row (clickable, Phase 2) */}
          {suggestedHashtags.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Suggested</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedHashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    onClick={() => handleSuggestedHashtagClick(tag)}
                    className="cursor-pointer hover:bg-accent gap-1 font-normal"
                  >
                    <Plus className="h-3 w-3" />
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Detected hashtags chip row (read-only preview) */}
          {detectedHashtagsForChips.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Tags</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {detectedHashtagsForChips.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="shrink-0 font-normal"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Structured Experience Fields — Collapsible */}
          <Collapsible open={structuredOpen} onOpenChange={(open) => {
            setStructuredOpen(open);
            if (open) {
              setTimeout(() => whatWorkedRef.current?.focus(), 100);
            }
          }}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", structuredOpen && "rotate-180")} />
                Add more about your experience
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 animate-fade-in">
              {/* What worked */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">What worked?</label>
                <Textarea
                  ref={whatWorkedRef}
                  value={whatWorked}
                  onChange={(e) => setWhatWorked(e.target.value)}
                  onBlur={() => setWhatWorked(prev => prev.trim().replace(/\s{2,}/g, ' '))}
                  placeholder="The best part was..."
                  maxLength={500}
                  className="min-h-[60px] resize-none text-sm"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{whatWorked.length}/500</p>
              </div>

              {/* What didn't work */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">What didn't work?</label>
                <Textarea
                  value={whatDidnt}
                  onChange={(e) => setWhatDidnt(e.target.value)}
                  onBlur={() => setWhatDidnt(prev => prev.trim().replace(/\s{2,}/g, ' '))}
                  placeholder="I wish it had..."
                  maxLength={500}
                  className="min-h-[60px] resize-none text-sm"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{whatDidnt.length}/500</p>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">How long have you used it?</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DURATION_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Good for */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Good for</label>
                <input
                  type="text"
                  value={goodFor}
                  onChange={(e) => setGoodFor(e.target.value)}
                  onBlur={() => setGoodFor(prev => prev.trim().replace(/\s{2,}/g, ' '))}
                  placeholder="e.g. Dry skin, Beginners, Date night"
                  maxLength={300}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{goodFor.length}/300</p>
              </div>

              {/* Would use again */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Would you use it again?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReuseIntent(reuseIntent === 'yes' ? '' : 'yes')}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-colors",
                      reuseIntent === 'yes'
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    )}
                  >
                    Yes, I'd use it again
                  </button>
                  <button
                    type="button"
                    onClick={() => setReuseIntent(reuseIntent === 'no' ? '' : 'no')}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-colors",
                      reuseIntent === 'no'
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    )}
                  >
                    No, I wouldn't
                  </button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Twitter Style Media Preview */}
      {media.length > 0 && (
        <TwitterStyleMediaPreview
          media={media}
          onRemove={removeMedia}
        />
      )}

      {/* Location Tag */}
      {location && (
        <div className="flex items-center gap-1 mt-3">
          <Badge 
            variant="outline" 
            className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs bg-accent/30"
          >
            <MapPin className="h-3 w-3" />
            <span>{location.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 rounded-full hover:bg-muted"
              onClick={() => setLocation(null)}
            >
              <X size={10} />
            </Button>
          </Badge>
          {location.address && (
            <span className="text-xs text-muted-foreground">{location.address}</span>
          )}
        </div>
      )}

      {/* Location Search Input (only shown when location button is clicked) */}
      {showLocationInput && !location && (
        <div className="mt-3 animate-fade-in location-search-wrapper">
          <LocationSearchInput
            onLocationSelect={(selectedLocation) => {
              setLocation(selectedLocation);
              setShowLocationInput(false);
            }}
            onClear={() => setShowLocationInput(false)}
          />
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className={`flex items-center justify-between mt-4 pt-3 border-t bottom-toolbar ${showLocationInput ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Left: Toolbar */}
        <div className="flex items-center gap-1">
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUpload}
            initialMedia={media}
            maxMediaCount={MAX_MEDIA_COUNT}
            customButton={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
                  media.length >= MAX_MEDIA_COUNT && "opacity-50 cursor-not-allowed"
                )}
                disabled={media.length >= MAX_MEDIA_COUNT}
              >
                <Image className="h-5 w-5" />
                {media.length > 0 && (
                  <span className="ml-1 text-xs font-medium">
                    {media.length}/{MAX_MEDIA_COUNT}
                  </span>
                )}
              </Button>
            }
          />
          
          {/* Emoji Button - Improved implementation */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
                emojiPickerVisible && "bg-accent/50 text-accent-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                saveCursorPosition();
                setEmojiPickerVisible(!emojiPickerVisible);
                if (!emojiPickerVisible) {
                  setShowLocationInput(false);
                }
              }}
              disabled={showLocationInput}
            >
              <Smile className="h-5 w-5" />
            </Button>
            
            {emojiPickerVisible && !showLocationInput && (
              <div 
                ref={emojiPickerRef}
                className="absolute z-50 bottom-full mb-2 left-0 emoji-picker-wrapper"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <Picker 
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="light"
                  previewPosition="none"
                  set="native"
                  skinTonePosition="none"
                  emojiSize={20}
                  emojiButtonSize={28}
                  maxFrequentRows={2}
                  modalish={false}
                  showSkinTones={false}
                />
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
              entitySelectorVisible && "bg-accent/50 text-accent-foreground"
            )}
            onClick={() => {
              setEntitySelectorVisible(!entitySelectorVisible);
              if (!entitySelectorVisible) {
                setShowLocationInput(false);
                setEmojiPickerVisible(false);
                setSelectorPrefillQuery(''); // Clear prefill when manually opening
              }
            }}
            disabled={showLocationInput}
          >
            <Tag className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
              showLocationInput && "bg-accent/50 text-accent-foreground"
            )}
            onClick={() => {
              setShowLocationInput(!showLocationInput);
              if (!showLocationInput) {
                setEmojiPickerVisible(false);
                setEntitySelectorVisible(false);
              }
            }}
          >
            <MapPin className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground"
            disabled={showLocationInput}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Right: Visibility + Post Actions */}
        <div className="flex items-center gap-2">
          <Select
            value={visibility}
            onValueChange={(value: VisibilityOption) => setVisibility(value)}
            disabled={showLocationInput}
          >
            <SelectTrigger className="w-[130px] h-9 border-none">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getVisibilityIcon()}
                  <span>
                    {visibility === 'public' ? 'Public' : 
                     visibility === 'private' ? 'Only Me' : 
                     'Circle Only'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Public</span>
                </div>
              </SelectItem>
              <SelectItem value="private">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span>Only Me</span>
                </div>
              </SelectItem>
              <SelectItem value="circle">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Circle Only</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting || showLocationInput}
            className="hover:bg-accent/50"
          >
            Cancel
          </Button>
          
          <Button 
            className={cn(
              "bg-brand-orange hover:bg-brand-orange/90 transition-all",
              (!isPostButtonDisabled && !isSubmitting) && "animate-fade-in"
            )}
            onClick={handleSubmit} 
            disabled={isPostButtonDisabled || showLocationInput}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" /> 
                <span>Posting...</span>
              </div>
            ) : (
              <span>Post</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
