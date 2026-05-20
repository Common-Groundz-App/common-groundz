import type { MediaItem } from '@/types/media';

/**
 * Phase 2A fixtures — used by renderer tests and ad-hoc visual checks to
 * verify the Mux preparing/errored guard fires before any upload routing
 * code exists. Do not import outside tests.
 */

export const mockMuxPreparingMediaItem: MediaItem = {
  id: 'mux-fixture-preparing',
  type: 'video',
  url: 'https://image.mux.com/fixture/thumbnail.jpg',
  thumbnail_url: 'https://image.mux.com/fixture/thumbnail.jpg',
  order: 0,
  provider: 'mux',
  mux_upload_id: 'upload_fixture_preparing',
  mux_status: 'preparing',
  width: 1080,
  height: 1920,
  duration: 12,
  orientation: 'portrait',
};

export const mockMuxErroredMediaItem: MediaItem = {
  id: 'mux-fixture-errored',
  type: 'video',
  url: 'https://image.mux.com/fixture/thumbnail.jpg',
  thumbnail_url: 'https://image.mux.com/fixture/thumbnail.jpg',
  order: 0,
  provider: 'mux',
  mux_upload_id: 'upload_fixture_errored',
  mux_status: 'errored',
  mux_error: 'asset_create_failed',
  width: 1080,
  height: 1920,
  duration: 0,
  orientation: 'portrait',
};

export const mockMuxReadyMediaItem: MediaItem = {
  id: 'mux-fixture-ready',
  type: 'video',
  url: 'https://image.mux.com/fixture/thumbnail.jpg',
  thumbnail_url: 'https://image.mux.com/fixture/thumbnail.jpg',
  order: 0,
  provider: 'mux',
  mux_upload_id: 'upload_fixture_ready',
  mux_asset_id: 'asset_fixture_ready',
  mux_playback_id: 'playback_fixture_ready',
  mux_status: 'ready',
  width: 1080,
  height: 1920,
  duration: 12,
  orientation: 'portrait',
};
