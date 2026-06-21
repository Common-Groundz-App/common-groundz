import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runFirecrawlScrape, safeBaseUrl } from "./firecrawl.ts";

Deno.test("default request body includes timeout: 25000", async () => {
  let captured: unknown = null;
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(
      new Response(JSON.stringify({ data: { html: "<x/>" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
  await runFirecrawlScrape("https://example.com/x", { apiKey: "k", fetchImpl });
  assertEquals((captured as { timeout: number }).timeout, 25000);
});

Deno.test("high-priority apiTimeoutMs sets request body timeout: 30000", async () => {
  let captured: unknown = null;
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(
      new Response(JSON.stringify({ data: { html: "<x/>" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
  await runFirecrawlScrape("https://example.com/x", {
    apiKey: "k",
    fetchImpl,
    apiTimeoutMs: 30000,
    timeoutMs: 32000,
  });
  assertEquals((captured as { timeout: number }).timeout, 30000);
});


const URL_IN = "https://example.com/x";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("missing api key short-circuits with FIRECRAWL_NOT_CONFIGURED and no fetch", async () => {
  let called = false;
  const fetchImpl = ((..._a: unknown[]) => {
    called = true;
    return Promise.resolve(jsonRes({}));
  }) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_NOT_CONFIGURED");
  assertEquals(called, false);
});

Deno.test("200 with data.html → ok", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({ data: { html: "<html>ok</html>", metadata: { sourceURL: "https://x.test/" } } }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.html, "<html>ok</html>");
    assertEquals(r.finalUrl, "https://x.test/");
  }
});

Deno.test("200 with only data.rawHtml → ok (fallback)", async () => {
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ data: { rawHtml: "<raw/>" } }))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) assertEquals(r.html, "<raw/>");
});

Deno.test("requests formats=[html,markdown]", async () => {
  let captured: unknown = null;
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(jsonRes({ data: { html: "<x/>" } }));
  }) as unknown as typeof fetch;
  await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals((captured as { formats: string[] }).formats, ["html", "markdown"]);
});

Deno.test("200 with markdown + metadata → exposed on success", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({
        data: {
          html: "<x/>",
          markdown: "# Hello",
          metadata: { "og:type": "product", title: "T" },
        },
      }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.markdown, "# Hello");
    assertEquals(r.metadata?.["og:type"], "product");
  }
});

Deno.test("200 with only metadata (no html, no markdown) → ok, html empty", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({ data: { metadata: { "og:type": "product" } } }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.html, "");
    assertEquals(r.markdown, null);
    assertEquals(r.metadata?.["og:type"], "product");
  }
});

Deno.test("200 with all of html/markdown/metadata missing → FIRECRAWL_BAD_RESPONSE", async () => {
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ data: {} }))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_BAD_RESPONSE");
});

Deno.test("oversize markdown → markdown null, scrape ok", async () => {
  const big = "x".repeat(2 * 1024 * 1024 + 1);
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({ data: { html: "<x/>", markdown: big } }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) assertEquals(r.markdown, null);
});

Deno.test("402 → FIRECRAWL_INSUFFICIENT_CREDITS", async () => {
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ error: "no credits" }, 402))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.code, "FIRECRAWL_INSUFFICIENT_CREDITS");
    assertEquals(r.status, 402);
  }
});

Deno.test("5xx → FIRECRAWL_HTTP_ERROR with status", async () => {
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ error: "oops" }, 503))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.code, "FIRECRAWL_HTTP_ERROR");
    assertEquals(r.status, 503);
  }
});

Deno.test("abort/timeout → FIRECRAWL_TIMEOUT", async () => {
  const fetchImpl = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal) {
        signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }
    })) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl, timeoutMs: 10 });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_TIMEOUT");
});

Deno.test("oversize html → FIRECRAWL_RESPONSE_TOO_LARGE", async () => {
  const big = "x".repeat(2 * 1024 * 1024 + 1);
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ data: { html: big } }))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_RESPONSE_TOO_LARGE");
});

Deno.test("malformed JSON → FIRECRAWL_BAD_RESPONSE", async () => {
  const fetchImpl = (() =>
    Promise.resolve(new Response("not json", { status: 200 }))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_BAD_RESPONSE");
});

Deno.test("safeBaseUrl: https kept, others fall back", () => {
  assertEquals(safeBaseUrl("https://a.test/x", "https://fb/"), "https://a.test/x");
  assertEquals(safeBaseUrl("http://a.test/x", "https://fb/"), "http://a.test/x");
  assertEquals(safeBaseUrl("javascript:alert(1)", "https://fb/"), "https://fb/");
  assertEquals(safeBaseUrl("data:text/html,x", "https://fb/"), "https://fb/");
  assertEquals(safeBaseUrl("not a url", "https://fb/"), "https://fb/");
  assertEquals(safeBaseUrl(undefined, "https://fb/"), "https://fb/");
});

Deno.test("oversize html + metadata: ok, html dropped", async () => {
  const big = "x".repeat(2 * 1024 * 1024 + 1);
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({ data: { html: big, metadata: { "og:type": "product" } } }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.html, "");
    assertEquals(r.metadata?.["og:type"], "product");
  }
});

Deno.test("oversize html + markdown: ok, html dropped", async () => {
  const big = "x".repeat(2 * 1024 * 1024 + 1);
  const fetchImpl = (() =>
    Promise.resolve(
      jsonRes({ data: { html: big, markdown: "# Hello" } }),
    )) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.html, "");
    assertEquals(r.markdown, "# Hello");
  }
});

// ============= Phase 1.8c.5 shape diagnostic tests =============

import { buildFirecrawlShapeDiagnostic } from "./firecrawl.ts";

const BASE_REQ = {
  urlHost: "www.amazon.com",
  urlHasQueryString: false,
  isAmazon: true,
  formats: ["html", "markdown"],
  onlyMainContent: false,
  waitForMs: 1500,
  apiTimeoutMs: 25000,
  localTimeoutMs: 27000,
  maxHtmlBytes: 2 * 1024 * 1024,
  payloadKeys: ["url", "formats", "onlyMainContent", "waitFor", "timeout"],
};
const CTX = { requestId: "rid-123", callSite: "main" as const };

Deno.test("shape diag: success excludes raw metadata/content values", () => {
  const body = {
    success: true,
    data: {
      html: "<html>secret content</html>",
      markdown: "# Secret title",
      metadata: { title: "RAW_TITLE", description: "RAW_DESC", ogTitle: "RAW_OG" },
    },
  };
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 123,
    context: CTX,
  });
  assertEquals(d.has_html, true);
  assertEquals(d.has_markdown, true);
  assertEquals(d.metadata_title_present, true);
  assertEquals(d.metadata_og_title_present, true);
  const s = JSON.stringify(d);
  assert(!s.includes("RAW_TITLE"));
  assert(!s.includes("RAW_DESC"));
  assert(!s.includes("RAW_OG"));
  assert(!s.includes("secret content"));
  assert(!s.includes("Secret title"));
});

Deno.test("shape diag: non-2xx failure emits status + http_error", () => {
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 503, contentType: "text/plain", body: undefined, parseOk: false, bodyParseFailed: false },
    failure: { errorKind: "http_error", aborted: false },
    htmlOversizeDropped: false,
    durationMs: 10,
    context: CTX,
  });
  assertEquals(d.http_status, 503);
  assertEquals(d.error_kind, "http_error");
  assertEquals(d.aborted, false);
});

Deno.test("shape diag: timeout emits aborted:true", () => {
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    failure: { errorKind: "timeout", aborted: true },
    htmlOversizeDropped: false,
    durationMs: 27000,
    context: CTX,
  });
  assertEquals(d.error_kind, "timeout");
  assertEquals(d.aborted, true);
  assertEquals(d.http_status, null);
});

Deno.test("shape diag: body parse failure sets body_parse_failed", () => {
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: undefined, parseOk: false, bodyParseFailed: true },
    failure: { errorKind: "parse_error", aborted: false },
    htmlOversizeDropped: false,
    durationMs: 5,
    context: CTX,
  });
  assertEquals(d.body_parse_failed, true);
  assertEquals(d.parse_ok, false);
  assertEquals(d.error_kind, "parse_error");
});

Deno.test("shape diag: metadata_keys capped to 50 and ≤40 chars, values excluded", () => {
  const md: Record<string, string> = {};
  for (let i = 0; i < 75; i++) md[`key_${i}_value`] = `VALUE_${i}_SECRET`;
  md["x".repeat(80)] = "LONG_KEY_VALUE";
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: { data: { metadata: md } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  const keys = d.metadata_keys as string[];
  assertEquals(keys.length, 50);
  for (const k of keys) assert(k.length <= 40);
  const s = JSON.stringify(d);
  assert(!s.includes("VALUE_0_SECRET"));
  assert(!s.includes("LONG_KEY_VALUE"));
});

Deno.test("shape diag: firecrawl_error_code accepts safe code, rejects raw message", () => {
  const ok = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 402, contentType: "application/json", body: { error: { code: "INSUFFICIENT_CREDITS", message: "Buy more please very long text" } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  assertEquals(ok.firecrawl_error_code, "INSUFFICIENT_CREDITS");
  const bad = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 500, contentType: "application/json", body: { error: { message: "Something went terribly wrong with the scraper today" } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  assertEquals(bad.firecrawl_error_code, null);
});

Deno.test("shape diag: UTF-8 byte sizes correct for multi-byte chars", () => {
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: { data: { markdown: "日本語" } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  assertEquals(d.markdown_bytes, 9);
});

Deno.test("shape diag: call_site and request_id propagate", () => {
  const d = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: { data: { html: "x" } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: { requestId: "abc-999", callSite: "recovery" },
  });
  assertEquals(d.request_id, "abc-999");
  assertEquals(d.call_site, "recovery");
});

Deno.test("shape diag: data_unwrap_path detects body.data/result/body/none", () => {
  const mk = (body: unknown) => buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  }).data_unwrap_path;
  assertEquals(mk({ data: { html: "x" } }), "body.data");
  assertEquals(mk({ result: { html: "x" } }), "body.result");
  assertEquals(mk({ html: "x" }), "body");
  assertEquals(mk({ success: true }), "none");
});

Deno.test("shape diag: metadata presence booleans handle ogTitle vs og:title", () => {
  const d1 = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: { data: { metadata: { "og:title": "x", "og:description": "y" } } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  assertEquals(d1.metadata_og_title_present, true);
  assertEquals(d1.metadata_og_description_present, true);
  assertEquals(d1.metadata_title_present, false);

  const d2 = buildFirecrawlShapeDiagnostic({
    requestArgs: BASE_REQ,
    response: { httpStatus: 200, contentType: "application/json", body: { data: { metadata: {} } }, parseOk: true, bodyParseFailed: false },
    htmlOversizeDropped: false,
    durationMs: 1,
    context: CTX,
  });
  assertEquals(d2.metadata_og_title_present, false);
});

Deno.test("runFirecrawlScrape: url_has_query_string + host-only derived from URL", async () => {
  let captured: Record<string, unknown> | null = null;
  const origLog = console.log;
  console.log = (..._args: unknown[]) => {
    // Last arg should be JSON string of diag when prefix matches
    const arg0 = _args[0];
    if (typeof arg0 === "string" && arg0.includes("firecrawl.shape_diag")) {
      try { captured = JSON.parse(String(_args[1])); } catch { /* ignore */ }
    }
  };
  try {
    const fetchImpl = (() => Promise.resolve(jsonRes({ data: { html: "<x/>" } }))) as unknown as typeof fetch;
    await runFirecrawlScrape("https://www.amazon.com/dp/B000?ref=foo&x=1", {
      apiKey: "k",
      fetchImpl,
      diagContext: { requestId: "rid-xyz", callSite: "main" },
    });
  } finally {
    console.log = origLog;
  }
  assert(captured !== null);
  assertEquals((captured as Record<string, unknown>).url_host, "www.amazon.com");
  assertEquals((captured as Record<string, unknown>).url_has_query_string, true);
  assertEquals((captured as Record<string, unknown>).is_amazon, true);
  assertEquals((captured as Record<string, unknown>).call_site, "main");
  assertEquals((captured as Record<string, unknown>).request_id, "rid-xyz");
  const s = JSON.stringify(captured);
  assert(!s.includes("ref=foo"));
  assert(!s.includes("x=1"));
});
