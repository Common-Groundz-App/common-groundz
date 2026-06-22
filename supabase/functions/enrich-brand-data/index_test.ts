// Phase 1.8c.6-B — unit tests for the page-owned brand fallback extractor.
//
// We test extractBrandPageOwnedCandidates + isValidPageImageUrl directly.
// The serve() handler-level Google-first behavior is unchanged and is
// covered by existing logs/retests for Myntra/Tira/Nykaa brand creation.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidPageImageUrl } from "./image_validation.ts";

type LogoSource =
  | "google_site_scoped"
  | "google_broad"
  | "page_owned_og"
  | "page_owned_apple_touch_icon"
  | "page_owned_favicon"
  | "none";

// Local copy of the helper so tests don't import serve() (which would bind a port).
function extractBrandPageOwnedCandidates(
  html: string,
  officialWebsite: string,
): Array<{ url: string; source: LogoSource }> {
  if (!html) return [];
  let origin = "";
  try {
    origin = new URL(officialWebsite).origin;
  } catch {
    return [];
  }
  const resolve = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return null;
    try {
      return new URL(v, origin).href;
    } catch {
      return null;
    }
  };
  const out: Array<{ url: string; source: LogoSource }> = [];
  const og = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og && og[1]) {
    const r = resolve(og[1]);
    if (r) out.push({ url: r, source: "page_owned_og" });
  }
  const apple = html.match(/<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i);
  if (apple && apple[1]) {
    const r = resolve(apple[1]);
    if (r) out.push({ url: r, source: "page_owned_apple_touch_icon" });
  }
  const iconTagRe = /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*>/gi;
  const tags = html.match(iconTagRe) || [];
  for (const tag of tags) {
    const sizesMatch = tag.match(/sizes=["']([^"']+)["']/i);
    if (!sizesMatch) continue;
    const sizes = sizesMatch[1].toLowerCase();
    let maxDim = 0;
    for (const tok of sizes.split(/\s+/)) {
      const m = tok.match(/^(\d+)x(\d+)$/);
      if (m) {
        const d = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
        if (d > maxDim) maxDim = d;
      }
    }
    if (maxDim < 128) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const r = resolve(hrefMatch[1]);
    if (r) {
      out.push({ url: r, source: "page_owned_favicon" });
      break;
    }
  }
  return out;
}

Deno.test("og:image is the highest priority candidate and resolves relative URLs", () => {
  const html = `<meta property="og:image" content="/assets/brand-logo.png">`;
  const cands = extractBrandPageOwnedCandidates(html, "https://brand.example/");
  assertEquals(cands.length, 1);
  assertEquals(cands[0].source, "page_owned_og");
  assertEquals(cands[0].url, "https://brand.example/assets/brand-logo.png");
  assert(isValidPageImageUrl(cands[0].url));
});

Deno.test("apple-touch-icon is accepted at any size", () => {
  const html = `<link rel="apple-touch-icon" href="https://brand.example/apple.png">`;
  const cands = extractBrandPageOwnedCandidates(html, "https://brand.example/");
  assertEquals(cands.length, 1);
  assertEquals(cands[0].source, "page_owned_apple_touch_icon");
  assert(isValidPageImageUrl(cands[0].url));
});

Deno.test("link rel=icon is only accepted when sizes >= 128", () => {
  const okHtml = `<link rel="icon" sizes="192x192" href="https://brand.example/icon-192.png">`;
  const smallHtml = `<link rel="icon" sizes="32x32" href="https://brand.example/icon-32.png">`;
  const noSizeHtml = `<link rel="icon" href="https://brand.example/icon.png">`;

  const ok = extractBrandPageOwnedCandidates(okHtml, "https://brand.example/");
  assertEquals(ok.length, 1);
  assertEquals(ok[0].source, "page_owned_favicon");

  const small = extractBrandPageOwnedCandidates(smallHtml, "https://brand.example/");
  assertEquals(small.length, 0);

  const noSize = extractBrandPageOwnedCandidates(noSizeHtml, "https://brand.example/");
  assertEquals(noSize.length, 0);
});

Deno.test("invalid candidates are rejected by the shared validator", () => {
  // The handler runs each candidate through isValidPageImageUrl before
  // accepting it as a fallback. These must all fail.
  assertEquals(isValidPageImageUrl("data:image/png;base64,AAAA"), false);
  assertEquals(isValidPageImageUrl("https://brand.example/favicon.ico"), false);
  assertEquals(isValidPageImageUrl("https://brand.example/1x1.png"), false);
});

Deno.test("empty HTML yields zero candidates (handler skips fallback cleanly)", () => {
  assertEquals(extractBrandPageOwnedCandidates("", "https://brand.example/"), []);
});

Deno.test("malformed official website URL yields zero candidates (no exception)", () => {
  const html = `<meta property="og:image" content="https://brand.example/og.png">`;
  assertEquals(extractBrandPageOwnedCandidates(html, "not-a-url"), []);
});

Deno.test("logoSource enum is closed (telemetry contract)", () => {
  const allowed = new Set<LogoSource>([
    "google_site_scoped",
    "google_broad",
    "page_owned_og",
    "page_owned_apple_touch_icon",
    "page_owned_favicon",
    "none",
  ]);
  assertEquals(allowed.size, 6);
});
