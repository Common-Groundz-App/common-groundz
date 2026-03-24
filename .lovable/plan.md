

# Fix: Scroll Position Retained Across Routes — Final Plan

The try/catch is unnecessary. `window.scrollTo` does not throw — if a browser doesn't recognize `"instant"`, it silently falls back to default behavior. Adding a try/catch around a non-throwing API is cargo-cult defensiveness.

**Plan is unchanged. Implementing as-is.**

## Changes

### 1. Create `src/components/ScrollToTop.tsx`

```typescript
import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "PUSH" || navigationType === "REPLACE") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname, navigationType]);

  return null;
}
```

### 2. Edit `src/App.tsx`

Import `ScrollToTop` and render `<ScrollToTop />` just inside `<Router>`, before `<AuthInitializer>`.

