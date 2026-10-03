# Keep review Edit visible and explain the one-hour window

## Goal
Make review editing behave like the existing post menu: **Edit remains visible after the one-hour window, becomes disabled, and explains why on hover or tap**. Also explain the limit while Edit is still available.

## Changes

1. **Root review owner menu**
   - Keep **Edit** visible whenever the review has an edit action, instead of removing it after one hour.
   - During the first hour, keep Edit enabled and show: **“You can edit for 1 hour after publishing.”**
   - After one hour, disable Edit using the same menu-item pattern already used by posts and show: **“Edit window closed (1 hour limit)”**.
   - Preserve the existing admin bypass, Add timeline update, Delete, and confirmation behavior.

2. **Latest timeline update menu**
   - Apply the same enabled/disabled Edit presentation to the newest timeline update.
   - Keep older timeline updates non-editable under the existing latest-only rule; do not add misleading one-hour messaging to updates that are ineligible because they are not latest.
   - Preserve the current delete action and confirmations.

3. **Desktop and mobile interaction**
   - Reuse the existing post tooltip components and interaction pattern so mouse hover and touch/tap behavior remain consistent with posts.
   - Do not change post menus, the one-hour calculation, database enforcement, or any other review actions.

4. **Verification**
   - Add focused coverage for enabled, expired, owner, admin, and latest/non-latest timeline-update states.
   - Verify the menu visually on desktop and mobile: enabled Edit opens editing; expired Edit cannot open editing; both tooltip messages are reachable; Add timeline update and Delete still work as before.
