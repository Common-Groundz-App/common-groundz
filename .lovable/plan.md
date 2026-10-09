# New Afnan review: photo check (read-only, nothing changed)

## Result: everything worked as intended

**Choosing 6 photos:** only 4 were uploaded. The 2 extra photos were turned away before they left your device, so nothing needs deleting. The review's folder has exactly 4 files.

**Editing and removing 2:** the edit saved. The review now has 2 photos ("supabase error" and "incognito"). The 2 you removed are still in storage, and both are on the server's cleanup list (queued). They aren't orphans. They'll be deleted once cleanup is switched on.

**Earlier, deleted review:** its 4 photos are also queued, not orphaned.

So 6 photos are waiting for cleanup, and every one of them is tracked.

## Next step (separate approval)
Switch cleanup on for one controlled run. Then confirm that the 6 queued files are gone and that the 2 photos on the current review still load. Cleanup is turned off again afterwards unless you decide otherwise.
