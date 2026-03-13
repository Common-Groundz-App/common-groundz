

# Auth Prompt Modal — Final Plan

ChatGPT's tweaks are reasonable. Here's my take:

**`h-[2px] bg-brand-orange/80` instead of `3px`** — Agree. 2px at 80% opacity is more refined for a modal. 3px risks looking like a validation/warning bar.

**`h-6` logo instead of `h-8`** — Agree. `h-8` (32px) is what we use in the navbar; inside a compact modal, `h-6` (24px) keeps better proportion.

No other changes needed. The plan is tight as-is.

## Final Changes — `src/components/auth/AuthPromptModal.tsx`

1. **Import** `useTheme` from `@/contexts/ThemeContext` for themed logo
2. **Add `2px` brand accent bar** at top of modal content (`h-[2px] bg-brand-orange/80`)
3. **Add themed logo** (`h-6 w-auto mx-auto mb-2`)
4. **Split headline** — verb phrase on line 1 (smaller), entity name on line 2 (bold) when `entityName` exists
5. **Update microcopy** for circle/trust messaging:
   - `follow` → "See what people in your circle recommend."
   - `review` → "Share your experience with people you trust."
   - `recommend` → "Help people you trust discover great things."
   - `like` → "Show your appreciation and shape recommendations."
   - `comment` → "Join the conversation with your circle."

One file, five edits.

