# Group 6E: entity page tab cards

## 6D audit result
6D is complete, with no leftovers. All twelve admin entity picture spots, including the two addendum fixes, are on the shared rules. The only admin screens still using the old picture helper are the three approved "judge the picture" screens, which are left untouched on purpose: image candidates, auto-fill preview and the create-search rows. Tests pass (836) and the build is clean.

## What changes (6E)
Entity page, in the tab that lists child items (each card has a picture area on top):
- **No link** (null, empty or only spaces): no picture area is drawn, same as today. Card height is unchanged.
- **Real picture:** unchanged, with the same size and crop.
- **Picture link present but it fails to load:** the existing area stays, and only its contents switch to the type icon. No stock photo, no second request.
- **Old stock placeholder:** the same icon inside the existing area.
- **Unknown type:** neutral icon.
- **Switching entities:** a broken state never carries over to another child.

These are recorded as intentional "no picture area" exceptions, with no code change: the My Stuff item card and the entity products card.

Nothing else on the card changes: grid, text, badge, hover shadow and click all stay as they are. **Stop** after 6E, before the post-6 cleanup.

## Technical details
- In `src/components/entity-v4/EntityTabsContent.tsx`, normalise the link once and use that same value for both the check and the source:

```tsx
const imageUrl = child.image_url?.trim();

{imageUrl && (
  <div className="w-full h-32 rounded-md overflow-hidden bg-muted mb-3">
    <EntityCollectionImage
      source={{ id: child.id, image_url: imageUrl }}
      type={child.type}
      name={child.name}
      imageClassName="w-full h-full object-cover"
      iconClassName="h-10 w-10"
    />
  </div>
)}
```

  Passing only `{ id, image_url }` keeps raw `image_url` precedence. The shared hook keys failure on id plus link, so a new child or a new link clears the broken state.
- The `ImageWithFallback` import is removed. `getEntityTypeFallbackImage` is dropped from the import, and `getEntityTypeLabel` is kept.
- A new test file `src/components/entity-v4/group6eTabCards.test.tsx` is registered in vitest.config.ts. Tests:
  - Null → no wrapper
  - Empty → no wrapper
  - Whitespace-only → no wrapper
  - A valid link with spaces around it → renders the trimmed link
  - A valid real link → unchanged src and classes
  - A broken link → icon, with no second request
  - A registered legacy placeholder → icon
  - A legitimate, unregistered Unsplash link → real image (not treated as missing)
  - Unknown type → neutral icon
  - A different child after a failure → its real image shows
  - The same child ID with a new link after a failure → the real image shows
  - A stored metadata photo never overrides the raw `image_url`
  - No /placeholder.svg and no newly introduced remote fallback in the output
- Checks: the full suite, tsgo, focused lint and the build log. Then the inventory, the roadmap and `docs/verification/group-6e-tab-cards.md`.
- Out of scope: ImageWithFallback globally, the stock helpers, getOptimalEntityImageUrl, the database, and MyStuffItemCard / EntityProductsCard.
