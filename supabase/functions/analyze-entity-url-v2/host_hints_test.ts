import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isKnownJsHeavyHost } from "./host_hints.ts";

Deno.test("amazon variants are JS-heavy", () => {
  for (const u of [
    "https://www.amazon.com/dp/B0",
    "https://amazon.in/dp/B0",
    "https://www.amazon.co.uk/dp/B0",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), true, u);
  }
});

Deno.test("flipkart/myntra/nykaa/ajio/meesho are JS-heavy", () => {
  for (const u of [
    "https://www.flipkart.com/x",
    "https://myntra.com/x",
    "https://m.nykaa.com/x",
    "https://www.ajio.com/x",
    "https://meesho.com/x",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), true, u);
  }
});

Deno.test("benign hosts are not flagged", () => {
  for (const u of [
    "https://wikipedia.org/wiki/X",
    "https://example.com/x",
    "https://www.imdb.com/title/tt1",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), false, u);
  }
});

Deno.test("malformed URL returns false without throwing", () => {
  assertEquals(isKnownJsHeavyHost("not a url"), false);
  assertEquals(isKnownJsHeavyHost(""), false);
});
