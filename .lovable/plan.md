

# Fix: Offline Snackbar Centering — Final

## Plan

Single file change: `src/components/OfflineBanner.tsx`

For all four mobile `motion.div` containers, replace:

```
fixed left-1/2 -translate-x-1/2 bottom-[...] z-[41] min-w-[200px] max-w-[calc(100vw-2rem)] xl:hidden
```

With:

```
fixed inset-x-0 bottom-[...] z-[41] flex justify-center px-4 pointer-events-none xl:hidden
```

On the inner pill `div`, add:
- `pointer-events-auto` (so the pill remains tappable)
- `min-w-[200px] max-w-[calc(100vw-2rem)]` (moved from outer)

Both ChatGPT suggestions (`px-4` for edge padding) and Codex suggestion (`pointer-events-none/auto` for tap passthrough) are correct and trivial — adopt both. Nothing else to add.

