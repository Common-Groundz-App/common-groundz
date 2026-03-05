

# Add Missing OG Tags to Static HTML + Image Dimensions

## Why
- `og:url`, `og:site_name`, and `og:image:width/height` are missing from `index.html` (the static fallback for non-JS crawlers)
- `og:image:width/height` is missing from `SEOHead.tsx` too — LinkedIn/Slack render previews faster with explicit dimensions
- `SEOHead.tsx` already handles `og:site_name`, `og:url`, and `og:type` dynamically, so those only need adding to the static shell

## Changes (2 files)

### 1. `index.html` — Add 4 missing OG tags
After the existing `og:image` line, add:
- `og:image:width` = `1200`
- `og:image:height` = `630`
- `og:url` = `https://commongroundz.co`
- `og:site_name` = `Common Groundz`

### 2. `src/components/seo/SEOHead.tsx` — Add image dimensions
After the `og:image` meta tag (line 56), add:
- `og:image:width` = `1200`
- `og:image:height` = `630`

## Not changed
- Favicon path (works fine as-is, cosmetic cleanup can happen later)
- Everything else untouched

