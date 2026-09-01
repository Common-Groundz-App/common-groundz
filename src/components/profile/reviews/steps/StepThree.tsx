
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';

import { useLocation } from '@/contexts/LocationContext';
import { LocationAccessPrompt } from '@/components/profile/reviews/LocationAccessPrompt';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';
import { v4 as uuidv4 } from 'uuid';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import type { QuestionnaireConfig } from '@/components/profile/reviews/questionnaire/registry';

interface StepThreeProps {
  /** Registry config for the resolved questionnaire. */
  config: QuestionnaireConfig;
  /** Canonical type of the linked subject, when there is one. */
  subjectType: string | null;
  selectedEntity: Entity | null;
  /** Read-only provider/parent context line ("Dish at Truffles"). */
  contextLine?: string | null;
  /** Set when a linked subject has an unusable type — blocks the wizard. */
  invalidMessage?: string | null;
  /**
   * Legacy UNLINKED reviews only: the historical title/venue stay editable so
   * those rows can still be maintained. Canonical linked reviews never show
   * these inputs — identity comes from the subject.
   */
  legacyMode: boolean;
  legacyTitle: string;
  onLegacyTitleChange: (value: string) => void;
  legacyVenue: string;
  onLegacyVenueChange: (value: string) => void;
  selectedMedia: MediaItem[];
  onMediaAdd: (media: MediaItem) => void;
  onMediaRemove: (mediaUrl: string) => void;
  isUploading: boolean;
}

const StepThree = ({
  config,
  subjectType,
  selectedEntity,
  contextLine,
  invalidMessage,
  legacyMode,
  legacyTitle,
  onLegacyTitleChange,
  legacyVenue,
  onLegacyVenueChange,
  selectedMedia,
  onMediaAdd,
  onMediaRemove,
  isUploading,
}: StepThreeProps) => {
  const [processedEntity, setProcessedEntity] = useState<Entity | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const { permissionStatus, locationEnabled } = useLocation();

  // Helper function to ensure HTTPS urls
  const ensureHttps = (url: string): string => {
    if (!url) return url;
    return url.replace(/^http:\/\//i, 'https://');
  };

  // Process selected entity to ensure it has valid fields for display
  useEffect(() => {
    if (selectedEntity) {
      const processed = { ...selectedEntity };
      if (processed.image_url) {
        processed.image_url = ensureHttps(processed.image_url);
      }
      setProcessedEntity(processed);
    } else {
      setProcessedEntity(null);
    }
  }, [selectedEntity]);

  // Location prompt eligibility is registry-driven, not a hardcoded type check.
  useEffect(() => {
    const locationNotSetUp = !locationEnabled && permissionStatus !== 'granted';

    if (config.showLocationPrompt && locationNotSetUp) {
      const lastPromptTime = localStorage.getItem('locationPromptLastShown');
      const lastSkippedTime = localStorage.getItem('locationPromptLastSkipped');
      const currentTime = Date.now();

      const normalTimeout = 24 * 60 * 60 * 1000; // 24 hours
      const skippedTimeout = 2 * 60 * 60 * 1000; // 2 hours

      if (lastSkippedTime) {
        if (currentTime - parseInt(lastSkippedTime) > skippedTimeout) {
          setShowLocationPrompt(true);
        }
      } else if (!lastPromptTime || currentTime - parseInt(lastPromptTime) > normalTimeout) {
        setShowLocationPrompt(true);
      }

      if (showLocationPrompt) {
        localStorage.setItem('locationPromptLastShown', currentTime.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.showLocationPrompt, permissionStatus, locationEnabled]);

  const handleSkipLocationPrompt = () => {
    setShowLocationPrompt(false);
    localStorage.setItem('locationPromptLastSkipped', Date.now().toString());
  };

  const MAX_MEDIA_COUNT = 4;

  return (
    <div className="w-full space-y-8 py-2">
      <h2 className="text-xl font-medium text-center">
        Tell us about your {config.subjectLabel}
      </h2>

      {/* Invariant failure: a linked subject we cannot classify. */}
      {invalidMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{invalidMessage}</p>
        </div>
      )}

      {/* Location prompt — registry-driven */}
      {config.showLocationPrompt && showLocationPrompt && !invalidMessage && (
        <LocationAccessPrompt onCancel={handleSkipLocationPrompt} className="mb-8" />
      )}

      {/* Subject preview — read-only. The subject is chosen once in Step 2. */}
      {selectedEntity && processedEntity && !invalidMessage && (
        <div className="space-y-2">
          <EntityPreviewCard
            entity={processedEntity}
            type={subjectType ?? ''}
            onChange={() => {
              /* subject changes happen in Step 2 only */
            }}
            disableChange
          />
          {contextLine && <p className="text-sm text-muted-foreground">{contextLine}</p>}
        </div>
      )}

      {/*
        Legacy UNLINKED reviews keep their editable historical identity fields.
        Canonical linked reviews do not ask for a name or a venue at all.
      */}
      {legacyMode && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="legacy-title">What is this review about?</Label>
            <Input
              id="legacy-title"
              value={legacyTitle}
              onChange={(e) => onLegacyTitleChange(e.target.value)}
              placeholder="Name of what you reviewed"
              className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
            />
            {!legacyTitle && <p className="text-red-500 text-xs">This field is required</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="legacy-venue">Where was this? (optional)</Label>
            <Input
              id="legacy-venue"
              value={legacyVenue}
              onChange={(e) => onLegacyVenueChange(e.target.value)}
              placeholder="Place or context"
              className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
            />
          </div>
        </div>
      )}

      {/* Media Preview Section */}
      {selectedMedia.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            <span className="text-lg">🖼️</span>
            <span>
              Your media ({selectedMedia.length}/{MAX_MEDIA_COUNT})
            </span>
          </Label>
          <CompactMediaGrid
            media={selectedMedia}
            onRemove={(media) => onMediaRemove(media.url)}
            maxVisible={MAX_MEDIA_COUNT}
            className="group"
          />
        </div>
      )}

      {/* Media upload section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">📸</span>
          <span>Add photos & videos</span>
        </Label>
        <MediaUploader
          sessionId={uuidv4()}
          onMediaUploaded={onMediaAdd}
          initialMedia={selectedMedia}
          className="w-full"
          maxMediaCount={MAX_MEDIA_COUNT}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {selectedMedia.length > 0
            ? `${selectedMedia.length}/${MAX_MEDIA_COUNT} media items added - Add photos or videos to make your review stand out`
            : 'Add photos or videos to make your review stand out'}
        </p>
      </div>
    </div>
  );
};

export default StepThree;
