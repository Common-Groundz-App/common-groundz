

# Footer Social Links — Plan

Looking at the existing `Footer.tsx` code, both of ChatGPT's suggestions are **already implemented**:

1. **aria-labels** — already present (`aria-label="Twitter"`, `aria-label="Instagram"`, `aria-label="LinkedIn"`)
2. **hover transitions** — already present (`text-muted-foreground hover:text-foreground transition-colors`)

So those aren't new changes. The only real change needed is updating the `href` values and adding `target="_blank" rel="noopener noreferrer"`.

One minor improvement: update the aria-labels to be more descriptive (e.g., "Common Groundz on X" instead of just "Twitter").

## Changes — `src/components/Footer.tsx`

Update the three social icon `<a>` tags:

| Icon | href | aria-label |
|------|------|------------|
| Twitter | `https://x.com/commongroundzHQ` | `Common Groundz on X` |
| Instagram | `https://www.instagram.com/thecommongroundz` | `Common Groundz on Instagram` |
| LinkedIn | `https://www.linkedin.com/company/common-groundz` | `Common Groundz on LinkedIn` |

All three get `target="_blank" rel="noopener noreferrer"`. That's it — everything else in the footer is already correct.

