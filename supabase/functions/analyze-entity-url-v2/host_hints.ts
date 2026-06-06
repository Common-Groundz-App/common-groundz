// Phase 6: known JS-heavy hosts that benefit from Firecrawl rendering.
//
// Diagnostic-only. Used to tag firecrawl.priority. Never gates whether
// Firecrawl runs — the trigger lives in index.ts.

const JS_HEAVY_HOST_PATTERNS: RegExp[] = [
  /(^|\.)amazon\.[a-z.]+$/i,        // amazon.com, amazon.in, amazon.co.uk, ...
  /(^|\.)flipkart\.com$/i,
  /(^|\.)myntra\.com$/i,
  /(^|\.)nykaa\.com$/i,
  /(^|\.)ajio\.com$/i,
  /(^|\.)meesho\.com$/i,
];

export function isKnownJsHeavyHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return JS_HEAVY_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return false;
  }
}
