

# Refined Plan: Minimal Footer Redesign

ChatGPT's three suggestions are all good calls. Here's my take on each, plus one addition:

**1. Links right-aligned, not centered — Agree.** Logo left, links + socials right is the standard product footer pattern. Centered links work for marketing pages but feel off in a product UI.

**2. Border divider — Already exists** (`border-t` is on line 6), but the `bg-muted/30` background tint makes the footer look like a separate block. Removing the background tint and keeping just `border-t border-border bg-background` will make it feel cleaner and more integrated.

**3. Smaller logo — Agree.** The footer currently uses `size="lg"` (`h-12`). Dropping to `size="sm"` (`h-8`) is the right call for a minimal footer.

**4. My addition: Drop the tagline.** In a minimal single-row footer, the tagline ("Recommendations from people you actually trust") adds clutter. The logo alone is sufficient.

## Final Layout

```text
Desktop:
─────────────────────────────────────────────────────────
[Logo sm]          Privacy · Terms · Cookies       [X] [IG] [In]
                   © 2025 Common Groundz
─────────────────────────────────────────────────────────

Mobile:
─────────────────────────────────────────────────────────
              [Logo sm]
        Privacy · Terms · Cookies
            [X]  [IG]  [In]
     © 2025 Common Groundz
─────────────────────────────────────────────────────────
```

## Changes: `src/components/Footer.tsx`

- **Remove** 4-column grid, tagline, and all placeholder `#` links (Pricing, FAQ, About, Blog, Careers)
- **Top row**: `flex justify-between items-center`
  - Left: `Logo size="sm"`
  - Right: `flex items-center gap-6` containing links (Privacy, Terms, Cookies as dot-separated) and social icons (`Twitter`, `Instagram`, `Linkedin` from lucide-react, `h-4 w-4`)
- **Bottom row**: Copyright in `text-xs text-muted-foreground`, separated by `border-t border-border mt-6 pt-6`
- **Footer wrapper**: `border-t border-border bg-background py-8` (no `bg-muted/30`)
- **Mobile**: Stack vertically with `flex-col items-center gap-4 text-center`
- **Remove** unused `Star`, `Heart` imports

## Files changed
- `src/components/Footer.tsx`

