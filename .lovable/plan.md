## Scope
`src/components/media/LightboxPreview.tsx` only.

## Changes

1. **Safer CSS width calc (Codex suggestion)**
   - Change `const maxVh = isMobile && isLandscape ? '85vh' : '90vh';` to `const maxVh = isMobile && isLandscape ? 85 : 90;` (number, not string).
   - Update `width` to ``min(100%, calc(${maxVh}vh * ${ratio}))``.
   - Update `maxHeight` to ``${maxVh}vh``.
   - This avoids relying on string-based CSS values inside inline `calc()`.

2. **Remove DEV breadcrumbs permanently**
   - Delete the `dbg()` helper and all its call sites:
     - `dbg('hlsAttached', ...)`
     - `dbg('loadedmetadata', ...)`
     - `dbg('seekApplied', ...)`
     - `dbg('seeked', ...)`
     - `dbg('playRequested', ...)`
     - `dbg('videoReady=true', ...)` (both call sites)
   - Remove the `eslint-disable-next-line no-console` comment associated with `dbg`.

No other files change.