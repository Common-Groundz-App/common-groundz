

# Reduce Sidebar Hero Image Height

## Change
In `src/components/content/PostDetailSidebar.tsx`, change `h-32` (128px) to `h-20` (80px) in two places:

1. **Line 64** — the actual hero image container: `h-32` → `h-20`
2. **Line 392** — the loading skeleton: `h-32` → `h-20`

No other changes needed.

