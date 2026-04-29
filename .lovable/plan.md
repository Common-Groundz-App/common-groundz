# Step 3 — Identity Row Cleanup + Desktop Page Header

Building on Step 2's content-anchored desktop / action-anchored mobile split. This step removes redundant identity UI and gives the desktop composer a proper page anchor — matching Reddit's principle (not its exact text).

## What changes

### 1. Remove the "Hana Li" identity row everywhere
- Currently rendered above the `Select entities` pill in `EnhancedCreatePostForm.tsx`.
- **Desktop**: redundant — sidebar already shows `Hana Li @hana.li` with avatar at bottom-left.
- **Mobile**: no real value — user knows who they are; it's noise before the task.
- **Action**: delete the row on both breakpoints. Clean start: `X` → `Select entities` → title → body.

### 2. Add a desktop-only page header: "Share an experience"
- Renders inside the centered `max-w-2xl` content column, aligned with everything else.
- **Desktop only** (`hidden md:block`) — placed just below the inline `X` close button, above the `Select entities` pill.
- **Mobile**: no header. Sticky top bar (`X` + `Post`) already signals composer context; screen real estate is precious.
- **Copy choice**: "Share an experience" — matches the existing `Share your experience…` textarea placeholder and the platform's "experience over broadcast" voice (instead of Reddit's "Create post").
- **Style**: large, semibold, matches existing typography scale (e.g. `text-2xl font-semibold tracking-tight`). Not a giant hero — a clear page anchor.

## Layout result

```text
DESKTOP (≥md)                          MOBILE (<md)
┌────────────────────────────┐         ┌──────────────────────┐
│ [X]                        │         │ [X]            [Post]│ ← sticky
│ Share an experience        │ ← new   ├──────────────────────┤
│                            │         │ [⌖ Select entities]  │
│ [⌖ Select entities ▾]      │         │                      │
│                            │         │ Add a title…         │
│ Add a title (optional)     │         │ Share your experience│
│ Share your experience…     │         │   …                  │
│ ...                        │         │ ...                  │
│ ─────────────────────────  │         ├──────────────────────┤
│ 🖼 😊 ⋯       [Public] Post│         │ 🖼 😊 ⋯     [Public] │ ← sticky
└────────────────────────────┘         └──────────────────────┘
```

No "Hana Li" anywhere. Desktop gets a clear page identity; mobile stays minimal.

## Files touched

- `src/components/feed/EnhancedCreatePostForm.tsx` — remove the identity row block; add the desktop header `<h1 className="hidden md:block ...">Share an experience</h1>` between the inline close button and the entity pill.

That's it. No other components, no behavior changes, no prop changes. Step 2's responsive scaffolding does the heavy lifting.

## Out of scope (for later if you want)

- Drafts indicator (Reddit's "Drafts 2" link) — separate feature.
- Post-type tabs (Text / Images / Link / Poll) — your composer model is different (entity-first, not type-first), so this likely never applies.
- Any change to `profileData` plumbing — left intact in case future steps need it (e.g. avatar in submitted post metadata).
