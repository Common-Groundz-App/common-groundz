## Verification

Checked `src/components/media/FeedVideo.tsx` line 476. The class is currently:

`absolute inset-x-0 bottom-1 [@media(pointer:coarse)]:bottom-4 z-20 pointer-events-none`

So `bottom-4` is still in the code — the revert hasn't taken effect on disk yet.

## Change

Revert that one line back to the previous working value:

`absolute inset-x-0 bottom-1 [@media(pointer:coarse)]:bottom-3 z-20 pointer-events-none`

Nothing else will be touched.

## Scope

- Only `src/components/media/FeedVideo.tsx`, only line 476.
- No changes to FeedCollage, dimensions, object-fit, interaction logic, or any other component.

## Note on "affected all videos"

`FeedVideo` is the shared component used for both single videos and collage video cells, which is why the inset change applied everywhere. Reverting to `bottom-3` restores the previously working state for all of them. We can revisit a portrait-only solution in a follow-up if you want — but not in this step.
