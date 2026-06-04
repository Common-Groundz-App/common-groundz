// Deno tests for Phase 4A SSRF preflight + URL normalization.
// No real network: DNS is always provided via an injected fake resolver.

import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSafeUrl,
  type DnsResolver,
  normalizeUrl,
  SsrfError,
} from "./ssrf.ts";

// ---------- helpers ----------

function fakeResolver(
  map: Record<string, { A?: string[] | Error; AAAA?: string[] | Error }>,
): DnsResolver {
  return (host, rt) => {
    const entry = map[host];
    if (!entry) return Promise.reject(new Error("no fake entry"));
    const v = entry[rt];
    if (v instanceof Error) return Promise.reject(v);
    return Promise.resolve(v ?? []);
  };
}

function err(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

// ---------- normalization ----------

Deno.test("normalize: appends slash to bare host", () => {
  const n = normalizeUrl("https://example.com");
  assertEquals(n.url, "https://example.com/");
  assertEquals(n.port, 443);
});

Deno.test("normalize: strips default https port", () => {
  const n = normalizeUrl("https://example.com:443/x");
  assertEquals(n.url, "https://example.com/x");
  assertEquals(n.port, 443);
});

Deno.test("normalize: keeps non-default port", () => {
  const n = normalizeUrl("https://example.com:8443/x");
  assertEquals(n.url, "https://example.com:8443/x");
  assertEquals(n.port, 8443);
});

Deno.test("normalize: lowercases hostname, preserves path case + query order + query case, strips fragment", () => {
  const n = normalizeUrl("https://EXAMPLE.com/Path?Q=B&A=1#frag");
  assertEquals(n.url, "https://example.com/Path?Q=B&A=1");
});

Deno.test("normalize: preserves duplicate slashes in path", () => {
  const n = normalizeUrl("https://example.com/a//b");
  assertEquals(n.url, "https://example.com/a//b");
});

Deno.test("normalize: drops fragment (#secret)", () => {
  const n = normalizeUrl("https://example.com/path#secret");
  assertEquals(n.url, "https://example.com/path");
});

Deno.test("normalize: rejects non-http(s) protocol", () => {
  let caught: SsrfError | null = null;
  try { normalizeUrl("ftp://example.com/"); } catch (e) { caught = e as SsrfError; }
  assert(caught instanceof SsrfError);
  assertEquals(caught!.code, "INVALID_URL");
});

Deno.test("normalize: rejects userinfo (BLOCKED_HOST/userinfo) — never sanitized", () => {
  let caught: SsrfError | null = null;
  try { normalizeUrl("https://user:pass@example.com/"); } catch (e) { caught = e as SsrfError; }
  assert(caught instanceof SsrfError);
  assertEquals(caught!.code, "BLOCKED_HOST");
  assertEquals(caught!.reason, "userinfo");
});

// ---------- IP literal blocks (no DNS path) ----------

const blockedLiterals = [
  "http://localhost/",
  "http://127.0.0.1/",
  "http://0.0.0.0/",
  "http://10.0.0.1/",
  "http://192.168.1.1/",
  "http://169.254.169.254/",
  "http://[::1]/",
  "http://[fc00::1]/",
  "http://[fe80::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://2130706433/",
  "http://0177.0.0.1/",
  "http://0x7f000001/",
];

for (const url of blockedLiterals) {
  Deno.test(`block literal: ${url}`, async () => {
    await assertRejects(
      () => assertSafeUrl(url),
      SsrfError,
    );
  });
}

// ---------- port allowlist ----------

Deno.test("block: port 22 not allowed", async () => {
  const e = await assertRejects(
    () => assertSafeUrl("https://example.com:22/"),
    SsrfError,
  );
  assertEquals(e.code, "BLOCKED_HOST");
  assertEquals(e.reason, "port_not_allowed");
});

Deno.test("allow: port 8080", async () => {
  const s = await assertSafeUrl("http://example.com:8080/");
  assertEquals(s.url, "http://example.com:8080/");
});

// ---------- hostname suffix blocks ----------

for (const url of ["http://app.internal/", "http://db.lan/", "http://x.home.arpa/"]) {
  Deno.test(`block suffix: ${url}`, async () => {
    await assertRejects(() => assertSafeUrl(url), SsrfError);
  });
}

// ---------- DNS behavior (fake resolver) ----------

Deno.test("DNS: A-only host is allowed", async () => {
  const r = fakeResolver({
    "example.com": { A: ["93.184.216.34"], AAAA: err("NotFound") },
  });
  const s = await assertSafeUrl("https://example.com/", { resolveDns: r });
  assert(s.dnsChecked);
});

Deno.test("DNS: AAAA-only host is allowed", async () => {
  const r = fakeResolver({
    "example.com": {
      A: err("NotFound"),
      AAAA: ["2606:2800:220:1:248:1893:25c8:1946"],
    },
  });
  const s = await assertSafeUrl("https://example.com/", { resolveDns: r });
  assert(s.dnsChecked);
});

Deno.test("DNS: A resolves to private 10.x — blocked", async () => {
  const r = fakeResolver({
    "evil.example.com": { A: ["10.0.0.1"], AAAA: err("NotFound") },
  });
  const e = await assertRejects(
    () => assertSafeUrl("https://evil.example.com/", { resolveDns: r }),
    SsrfError,
  );
  assertEquals(e.code, "BLOCKED_HOST");
  assertEquals(e.reason, "dns_resolves_private");
});

Deno.test("DNS: AAAA resolves to ::1 — blocked", async () => {
  const r = fakeResolver({
    "evil.example.com": { A: err("NotFound"), AAAA: ["::1"] },
  });
  await assertRejects(
    () => assertSafeUrl("https://evil.example.com/", { resolveDns: r }),
    SsrfError,
  );
});

Deno.test("DNS: AAAA returns fc00::1 without brackets — still blocked", async () => {
  const r = fakeResolver({
    "evil.example.com": { A: err("NotFound"), AAAA: ["fc00::1"] },
  });
  await assertRejects(
    () => assertSafeUrl("https://evil.example.com/", { resolveDns: r }),
    SsrfError,
  );
});

Deno.test("DNS: both lookups hard-fail (generic Error) → DNS_RESOLUTION_FAILED", async () => {
  const r = fakeResolver({
    "broken.example.com": {
      A: new Error("net down"),
      AAAA: new Error("net down"),
    },
  });
  const e = await assertRejects(
    () => assertSafeUrl("https://broken.example.com/", { resolveDns: r }),
    SsrfError,
  );
  assertEquals(e.code, "DNS_RESOLUTION_FAILED");
});

Deno.test("DNS: NotCapable on both → allowed with dnsChecked=false", async () => {
  const r = fakeResolver({
    "example.com": { A: err("NotCapable"), AAAA: err("NotCapable") },
  });
  const s = await assertSafeUrl("https://example.com/", { resolveDns: r });
  assertEquals(s.dnsChecked, false);
});

Deno.test("DNS: no resolver provided → allowed with dnsChecked=false", async () => {
  const s = await assertSafeUrl("https://example.com/");
  assertEquals(s.dnsChecked, false);
});
