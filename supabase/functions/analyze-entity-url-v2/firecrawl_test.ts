import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runFirecrawlScrape, safeBaseUrl } from "./firecrawl.ts";

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

Deno.test("200 with no html → FIRECRAWL_BAD_RESPONSE", async () => {
  const fetchImpl = (() =>
    Promise.resolve(jsonRes({ data: {} }))) as unknown as typeof fetch;
  const r = await runFirecrawlScrape(URL_IN, { apiKey: "k", fetchImpl });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "FIRECRAWL_BAD_RESPONSE");
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
