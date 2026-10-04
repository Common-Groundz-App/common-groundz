# Keep review Edit explanations beside the menu

## Change

- Put the Edit explanation beside its row on phones again, rather than above the menu actions. Keep the desktop side placement.
- Wrap the explanation into multiple lines within the available side space, with a small gap from the Edit row and safe margins at the screen edges. Do not let it cover Add timeline update, Edit, or Delete; if a very narrow screen cannot fit it on the left, use the other side instead of placing it over the actions.
- Apply this only to the review owner menu and latest timeline-update menu through their shared Edit explanation. Leave the menu size, wording, enabled/expired/admin behavior, and post tooltips unchanged.

## Technical details

- Change the shared `ReviewEditTooltipContent` side/width behavior, retaining its portal and current hover, keyboard, and tap triggers. Size against the space beside the Edit row rather than only against the whole viewport; keep collision padding and readable wrapping.
- Update focused placement tests for enabled and expired Edit. Visually check phone and desktop placements, including keyboard and tap, to confirm the text stays on screen without covering neighboring actions. Do not write production review data.
