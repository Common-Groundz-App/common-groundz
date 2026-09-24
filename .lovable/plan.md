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
- In `src/components/entity-v4/EntityTabsContent.tsx`, the guard becomes `child.image_url?.trim() &&`, and the `w-full h-32 rounded-md overflow-hidden bg-muted mb-3` wrapper is kept.
- Inside that wrapper: `<EntityCollectionImage key={child.id} source={{ id: child.id, image_url: child.image_url }} type={child.type} name={child.name} imageClassName="w-full h-full object-cover" iconClassName="h-10 w-10" />`. This keeps raw `image_url` precedence.
- The `ImageWithFallback` import is removed. `getEntityTypeFallbackImage` is dropped from the import, and `getEntityTypeLabel` is kept.
- A new test file `src/components/entity-v4/group6eTabCards.test.tsx` is registered in vitest.config.ts. It covers:
  - null, empty and whitespace links render no wrapper;
  - a real picture keeps the exact src and classes;
  - a broken picture keeps the wrapper and shows the icon, with no second src;
  - a registered placeholder shows the icon;
  - an unknown type shows the neutral icon;
  - no /placeholder.svg or stock link appears in the output;
  - a stored metadata photo never overrides `image_url`.
- Checks: the full suite, tsgo, focused lint and the build log. Then the inventory, the roadmap and `docs/verification/group-6e-tab-cards.md`.
- Out of scope: ImageWithFallback globally, the stock helpers, getOptimalEntityImageUrl, the database, and MyStuffItemCard / EntityProductsCard.
