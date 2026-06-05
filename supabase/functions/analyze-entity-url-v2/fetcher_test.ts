// Deno tests for Phase 4B safe-fetch helper.
// No real network: fetchImpl and resolveDns are always injected fakes.

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { DnsResolver } from "./ssrf.ts";
import {
  FetchError,
  readWithDeadline,
  validateAndFetchUrl,
  withDeadline,
} from "./fetcher.ts";

// ---------- helpers ----------

const publicResolver: DnsResolver = (_h, rt) =>
  Promise.resolve(rt === "A" ? ["93.184.216.34"] : []);

function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function htmlResponse(body: string, ct = "text/html"): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": ct } });
}

function redirectResponse(loc: string, status = 302): Response {
  return new Response(null, { status, headers: { "Location": loc } });
}

function makeFetchImpl(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: string[] = [];
  const fn = (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    return Promise.resolve(handler(url, init));
  };
  return { fn: fn as unknown as typeof fetch, calls };
}

// ---------- happy paths ----------

Deno.test("happy: 200 text/html returns body and zero redirects", async () => {
  const { fn } = makeFetchImpl(() => htmlResponse("<html><body>hi</body></html>"));
  const r = await validateAndFetchUrl("https://example.com/", {
    resolveDns: publicResolver,
    fetchImpl: fn,
  });
  assertEquals(r.status, 200);
  assertEquals(r.contentType, "text/html");
  assertEquals(r.redirectChain.length, 1);
  assert(r.bodyText.includes("hi"));
});

Deno.test("happy: application/xhtml+xml with charset parameter is allowed", async () => {
  const { fn } = makeFetchImpl(() =>
    htmlResponse("<x/>", "application/xhtml+xml; charset=utf-8"),
  );
  const r = await validateAndFetchUrl("https://example.com/", {
    resolveDns: publicResolver,
    fetchImpl: fn,
  });
  assertEquals(r.contentType, "application/xhtml+xml");
});

Deno.test("happy: 301 → 200 within hop limit, finalUrl is redirected target", async () => {
  let n = 0;
  const { fn } = makeFetchImpl(() => {
    n++;
    if (n === 1) return redirectResponse("https://example.com/final", 301);
    return htmlResponse("ok");
  });
  const r = await validateAndFetchUrl("https://example.com/", {
    resolveDns: publicResolver,
    fetchImpl: fn,
  });
  assertEquals(r.finalUrl, "https://example.com/final");
  assertEquals(r.redirectChain.length, 2);
});

// ---------- limits ----------

Deno.test("limit: body over maxBytes → FETCH_TOO_LARGE", async () => {
  const big = "x".repeat(200);
  const { fn } = makeFetchImpl(() => htmlResponse(big));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      maxBytes: 50,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TOO_LARGE");
});

Deno.test("limit: 4 redirects with maxRedirects=3 → FETCH_TOO_MANY_REDIRECTS", async () => {
  const { fn } = makeFetchImpl(() => redirectResponse("https://example.com/next"));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      maxRedirects: 3,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TOO_MANY_REDIRECTS");
});

// ---------- total budget timeouts ----------

Deno.test("budget: multiple redirects collectively exceed total budget → FETCH_TIMEOUT", async () => {
  let n = 0;
  const handler = async () => {
    n++;
    await new Promise((r) => setTimeout(r, 80));
    if (n < 4) return redirectResponse("https://example.com/n" + n);
    return htmlResponse("ok");
  };
  const { fn } = makeFetchImpl(handler);
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      timeoutMs: 100,
      maxRedirects: 5,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
});

Deno.test("budget: body streaming delayed chunks exceed budget → FETCH_TIMEOUT body_stream_timeout", async () => {
  const stream = new ReadableStream<Uint8Array>({
    async pull(c) {
      await new Promise((r) => setTimeout(r, 100));
      c.enqueue(new TextEncoder().encode("x"));
    },
  });
  const { fn } = makeFetchImpl(() =>
    new Response(stream, { status: 200, headers: { "Content-Type": "text/html" } }),
  );
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      timeoutMs: 50,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "body_stream_timeout");
});

Deno.test("budget: body via never-resolving pull() → FETCH_TIMEOUT (deadline race, not signal)", async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      return never<void>();
    },
  });
  const { fn } = makeFetchImpl(() =>
    new Response(stream, { status: 200, headers: { "Content-Type": "text/html" } }),
  );
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      timeoutMs: 60,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "body_stream_timeout");
});

Deno.test("budget: headers themselves slow past budget → FETCH_TIMEOUT", async () => {
  const { fn } = makeFetchImpl(async () => {
    await new Promise((r) => setTimeout(r, 200));
    return htmlResponse("ok");
  });
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver,
      fetchImpl: fn,
      timeoutMs: 50,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
});

Deno.test("budget: initial DNS preflight exceeds budget → FETCH_TIMEOUT preflight_timeout, fetch never called", async () => {
  const hangingResolver: DnsResolver = () => never<string[]>();
  const { fn, calls } = makeFetchImpl(() => htmlResponse("nope"));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: hangingResolver,
      fetchImpl: fn,
      timeoutMs: 30,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "preflight_timeout");
  assertEquals(calls.length, 0);
});

Deno.test("budget: redirect-target DNS preflight exceeds remaining budget → FETCH_TIMEOUT redirect_preflight_timeout", async () => {
  let n = 0;
  const resolver: DnsResolver = (host, rt) => {
    if (host === "other.example") return never<string[]>();
    return rt === "A" ? Promise.resolve(["93.184.216.34"]) : Promise.resolve([]);
  };
  const { fn } = makeFetchImpl(() => {
    n++;
    if (n === 1) return redirectResponse("https://other.example/x");
    return htmlResponse("ok");
  });
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: resolver,
      fetchImpl: fn,
      timeoutMs: 80,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "redirect_preflight_timeout");
});

// ---------- orphan hygiene ----------

Deno.test("orphan: late-resolving DNS after preflight timeout does not throw", async () => {
  let late = false;
  const resolver: DnsResolver = () => new Promise((res) => {
    setTimeout(() => { late = true; res(["8.8.8.8"]); }, 80);
  });
  const { fn } = makeFetchImpl(() => htmlResponse("ok"));
  await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: resolver,
      fetchImpl: fn,
      timeoutMs: 20,
    }),
    FetchError,
  );
  await new Promise((r) => setTimeout(r, 120));
  assertEquals(late, true);
});

// ---------- content type ----------

Deno.test("content-type: application/json → FETCH_BAD_CONTENT_TYPE", async () => {
  const { fn } = makeFetchImpl(() => htmlResponse("{}", "application/json"));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_BAD_CONTENT_TYPE");
});

Deno.test("content-type: missing Content-Type → FETCH_BAD_CONTENT_TYPE", async () => {
  const { fn } = makeFetchImpl(() => new Response("x", { status: 200 }));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_BAD_CONTENT_TYPE");
});

// ---------- status ----------

Deno.test("status: 404 → FETCH_BAD_STATUS reason=404", async () => {
  const { fn } = makeFetchImpl(() => new Response("nope", { status: 404 }));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_BAD_STATUS");
  assertEquals(e.reason, "404");
});

Deno.test("status: 500 → FETCH_BAD_STATUS", async () => {
  const { fn } = makeFetchImpl(() => new Response("boom", { status: 500 }));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_BAD_STATUS");
});

Deno.test("status: 302 without Location → FETCH_BAD_STATUS redirect_no_location", async () => {
  const { fn } = makeFetchImpl(() => new Response(null, { status: 302 }));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_BAD_STATUS");
  assertEquals(e.reason, "redirect_no_location");
});

// ---------- per-redirect SSRF re-check ----------

Deno.test("redirect SSRF: 302 → http://10.0.0.1/ → BLOCKED_HOST", async () => {
  let n = 0;
  const { fn } = makeFetchImpl(() => {
    n++;
    if (n === 1) return redirectResponse("http://10.0.0.1/");
    return htmlResponse("should not reach");
  });
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "BLOCKED_HOST");
});

Deno.test("redirect SSRF: 302 → relative /admin against public base → allowed", async () => {
  let n = 0;
  const { fn } = makeFetchImpl(() => {
    n++;
    if (n === 1) return redirectResponse("/admin");
    return htmlResponse("ok");
  });
  const r = await validateAndFetchUrl("https://example.com/", {
    resolveDns: publicResolver, fetchImpl: fn,
  });
  assertEquals(r.finalUrl, "https://example.com/admin");
});

Deno.test("redirect SSRF: 302 → http://[::1]/ → BLOCKED_HOST", async () => {
  let n = 0;
  const { fn } = makeFetchImpl(() => {
    n++;
    if (n === 1) return redirectResponse("http://[::1]/");
    return htmlResponse("nope");
  });
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "BLOCKED_HOST");
});

// ---------- DNS mandatory / hard-fail ----------

Deno.test("DNS: hard-fail on both A/AAAA → DNS_RESOLUTION_FAILED, fetch never called", async () => {
  const resolver: DnsResolver = () => Promise.reject(new Error("dns boom"));
  const { fn, calls } = makeFetchImpl(() => htmlResponse("ok"));
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: resolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "DNS_RESOLUTION_FAILED");
  assertEquals(calls.length, 0);
});

// ---------- network errors ----------

Deno.test("network: fetchImpl throws Error('boom') → FETCH_NETWORK_ERROR; reason carries 'boom'", async () => {
  const fn = (() => Promise.reject(new Error("boom"))) as unknown as typeof fetch;
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_NETWORK_ERROR");
  assert(e.reason && e.reason.includes("boom"));
});

Deno.test("network: AbortError → FETCH_TIMEOUT", async () => {
  const fn = (() => {
    const e = new Error("abort"); e.name = "AbortError"; return Promise.reject(e);
  }) as unknown as typeof fetch;
  const e = await assertRejects(
    () => validateAndFetchUrl("https://example.com/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
});

// ---------- preflight short-circuit ----------

Deno.test("preflight: http://localhost/ → BLOCKED_HOST, fetch never called", async () => {
  const { fn, calls } = makeFetchImpl(() => htmlResponse("nope"));
  const e = await assertRejects(
    () => validateAndFetchUrl("http://localhost/", {
      resolveDns: publicResolver, fetchImpl: fn,
    }),
    FetchError,
  );
  assertEquals(e.code, "BLOCKED_HOST");
  assertEquals(calls.length, 0);
});

// ---------- response-shape sanity ----------

Deno.test("shape: simulated success response does not contain bodyText or redirect_chain", async () => {
  const { fn } = makeFetchImpl(() => htmlResponse("<html>secret-marker-xyz</html>"));
  const r = await validateAndFetchUrl("https://example.com/", {
    resolveDns: publicResolver, fetchImpl: fn,
  });
  const serialized = JSON.stringify({
    success: true,
    predictions: null,
    metadata: {
      fetch: {
        final_url: r.finalUrl,
        status: r.status,
        content_type: r.contentType,
        bytes: r.bytes,
        redirect_count: r.redirectChain.length - 1,
        duration_ms: r.durationMs,
      },
    },
  });
  assert(!serialized.includes("secret-marker-xyz"));
  assert(!serialized.includes("redirect_chain"));
  assert(!serialized.includes("bodyText"));
});

// ---------- helper unit tests ----------

Deno.test("withDeadline: async onTimeout that awaits then throws → rejection carries FetchError", async () => {
  const e = await assertRejects(
    () => withDeadline(
      never<number>(),
      Date.now() + 20,
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        throw new FetchError("FETCH_TIMEOUT", { reason: "custom" });
      },
    ),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "custom");
});

Deno.test("withDeadline: resolves with value when promise beats deadline", async () => {
  const v = await withDeadline(
    Promise.resolve(42),
    Date.now() + 1000,
    () => { throw new FetchError("FETCH_TIMEOUT"); },
  );
  assertEquals(v, 42);
});

Deno.test("readWithDeadline: cancels reader and throws body_stream_timeout", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull() { return never<void>(); },
    cancel() { cancelled = true; },
  });
  const reader = stream.getReader();
  const e = await assertRejects(
    () => readWithDeadline(reader, Date.now() + 20),
    FetchError,
  );
  assertEquals(e.code, "FETCH_TIMEOUT");
  assertEquals(e.reason, "body_stream_timeout");
  await new Promise((r) => setTimeout(r, 5));
  assert(cancelled);
});

void assertStringIncludes;
