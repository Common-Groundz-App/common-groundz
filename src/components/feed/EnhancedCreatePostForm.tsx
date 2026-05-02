
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
import { ComposerTopBar } from './composer/ComposerTopBar';
import { ComposerBottomBar } from './composer/ComposerBottomBar';
import { MoreToolsPopover } from './composer/MoreToolsPopover';
import { EntityHeroPill } from './composer/EntityHeroPill';
import { EntitySelectorModal } from './composer/EntitySelectorModal';
import { PostTypeAndTagsPill } from './composer/PostTypeAndTagsPill';
import { PostTypeAndTagsModal } from './composer/PostTypeAndTagsModal';
import { DiscardDraftDialog } from './composer/DiscardDraftDialog';
import { useLocalStorage } from '@/hooks/useLocalStorage';
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
import { cleanStructuredFields, DURATION_OPTIONS, isValidStoredLocation } from '@/types/structuredFields';
import { analytics } from '@/services/analytics';
import { POST_TYPE_OPTIONS, getPlaceholderForType, mapPostTypeToDatabase } from './utils/postUtils';
import type { DatabasePostType, UIPostType } from './utils/postUtils';
import { extractHashtagsDetailed, normalizeHashtag, extractHashtags } from '@/utils/hashtag';
import { getSuggestedTags } from '@/utils/hashtagSuggestions';
import { processPostHashtags, updatePostHashtags } from '@/services/hashtagService';
import { triggerHaptic, playSound } from '@/services/feedbackService';

export interface PostToEdit {
  id: string;
  title?: string | null;
  content?: string | null;
  post_type?: DatabasePostType | null;
  visibility?: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
  tags?: string[] | null;
  structured_fields?: Record<string, any> | null;
  created_at?: string | null;
  last_edited_at?: string | null;
}

interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  profileData?: any;
  initialEntity?: Entity;
  postToEdit?: PostToEdit;
  /** Accepts UI types ('journal' | 'watching') in addition to DB types. */
  defaultPostType?: UIPostType;
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

// Map database visibility back to UI option (for edit hydration)
const mapVisibilityFromDatabase = (visibility?: string | null): VisibilityOption => {
  switch (visibility) {
    case 'private': return 'private';
    case 'circle_only': return 'circle';
    default: return 'public';
  }
};

export function EnhancedCreatePostForm({
  onSuccess,
  onCancel,
  profileData,
  initialEntity,
  postToEdit,
  defaultPostType,
}: EnhancedCreatePostFormProps) {
  const isEditMode = !!postToEdit;
  const { user } = useAuth();
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(postToEdit?.content ?? '');
  const [title, setTitle] = useState(postToEdit?.title ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>(postToEdit?.media ?? []);
  const [entities, setEntities] = useState<Entity[]>(postToEdit?.tagged_entities ?? []);
  const [entitySelectorVisible, setEntitySelectorVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>(
    mapVisibilityFromDatabase(postToEdit?.visibility)
  );
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState<{
    name: string;
    address: string;
    placeId: string;
    coordinates: { lat: number; lng: number };
  } | null>(() => {
    // Hydrate location from postToEdit.structured_fields.location.
    // Validation gate: ignore malformed/legacy garbage so the chip never
    // pre-fills with broken data. Map snake_case (storage) → camelCase (state).
    const stored = (postToEdit?.structured_fields as any)?.location;
    if (!isValidStoredLocation(stored)) return null;
    return {
      name: stored.name,
      address: stored.address ?? '',
      placeId: stored.place_id ?? '',
      coordinates: stored.coordinates ?? { lat: 0, lng: 0 },
    };
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Structured fields state — hydrate from postToEdit if editing
  const sf = (postToEdit?.structured_fields ?? {}) as Record<string, any>;
  const [structuredOpen, setStructuredOpen] = useState(
    !!(sf.what_worked || sf.what_didnt || sf.duration || sf.good_for || sf.reuse_intent)
  );
  const [whatWorked, setWhatWorked] = useState<string>(sf.what_worked ?? '');
  const [whatDidnt, setWhatDidnt] = useState<string>(sf.what_didnt ?? '');
  const [duration, setDuration] = useState<string>(sf.duration ?? '');
  const [goodFor, setGoodFor] = useState<string>(sf.good_for ?? '');
  const [reuseIntent, setReuseIntent] = useState<'' | 'yes' | 'no'>(
    (sf.reuse_intent as 'yes' | 'no' | undefined) ?? ''
  );
  const whatWorkedRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(uuidv4()).current;
  const [cursorPosition, setCursorPosition] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [selectorPrefillQuery, setSelectorPrefillQuery] = useState('');
  const prevContentLengthRef = useRef(postToEdit?.content?.length ?? 0);
  const MAX_MEDIA_COUNT = 4;
  // postType holds a UIPostType — 'journal' / 'watching' are UI-only and
  // get mapped to DB 'note' on submit (with ui_post_type stamped in
  // structured_fields so we can re-hydrate the chip on edit).
  const hydratedUiType =
    (postToEdit?.structured_fields as any)?.ui_post_type as UIPostType | undefined;
  const [postType, setPostType] = useState<UIPostType>(
    hydratedUiType ??
      (postToEdit?.post_type as UIPostType | undefined) ??
      defaultPostType ??
      'story'
  );
  // Visual fallback pulse on submit success (in case sound fails)
  const [submitPulse, setSubmitPulse] = useState(false);

  // New UI state for redesigned composer
  const [postTypeTagsOpen, setPostTypeTagsOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Draft autosave (create mode only). Stored as a flat object + timestamp;
  // expires after 24h to avoid stale clutter.
  const draftKey = `composer-draft-${user?.id ?? 'anon'}`;
  const [draft, setDraft, clearDraft] = useLocalStorage<{
    title: string;
    content: string;
    savedAt: number;
  } | null>(draftKey, null);

  // Restore draft on mount (CREATE mode only — never edit mode)
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (isEditMode || draftRestoredRef.current || !draft) return;
    draftRestoredRef.current = true;
    const ageMs = Date.now() - (draft.savedAt ?? 0);
    if (ageMs > 24 * 60 * 60 * 1000) {
      clearDraft();
      return;
    }
    if (!title && draft.title) setTitle(draft.title);
    if (!content && draft.content) setContent(draft.content);
    // Intentionally only depend on isEditMode to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // Debounced autosave of title/content (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    const handle = setTimeout(() => {
      if (title.trim() || content.trim()) {
        setDraft({ title, content, savedAt: Date.now() });
      }
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, isEditMode]);

  // Dirty check for close-guard
  const isDirty = useMemo(() => {
    if (isEditMode) {
      // In edit mode, treat as dirty if anything changed from postToEdit
      return (
        (title.trim() || null) !== (postToEdit?.title ?? null) ||
        content !== (postToEdit?.content ?? '') ||
        media.length !== (postToEdit?.media?.length ?? 0) ||
        entities.length !== (postToEdit?.tagged_entities?.length ?? 0)
      );
    }
    return !!(title.trim() || content.trim() || media.length > 0 || entities.length > 0);
  }, [isEditMode, title, content, media, entities, postToEdit]);

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setDiscardDialogOpen(true);
    } else {
      onCancel?.();
    }
  }, [isDirty, onCancel]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardDialogOpen(false);
    if (!isEditMode) clearDraft();
    onCancel?.();
  }, [isEditMode, clearDraft, onCancel]);


  // Prefill entity when passed from parent (e.g. "Share your experience").
  // Skip in edit mode — entities are already hydrated from postToEdit.
  useEffect(() => {
    if (isEditMode) return;
    if (initialEntity?.id) {
      setEntities(prev =>
        prev.some(e => e.id === initialEntity.id) ? prev : [...prev, initialEntity]
      );
    }
  }, [initialEntity, isEditMode]);

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

    // Haptic immediately after validation, before async work (mobile no-ops on desktop)
    try {
      triggerHaptic('light');
    } catch (err) {
      console.error('Haptic trigger failed:', err);
    }

    try {
      setIsSubmitting(true);

      const dbVisibility = mapVisibilityToDatabase(visibility);

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

      const tags = location ? [location.name] : [];

      // Build location payload for structured_fields. Guards:
      // - skip entirely if name is empty/whitespace (no garbage rows)
      // - coordinates only stored if BOTH lat and lng are finite numbers
      //   (partial/string-shaped coords → omitted, never half-stored)
      // - snake_case at storage boundary (placeId → place_id)
      const trimmedLocName = location?.name?.trim();
      const validCoords =
        location?.coordinates &&
        typeof location.coordinates.lat === 'number' &&
        typeof location.coordinates.lng === 'number' &&
        Number.isFinite(location.coordinates.lat) &&
        Number.isFinite(location.coordinates.lng)
          ? { lat: location.coordinates.lat, lng: location.coordinates.lng }
          : null;
      const locationPayload = trimmedLocName
        ? {
            name: trimmedLocName,
            address: location?.address?.trim() || null,
            place_id: location?.placeId?.trim() || null,
            coordinates: validCoords,
          }
        : null;

      const cleanedStructured = cleanStructuredFields({
        what_worked: whatWorked,
        what_didnt: whatDidnt,
        duration: duration || undefined,
        good_for: goodFor,
        reuse_intent: reuseIntent || undefined,
        location: locationPayload ?? undefined,
      });

      // -------- Safe structured_fields merge (Guard A + stale clear) --------
      // Never wipe user data on null/empty cleaned. Strip ui_post_type when
      // the user switched away from a UI-only type so hydration stays correct.
      const existingStructured =
        (postToEdit?.structured_fields as Record<string, any>) ?? {};
      const safeCleaned: Record<string, any> =
        cleanedStructured && Object.keys(cleanedStructured).length > 0
          ? { ...cleanedStructured }
          : {};

      let mergedStructured: Record<string, any> | null;
      if (postType === 'journal' || postType === 'watching') {
        mergedStructured = {
          ...existingStructured,
          ...safeCleaned,
          ui_post_type: postType,
        };
      } else {
        // Switched to a non-UI type: drop stale ui_post_type marker
        const { ui_post_type: _drop, ...rest } = existingStructured;
        mergedStructured = { ...rest, ...safeCleaned };
      }

      // Stale-clear: if user removed the location chip during edit, drop the
      // key from merged output (don't store as null forever).
      if (!locationPayload && mergedStructured && 'location' in mergedStructured) {
        delete mergedStructured.location;
      }

      // Normalize: empty object → null so the column doesn't store {}
      if (mergedStructured && Object.keys(mergedStructured).length === 0) {
        mergedStructured = null;
      }

      // Map UI-only post types to a valid DB enum value.
      const dbPostType = mapPostTypeToDatabase(postType || 'story');

      const basePostData: Record<string, any> = {
        title: title.trim() || null,
        content,
        media: mediaToSave,
        visibility: dbVisibility,
        post_type: dbPostType,
        tags: tags,
      };

      // Always set structured_fields explicitly so edits can also CLEAR them
      // (sending null when empty rather than omitting from the payload).
      basePostData.structured_fields = mergedStructured;

      if (cleanedStructured) {
        analytics.track('post_structured_fields_used', {
          has_pros: !!cleanedStructured.what_worked,
          has_cons: !!cleanedStructured.what_didnt,
          has_duration: !!cleanedStructured.duration,
          has_good_for: !!cleanedStructured.good_for,
          has_reuse: !!cleanedStructured.reuse_intent,
        });
      }

      if (postType && postType !== 'story') {
        analytics.track('post_type_selected', { post_type: postType });
      }

      // ====== EDIT MODE BRANCH ======
      if (isEditMode && postToEdit) {
        // Note: last_edited_at is stamped server-side by the
        // enforce_post_edit_window trigger — only on meaningful changes.
        // Same trigger enforces the 1h window + admin bypass.
        const { data: updatedPost, error } = await supabase
          .from('posts')
          .update(basePostData as any)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        // Replace entity relationships: delete-then-insert
        await supabase
          .from('post_entities')
          .delete()
          .eq('post_id', postToEdit.id);

        if (entities.length > 0) {
          for (const entity of entities) {
            const { error: entityError } = await supabase
              .from('post_entities')
              .insert({ post_id: postToEdit.id, entity_id: entity.id });
            if (entityError) console.error('Error saving entity relationship:', entityError);
          }
        }

        // Hashtags: always call updatePostHashtags so removing tags clears them
        const { all: detectedTagsEdit, source: hashtagSourceEdit } = extractHashtagsDetailed(title, content);
        const editPayload = Array.from(
          new Map(
            detectedTagsEdit
              .map(t => ({ original: t, normalized: normalizeHashtag(t) }))
              .filter(p => p.normalized.length > 0 && p.normalized.length <= 50)
              .map(p => [p.normalized, p])
          ).values()
        );

        try {
          const ok = await updatePostHashtags(postToEdit.id, editPayload);
          if (!ok) throw new Error('updatePostHashtags returned false');
        } catch (err: any) {
          console.error('Hashtag update failed (non-blocking):', err);
          analytics.track('post_hashtag_link_failed', {
            source: 'edit',
            tag_count: editPayload.length,
            error_code: err?.code || err?.message || 'unknown',
          });
          toast({
            title: "Tags couldn't be saved",
            description: 'You can edit your post to add them again.',
          });
        }

        analytics.track('post_hashtags_extracted', {
          source: 'edit',
          count: editPayload.length,
          has_hashtags: editPayload.length > 0,
          hashtag_source: hashtagSourceEdit,
        });

        // -------- Guard C: only refresh feeds when something actually changed.
        // Compare cleaned user input vs cleaned existing — not merged vs existing
        // — so adding/removing the ui_post_type marker alone doesn't trigger a
        // false refresh.
        const cleanedExisting = cleanStructuredFields(
          (postToEdit?.structured_fields as Record<string, any>) ?? {}
        ) ?? {};
        const cleanedNow = cleanStructuredFields({
          what_worked: whatWorked,
          what_didnt: whatDidnt,
          duration: duration || undefined,
          good_for: goodFor,
          reuse_intent: reuseIntent || undefined,
        }) ?? {};
        const hasStructuredChanged =
          JSON.stringify(cleanedNow) !== JSON.stringify(cleanedExisting);

        const hasChanged =
          (title.trim() || null) !== (postToEdit.title ?? null) ||
          content !== (postToEdit.content ?? '') ||
          dbPostType !== (postToEdit.post_type ?? 'story') ||
          hasStructuredChanged;

        if (hasChanged) {
          queryClient.invalidateQueries({ queryKey: ['infinite-feed'], exact: false });
          window.dispatchEvent(new CustomEvent('refresh-feed'));
          window.dispatchEvent(new CustomEvent('refresh-posts', {
            detail: { entityId: entities[0]?.id }
          }));
          window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
        }

        try {
          playSound('/sounds/post.wav');
        } catch (err) {
          console.error('Sound playback failed:', err);
        }
        // Visual fallback pulse — fires regardless of audio outcome
        setSubmitPulse(true);
        setTimeout(() => setSubmitPulse(false), 220);

        toast({
          title: 'Post updated',
          description: 'Your changes have been saved.',
        });

        onSuccess();
        return;
      }

      // ====== CREATE MODE BRANCH ======
      const createPayload = {
        ...basePostData,
        user_id: user.id,
      };

      console.log('Submitting post:', createPayload);

      const { data: newPost, error } = await supabase
        .from('posts')
        .insert(createPayload as any)
        .select()
        .single();

      if (error) throw error;

      console.log('Post created:', newPost);

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

        queryClient.setQueriesData(
          { queryKey: ['infinite-feed'] },
          updateFeedCache
        );
      } catch (e) {
        console.warn('Optimistic update failed, relying on invalidation', e);
      }

      queryClient.invalidateQueries({ queryKey: ['infinite-feed'], exact: false });

      const refreshEntityId = entities[0]?.id;
      if (refreshEntityId) {
        window.dispatchEvent(new CustomEvent('refresh-posts', {
          detail: { entityId: refreshEntityId }
        }));
      }
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));

      try {
        playSound('/sounds/post.wav');
      } catch (err) {
        console.error('Sound playback failed:', err);
      }
      // Visual fallback pulse — fires regardless of audio outcome
      setSubmitPulse(true);
      setTimeout(() => setSubmitPulse(false), 220);

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
      clearDraft();
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

  // Emoji picker rendered as a slot inside the bottom bar (parent owns cursor logic)
  const emojiPickerNode = emojiPickerVisible && !showLocationInput ? (
    <div
      ref={emojiPickerRef}
      className="absolute z-50 bottom-full mb-2 left-0 emoji-picker-wrapper"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onKeyDown={(e) => { e.stopPropagation(); }}
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
  ) : null;

  return (
    <div
      ref={formRef}
      className={cn(
        'flex flex-col min-h-[100dvh] bg-background transition-all',
        showLocationInput && 'location-search-active'
      )}
    >
      {/* Sticky top bar — X (with dirty-guard) + Post */}
      <ComposerTopBar
        onClose={handleCloseRequest}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isPostDisabled={isPostButtonDisabled || showLocationInput}
        isEditMode={isEditMode}
        submitPulse={submitPulse}
      />

      {/* Scrollable composer surface — no card wrapper */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-5 md:pt-10 space-y-4">
        {/* Desktop-only page header — gives the centered column a clear anchor */}
        <h1 className="hidden md:block text-2xl font-semibold tracking-tight">
          {isEditMode ? 'Edit your experience' : 'Share an experience'}
        </h1>

        {/* Hero entity pill */}
        <EntityHeroPill
          entities={entities}
          onOpenSelector={() => {
            setSelectorPrefillQuery('');
            setEntitySelectorVisible(true);
            setEmojiPickerVisible(false);
            setShowLocationInput(false);
          }}
          onRemoveEntity={removeEntity}
        />

        {/* Title — large, borderless */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title (optional)"
          maxLength={120}
          aria-label="Post title"
          className="text-2xl font-semibold border-none outline-none bg-transparent w-full placeholder:text-muted-foreground/40"
        />

        {/* Body */}
        <Textarea
          ref={textareaRef}
          placeholder={getPlaceholderForType(postType)}
          value={content}
          onChange={(e) => {
            const newContent = e.target.value;
            setContent(newContent);

            // Check for @ mention trigger (preserved verbatim)
            const textarea = e.target;
            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = newContent.substring(0, cursorPos);
            const mentionMatch = textBeforeCursor.match(/(^|\s)@(\w*)$/);

            if (mentionMatch) {
              const mentionText = mentionMatch[2];
              setSelectorPrefillQuery(mentionText);
              setEntitySelectorVisible(true);
              setEmojiPickerVisible(false);
              setShowLocationInput(false);
            }
          }}
          className="min-h-[140px] resize-none border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60"
          onClick={saveCursorPosition}
          onKeyUp={saveCursorPosition}
          onFocus={saveCursorPosition}
        />
        <p className="text-xs text-muted-foreground/60 -mt-2">
          What worked? · What didn't? · Who is this useful for?
        </p>

        {/* Detected hashtags chip row (visible inline per refinement) */}
        {detectedHashtagsForChips.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Tags</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {detectedHashtagsForChips.map((tag) => (
                <Badge key={tag} variant="secondary" className="shrink-0 font-normal">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested hashtags chip row (clickable) */}
        {suggestedHashtags.length > 0 && (
          <div className="space-y-1.5">
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

        {/* Post type & tags pill */}
        <div className="flex flex-wrap items-center gap-2">
          <PostTypeAndTagsPill
            postType={postType}
            tagCount={detectedHashtagsForChips.length}
            onOpen={() => setPostTypeTagsOpen(true)}
          />
        </div>

        {/* Add details — collapsible structured fields (verbatim) */}
        <Collapsible
          open={structuredOpen}
          onOpenChange={(open) => {
            setStructuredOpen(open);
            if (open) {
              setTimeout(() => whatWorkedRef.current?.focus(), 100);
            }
          }}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', structuredOpen && 'rotate-180')} />
              Add details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">What worked?</label>
              <Textarea
                ref={whatWorkedRef}
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                onBlur={() => setWhatWorked((prev) => prev.trim().replace(/\s{2,}/g, ' '))}
                placeholder="The best part was..."
                maxLength={500}
                className="min-h-[60px] resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{whatWorked.length}/500</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">What didn't work?</label>
              <Textarea
                value={whatDidnt}
                onChange={(e) => setWhatDidnt(e.target.value)}
                onBlur={() => setWhatDidnt((prev) => prev.trim().replace(/\s{2,}/g, ' '))}
                placeholder="I wish it had..."
                maxLength={500}
                className="min-h-[60px] resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{whatDidnt.length}/500</p>
            </div>

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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Good for</label>
              <input
                type="text"
                value={goodFor}
                onChange={(e) => setGoodFor(e.target.value)}
                onBlur={() => setGoodFor((prev) => prev.trim().replace(/\s{2,}/g, ' '))}
                placeholder="e.g. Dry skin, Beginners, Date night"
                maxLength={300}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5">{goodFor.length}/300</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Would you use it again?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReuseIntent(reuseIntent === 'yes' ? '' : 'yes')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors',
                    reuseIntent === 'yes'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  Yes, I'd use it again
                </button>
                <button
                  type="button"
                  onClick={() => setReuseIntent(reuseIntent === 'no' ? '' : 'no')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs border transition-colors',
                    reuseIntent === 'no'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  No, I wouldn't
                </button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Media preview */}
        {media.length > 0 && (
          <TwitterStyleMediaPreview media={media} onRemove={removeMedia} />
        )}

        {/* Location chip */}
        {location && (
          <div className="flex items-center gap-1">
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
                aria-label="Remove location"
              >
                <X size={10} />
              </Button>
            </Badge>
            {location.address && (
              <span className="text-xs text-muted-foreground">{location.address}</span>
            )}
          </div>
        )}

        {/* Inline location search */}
        {showLocationInput && !location && (
          <div className="animate-fade-in location-search-wrapper">
            <LocationSearchInput
              onLocationSelect={(selectedLocation) => {
                setLocation(selectedLocation);
                setShowLocationInput(false);
              }}
              onClear={() => setShowLocationInput(false)}
            />
          </div>
        )}

        {/* Desktop-only inline footer — toolbar + visibility + Post anchored to content column */}
        <div className="hidden md:flex items-center justify-between gap-2 border-t border-border pt-3 mt-4">
          <div className="flex items-center gap-1">
            <MediaUploader
              sessionId={sessionId}
              onMediaUploaded={handleMediaUpload}
              initialMedia={media}
              maxMediaCount={MAX_MEDIA_COUNT}
              customButton={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'rounded-full p-2 hover:bg-accent hover:text-accent-foreground',
                    media.length >= MAX_MEDIA_COUNT && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={media.length >= MAX_MEDIA_COUNT}
                  aria-label="Add media"
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

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'rounded-full p-2 hover:bg-accent hover:text-accent-foreground',
                  emojiPickerVisible && 'bg-accent/50 text-accent-foreground'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  saveCursorPosition();
                  setEmojiPickerVisible(!emojiPickerVisible);
                  if (!emojiPickerVisible) setShowLocationInput(false);
                }}
                aria-label="Insert emoji"
              >
                <Smile className="h-5 w-5" />
              </Button>
              {emojiPickerNode}
            </div>

            <MoreToolsPopover
              onOpenLocation={() => {
                setShowLocationInput((prev) => !prev);
                setEmojiPickerVisible(false);
                setEntitySelectorVisible(false);
              }}
              locationActive={showLocationInput}
              disabled={showLocationInput}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={visibility} onValueChange={(v: VisibilityOption) => setVisibility(v)}>
              <SelectTrigger
                className="h-9 w-auto gap-1.5 rounded-full border border-border bg-background px-3 text-xs"
                aria-label="Change visibility"
              >
                <SelectValue>
                  <div className="flex items-center gap-1.5">
                    {visibility === 'private' ? (
                      <Lock className="h-4 w-4" />
                    ) : visibility === 'circle' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    <span>
                      {visibility === 'public'
                        ? 'Public'
                        : visibility === 'private'
                        ? 'Only Me'
                        : 'Circle Only'}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
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
              type="button"
              variant="ghost"
              onClick={handleCloseRequest}
              disabled={isSubmitting}
              className="rounded-full px-4 h-9"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPostButtonDisabled || showLocationInput}
              className={cn(
                'bg-brand-orange hover:bg-brand-orange/90 text-white rounded-full px-5 h-9 transition-all',
                submitPulse && 'scale-95 opacity-80'
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" />
                  <span>{isEditMode ? 'Updating…' : 'Posting…'}</span>
                </div>
              ) : (
                <span>{isEditMode ? 'Update' : 'Post'}</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <ComposerBottomBar
        sessionId={sessionId}
        media={media}
        maxMediaCount={MAX_MEDIA_COUNT}
        onMediaUploaded={handleMediaUpload}
        emojiPickerVisible={emojiPickerVisible}
        onToggleEmojiPicker={(e) => {
          e.stopPropagation();
          e.preventDefault();
          saveCursorPosition();
          setEmojiPickerVisible(!emojiPickerVisible);
          if (!emojiPickerVisible) setShowLocationInput(false);
        }}
        visibility={visibility}
        onVisibilityChange={(v) => setVisibility(v)}
        onOpenLocation={() => {
          setShowLocationInput((prev) => !prev);
          setEmojiPickerVisible(false);
          setEntitySelectorVisible(false);
        }}
        locationActive={showLocationInput}
        disabled={showLocationInput}
        emojiPickerSlot={emojiPickerNode}
      />

      {/* Modals */}
      <EntitySelectorModal
        open={entitySelectorVisible}
        onOpenChange={(open) => {
          setEntitySelectorVisible(open);
          if (!open) setSelectorPrefillQuery('');
        }}
        initialEntities={entities}
        initialQuery={selectorPrefillQuery}
        onEntitiesChange={handleEntitiesChange}
        onMentionInsert={(username) => {
          const sanitized = username.replace(/[^a-z0-9._]/gi, '');
          if (!sanitized) return;
          const mentionText = `@${sanitized} `;

          const liveCursor = textareaRef.current?.selectionStart ?? cursorPosition.start;
          const result = replaceAtTrigger(content, liveCursor, mentionText);

          let newContent: string;
          let newCursorPos: number;

          if (result) {
            newContent = result.newContent;
            newCursorPos = result.newCursorPos;
          } else {
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

      <PostTypeAndTagsModal
        open={postTypeTagsOpen}
        onOpenChange={setPostTypeTagsOpen}
        postType={postType}
        setPostType={setPostType}
        detectedHashtags={detectedHashtagsForChips}
        suggestedHashtags={suggestedHashtags}
        onSuggestedHashtagClick={handleSuggestedHashtagClick}
      />

      <DiscardDraftDialog
        open={discardDialogOpen}
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardDialogOpen(false)}
      />
    </div>
  );
}
