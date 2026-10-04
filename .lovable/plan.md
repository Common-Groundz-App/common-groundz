# Keep Edit explanations on screen on mobile

## Change

- Fix only the one-hour Edit explanations in review and latest timeline-update three-dot menus. In the screenshot, the explanation extends past the left edge of the phone; the review cards and menus themselves stay the same size.
- On narrow screens, position the explanation above and centered on its Edit row instead of to its left. Cap its width at roughly `calc(100vw - 24px)`, allow readable wrapping, and keep at least 12px from either screen edge. Keep the current left-side placement on wider screens.
- Render these explanations outside the menu's clipped content so their placement is not cut off. Make this opt-in for these two menus; do not change every tooltip or the post menu.
- Keep the enabled/expired/admin/latest-only rules, exact copy, Add timeline update, Delete, and one-hour enforcement unchanged.

## Technical details

- Apply a local Radix tooltip portal around the existing `TooltipContent` in `ReviewOwnerMenu` and `ReviewTimelineViewer`; set mobile side to top with centered alignment, collision padding of at least 12px, and sufficient layering above the menu. Preserve hover, keyboard focus, and tap access.
- Check the narrow-screen menu from the attached example and the latest-update menu for both enabled and expired Edit. Verify the full text remains visible within a phone viewport and neither menu closes unexpectedly; check desktop placement and focused/tapped behavior too. Run focused tests without writing production review data.
