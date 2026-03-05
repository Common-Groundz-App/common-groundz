

# Clean Up Favicon Path

## Current State
- Favicon references `/lovable-uploads/5bb5487b-3432-4c19-b685-51a92b12516d.png` — an auto-generated path that looks unprofessional
- There's already a `favicon.ico` in `/public/` (unused)
- The actual favicon image is at `public/lovable-uploads/5bb5487b-...png`

## Plan (2 steps)

### 1. Copy the current favicon to a clean path
Copy `public/lovable-uploads/5bb5487b-3432-4c19-b685-51a92b12516d.png` → `public/favicon.png`

### 2. Update `index.html` — clean favicon reference
Replace:
```html
<link rel="icon" href="/lovable-uploads/5bb5487b-3432-4c19-b685-51a92b12516d.png" type="image/png">
```
With:
```html
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/favicon.png">
```

The `apple-touch-icon` line ensures iPhones show a proper icon when someone saves the site to their home screen. Ideally you'd use a 180x180 version for that, but using the same PNG is fine for now — it'll look correct.

## About ChatGPT's suggestions

- **Renaming the file**: Agreed, that's exactly what we're doing.
- **Multiple sizes (32x32, 48x48, 180x180)**: Nice-to-have but not urgent. Modern browsers handle resizing a single PNG well. You can optimize this later with a favicon generator tool.
- **Apple touch icon**: Yes, adding it — low effort, good payoff.
- **Removing old `favicon.ico`**: We can delete the unused `public/favicon.ico` to keep things tidy.

## Not changed
- The favicon image itself (same logo, just moved to a clean path)
- Everything else in the app

## Result
Your favicon URL becomes `https://commongroundz.co/favicon.png` — clean and professional.

