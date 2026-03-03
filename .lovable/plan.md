

# Fix Lovable Branding + Dynamic OG Images — Final Plan

Agreed — using `LEGAL_CONFIG.websiteUrl` instead of hardcoding the domain is the right call. It's already the single source of truth for `EntityStructuredData.tsx`, so `SEOHead.tsx` should follow the same pattern.

---

## Changes (6 files)

### 1. `index.html` — Replace Lovable branding

- `author`: `Lovable` → `Common Groundz`
- `og:image`: → `https://commongroundz.co/og-default.png`
- `twitter:site`: `@lovable_dev` → `@commongroundzHQ`
- `twitter:image`: → `https://commongroundz.co/og-default.png`
- `twitter:card`: keep `summary_large_image`
- Favicon: `/public/lovable-uploads/5bb5...png` → `/lovable-uploads/5bb5...png`

### 2. `src/components/seo/SEOHead.tsx` — Defaults + absolute URL helper

- Import `LEGAL_CONFIG` and use `LEGAL_CONFIG.websiteUrl` as `baseUrl`
- Update `twitterSite` → `@commongroundzHQ`
- Update default `image` → `${baseUrl}/og-default.png`
- Change `twitter:card` → `summary_large_image`
- Add `ensureAbsoluteUrl` helper using `baseUrl`:
  ```ts
  const ensureAbsoluteUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  ```
- Apply it to the resolved image before rendering OG/Twitter meta tags

### 3. `src/pages/PostView.tsx`

- Add `imageUrl?: string` to `PostMeta` interface
- Pass `image={postMeta?.imageUrl}` to `<SEOHead>`

### 4. `src/components/content/PostContentViewer.tsx` (line ~128)

- Add to the `onPostLoaded` callback: `imageUrl: data.media?.[0]?.url || undefined`

### 5. `src/pages/RecommendationView.tsx`

- Add `imageUrl?: string` to `RecommendationMeta` interface
- Pass `image={recMeta?.imageUrl}` to `<SEOHead>`

### 6. `src/components/content/RecommendationContentViewer.tsx` (line ~120)

- Add to the `onRecommendationLoaded` callback: `imageUrl: data.image_url || entity?.image_url || undefined`

---

## Asset needed

You must provide a **1200x630** branded image for `public/og-default.png`. Until then, references will point to the correct URL but the file won't exist yet.

## Not changed

Entity pages, profile pages, `EntityStructuredData.tsx`, routing, database, RLS — all untouched.

