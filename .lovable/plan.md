

# Phase 5A: Entity Structured Data — Final Implementation Plan

## New File: `src/components/seo/EntityStructuredData.tsx`

### Behavior

- Import `LEGAL_CONFIG.websiteUrl` from `src/config/legalConfig.ts` as `baseUrl`
- Return `null` if `entity.name` or `entity.slug` is falsy
- Render two `<script type="application/ld+json">` blocks via Helmet

### Entity Type to Schema.org Mapping

| EntityType | @type |
|------------|-------|
| book | Book |
| movie | Movie |
| tv_show | TVSeries |
| place | LocalBusiness |
| food | Restaurant |
| product | Product |
| course | Course |
| app | SoftwareApplication |
| game | VideoGame |
| experience | TouristAttraction |
| brand | Organization |
| event | Event |
| service | Service |
| professional | Person |
| fallback | Thing |

### Block 1: Entity JSON-LD

All URLs absolute, built from `LEGAL_CONFIG.websiteUrl`:

```text
const entityUrl = `${baseUrl}/entity/${entity.slug}`;

{
  "@context": "https://schema.org",
  "@type": "<mapped type>",
  "@id": "${entityUrl}#entity",
  "name": entity.name,
  "url": entityUrl,
  "inLanguage": "en",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": entityUrl
  },
  "potentialAction": {
    "@type": "ViewAction",
    "target": entityUrl
  }
}
```

Conditional fields (omitted entirely when null/falsy -- never emitted as null):
- `"description"` -- only if `entity.description` exists
- `"image"` -- only if `entity.image_url` exists
- `"aggregateRating"` -- only if `stats.reviewCount > 0` AND `stats.averageRating` is not null (public ratings only, circle-only ratings excluded)

### Block 2: BreadcrumbList (2 levels)

```text
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${baseUrl}/" },
    { "@type": "ListItem", "position": 2, "name": entity.name }
  ]
}
```

Position 2 has no `item` property (current page).

## Modified Files

**`src/pages/EntityDetail.tsx`** -- Import EntityStructuredData, render `<EntityStructuredData entity={entity} stats={stats} />` alongside existing SEOHead inside the entity-loaded guard.

**`src/components/entity-v4/EntityV4.tsx`** -- Same pattern: import and render alongside existing SEOHead.

## What Is NOT Changed

No changes to SEOHead, routing, database, RLS, profiles, posts, recommendations, sitemap, or robots.txt.

## Post-Implementation Verification

1. Inspect entity page source for two `<script type="application/ld+json">` blocks
2. Validate with Google Rich Results Test
3. Confirm entity with 0 reviews has no `aggregateRating`
4. Confirm all URLs use `https://commongroundz.co`
5. Confirm BreadcrumbList has exactly 2 levels
6. Confirm `image` and `description` are absent when entity lacks them

