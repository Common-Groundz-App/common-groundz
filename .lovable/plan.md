## Problem

The click-outside handler in `UnifiedEntitySelector.tsx` (lines 193-204) only checks if the click is outside `inputRef` and `resultsRef`. Clicking the location pill, clear button, or any other element inside the search area (but outside those two refs) triggers `setShowResults(false)`, collapsing results and making it feel like the modal "closes" or loses focus.

## Solution

Add a `containerRef` on the outer `<div className="relative">` wrapper (line 652) that encompasses the input, location pill, and results dropdown. Update the click-outside handler to check against this single container ref instead of the two individual refs.

### Changes in `src/components/feed/UnifiedEntitySelector.tsx`

1. Add a new ref: `const containerRef = useRef<HTMLDivElement>(null);`

2. Update the click-outside handler (lines 193-204) to check `containerRef` instead of `inputRef` + `resultsRef`:
   ```
   if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
     setShowResults(false);
   }
   ```

3. Attach `containerRef` to the outer wrapper div at line 652:
   ```
   <div ref={containerRef} className="relative">
   ```

No other files are changed.
