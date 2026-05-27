## Plan: Gate HLS diagnostics behind URL flag `?hlsdebug=1`

Scope: **`src/utils/hlsAttach.ts` only.** No other files. No HLS config, playback, prewarm, lightbox, or handoff changes.

### Change

Add a module-level constant computed once:

```ts
const HLS_DEBUG =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hlsdebug') === '1');
```

Wrapped in `try/catch` defensively (SSR / sandboxed iframe safety).

### Replace every `if (import.meta.env.DEV)` inside `attachHls` with `if (HLS_DEBUG)`

Specifically the existing blocks at:
- The construct block (`__muxHlsLive` counter + `[hls][construct]` log + `MANIFEST_PARSED` / `LEVEL_SWITCHING` / `LEVEL_SWITCHED` / `FRAG_LOADED` handlers)
- The fatal-error decrement block
- The cleanup decrement block

All existing log prefixes (`[hls][construct]`, `[hls][manifest_parsed]`, `[hls][level_switching]`, `[hls][level_switched]`, `[hls][frag_loaded]`) remain exactly as-is so the user can filter by `[hls]` in Console.

### What does NOT change

- Hls.js constructor config (`capLevelToPlayerSize`, `abrEwmaDefaultEstimate`, `testBandwidth`, etc.) — untouched
- Native HLS path — untouched
- Error / unrecoverable handling — untouched
- `prewarmMuxHls.ts`, `FeedVideo.tsx`, posters, prewarm bridge, lightbox handoff, DB, composer — untouched

### How user will use it

1. After deploy, open `https://common-groundz.lovable.app/home?hlsdebug=1` (or the id-preview URL with same query)
2. Open DevTools → Console → enable **Verbose**, filter `[hls]`
3. Play a Mux video, then replay it
4. Share the `[hls][...]` log lines

### Reverting

After diagnosis, the gate flips back to `import.meta.env.DEV` only (single-line edit in the same file).
