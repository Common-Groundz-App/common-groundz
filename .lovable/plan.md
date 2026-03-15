

# Footer Refinements

The desktop layout looks solid. Two changes needed:

## 1. Left-align logo on mobile
Currently `items-center` on the outer flex causes centering on mobile. Change to `items-start md:items-center` so the logo sits left on small screens while staying centered in the flex row on desktop.

Also change the inner right-side group from `items-center` to `items-start md:items-center` for consistent left-alignment on mobile.

And the copyright row: change `text-center md:text-left` to just `text-left`.

## 2. Update copyright year
The screenshots show 2025 but it's now 2026 — update to `© 2026`.

## Changes: `src/components/Footer.tsx`
- Line 10: `flex-col md:flex-row items-center` → `flex-col md:flex-row items-start md:items-center`
- Line 12: `flex-col md:flex-row items-center` → `flex-col md:flex-row items-start md:items-center`
- Line 33: `text-center md:text-left` → `text-left`
- Line 34: `© 2025` → `© 2026`

Single file change, minimal diff.

