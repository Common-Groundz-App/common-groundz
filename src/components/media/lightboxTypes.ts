/**
 * Transient view-only extras carried alongside VideoHandoff from a feed
 * video to LightboxPreview. NOT part of the shared media domain types —
 * this is purely a UI bridge for the exact-frame handoff poster and is
 * dropped as soon as the lightbox closes.
 */
export interface LightboxEntryExtras {
  /**
   * A best-effort JPEG dataURL snapshot of the feed <video>'s current
   * visible frame at the moment the user tapped. Used as a temporary
   * cover poster in the lightbox until the real <video> is ready.
   */
  entryPosterDataUrl?: string;
}
