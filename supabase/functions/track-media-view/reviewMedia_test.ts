import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canonicalVideoIdentity, resolveReviewVideo } from './reviewMedia.ts';

const base = 'https://x.supabase.co/storage/v1/object/public';
const media = [
  { id: 'p1', type: 'image', url: `${base}/post_media/a.jpg` },
  { id: 'v1', type: 'video', provider: 'mux', mux_status: 'ready', mux_playback_id: 'PB1' },
  { id: 'v2', type: 'video', provider: 'mux', mux_status: 'preparing' },
  { id: 'v3', type: 'video', provider: 'mux', mux_status: 'errored' },
  { id: 'v4', type: 'video', url: `${base}/post_media/u/s/f.mp4?x=1` },
];

Deno.test('ready mux video resolves to playback id', () => {
  assertEquals(resolveReviewVideo(media, 'v1', 'whatever'), 'mux:PB1');
});
Deno.test('photo, processing and failed media rejected', () => {
  assertEquals(resolveReviewVideo(media, 'p1', ''), null);
  assertEquals(resolveReviewVideo(media, 'v2', ''), null);
  assertEquals(resolveReviewVideo(media, 'v3', ''), null);
});
Deno.test('unknown id rejected (no fallback to path)', () => {
  assertEquals(resolveReviewVideo(media, 'nope', 'https://stream.mux.com/PB1.m3u8'), null);
});
Deno.test('path match uses persisted canonical identity incl. bucket', () => {
  assertEquals(resolveReviewVideo(media, undefined, 'https://stream.mux.com/PB1.m3u8?foo'), 'mux:PB1');
  assertEquals(resolveReviewVideo(media, undefined, `${base}/post_media/u/s/f.mp4`), 'storage:post_media/u/s/f.mp4');
  assertEquals(resolveReviewVideo(media, undefined, `${base}/other/u/s/f.mp4`), null);
});
Deno.test('non-array media rejected', () => {
  assertEquals(resolveReviewVideo(null, 'v1', ''), null);
  assertEquals(canonicalVideoIdentity(undefined), null);
});
