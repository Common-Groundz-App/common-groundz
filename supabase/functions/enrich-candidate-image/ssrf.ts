// Phase 4A: SSRF preflight + conservative URL normalization.
//
// Preflight only. NO network fetch happens here. Once Phase 4B introduces
// real fetching, DNS resolution + per-redirect re-check at connect time
// become MANDATORY (not optional).

export type SsrfErrorCode = "INVALID_URL" | "BLOCKED_HOST" | "DNS_RESOLUTION_FAILED";

export class SsrfError extends Error {
  code: SsrfErrorCode;
  reason?: string;
  constructor(code: SsrfErrorCode, opts?: { reason?: string; message?: string }) {
    super(opts?.message ?? code);
    this.code = code;
    this.reason = opts?.reason;
    this.name = "SsrfError";
  }
}

const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

const BLOCKED_HOSTNAME_EXACT = new Set(["localhost"]);
const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".intranet",
  ".corp",
  ".home",
  ".home.arpa",
];

export interface NormalizedUrl {
  url: string;
  host: string;
  hostname: string;
  port: number;
  protocol: "http:" | "https:";
}

export interface SafeUrl extends NormalizedUrl {
  dnsChecked: boolean;
}

export type DnsResolver = (
  hostname: string,
  recordType: "A" | "AAAA",
) => Promise<string[]>;

export interface AssertSafeOpts {
  resolveDns?: DnsResolver;
}

/**
 * Conservative URL normalization. Rejects userinfo before any mutation.
 * Does NOT touch path slashes, query order, or query case.
 */
export function normalizeUrl(input: string): NormalizedUrl {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new SsrfError("INVALID_URL", { message: "Invalid URL" });
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfError("INVALID_URL", { message: "URL must be http(s)" });
  }

  // Reject userinfo BEFORE any mutation. Never sanitize away.
  if (u.username || u.password) {
    throw new SsrfError("BLOCKED_HOST", { reason: "userinfo" });
  }

  u.hostname = u.hostname.toLowerCase();
  u.hash = "";

  // new URL().toString() already strips :80 for http and :443 for https.
  // Read u.port after parsing; empty means protocol default.
  const effectivePort = u.port
    ? Number(u.port)
    : u.protocol === "https:"
      ? 443
      : 80;

  return {
    url: u.toString(),
    host: u.host,
    hostname: u.hostname,
    port: effectivePort,
    protocol: u.protocol as "http:" | "https:",
  };
}

/** True if Deno's NotFound (or fake equivalent) — treat as "no records of this type". */
export function isDnsNoRecordsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  if (name === "NotFound") return true;
  // Deno.errors.NotFound instance check (safe even if Deno.errors is missing)
  try {
    // deno-lint-ignore no-explicit-any
    const NotFound = (Deno as any)?.errors?.NotFound;
    if (NotFound && err instanceof NotFound) return true;
  } catch { /* ignore */ }
  return false;
}

function isDnsNotCapableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  if (name === "NotCapable" || name === "PermissionDenied") return true;
  try {
    // deno-lint-ignore no-explicit-any
    const errs = (Deno as any)?.errors;
    if (errs?.NotCapable && err instanceof errs.NotCapable) return true;
    if (errs?.PermissionDenied && err instanceof errs.PermissionDenied) return true;
  } catch { /* ignore */ }
  return false;
}

// ---------- IP literal classification ----------

function isIPv4Literal(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function parseIPv4ToOctets(host: string): number[] | null {
  if (isIPv4Literal(host)) {
    const parts = host.split(".").map((p) => Number(p));
    if (parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return parts;
    return null;
  }
  return null;
}

/**
 * Accept WHATWG dotted-quad AND non-standard integer forms (decimal/octal/hex)
 * that the URL parser may keep as-is on the hostname slot. Returns 4 octets
 * if it parses as IPv4, otherwise null.
 */
function parseLooseIPv4(host: string): number[] | null {
  const direct = parseIPv4ToOctets(host);
  if (direct) return direct;

  // 1-4 dot-separated parts, each decimal/octal/hex
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (p.length === 0) return null;
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^\d+$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  // Expand per inet_aton-ish rules
  let octets: number[];
  if (nums.length === 1) {
    const n = nums[0];
    if (n > 0xffffffff) return null;
    octets = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  } else if (nums.length === 2) {
    if (nums[0] > 0xff || nums[1] > 0xffffff) return null;
    octets = [nums[0], (nums[1] >>> 16) & 0xff, (nums[1] >>> 8) & 0xff, nums[1] & 0xff];
  } else if (nums.length === 3) {
    if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) return null;
    octets = [nums[0], nums[1], (nums[2] >>> 8) & 0xff, nums[2] & 0xff];
  } else {
    if (nums.some((n) => n > 0xff)) return null;
    octets = nums;
  }
  return octets;
}

function isBlockedIPv4(octets: number[]): boolean {
  const [a, b, c, d] = octets;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 169.254.0.0/16
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 reserved
  if (a >= 240 && a <= 255) return true;
  // 255.255.255.255 (covered by 240/4 above)
  void d;
  return false;
}

function stripIPv6Brackets(s: string): string {
  if (s.startsWith("[") && s.endsWith("]")) return s.slice(1, -1);
  return s;
}

function expandIPv6(addr: string): number[] | null {
  // Returns 8 16-bit groups, or null if not parseable.
  const raw = stripIPv6Brackets(addr).toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(raw)) return null;

  // Handle embedded IPv4 (e.g. ::ffff:1.2.3.4)
  let groups: string[];
  if (raw.includes(".")) {
    const lastColon = raw.lastIndexOf(":");
    const head = raw.slice(0, lastColon);
    const v4 = raw.slice(lastColon + 1);
    const v4Octets = parseIPv4ToOctets(v4);
    if (!v4Octets) return null;
    const high = (v4Octets[0] << 8) | v4Octets[1];
    const low = (v4Octets[2] << 8) | v4Octets[3];
    const tail = `${high.toString(16)}:${low.toString(16)}`;
    return expandIPv6(`${head}:${tail}`);
  }

  if (raw.includes("::")) {
    const [l, r] = raw.split("::");
    const left = l ? l.split(":") : [];
    const right = r ? r.split(":") : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...new Array(missing).fill("0"), ...right];
  } else {
    groups = raw.split(":");
  }

  if (groups.length !== 8) return null;
  const nums: number[] = [];
  for (const g of groups) {
    if (g.length === 0 || g.length > 4) return null;
    const n = parseInt(g, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
    nums.push(n);
  }
  return nums;
}

function isBlockedIPv6(addr: string): boolean {
  const g = expandIPv6(addr);
  if (!g) return false;

  // ::1 (loopback)
  if (g.every((x, i) => (i < 7 ? x === 0 : x === 1))) return true;
  // :: (unspecified)
  if (g.every((x) => x === 0)) return true;
  // fc00::/7 unique local
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // ff00::/8 multicast
  if ((g[0] & 0xff00) === 0xff00) return true;
  // IPv4-mapped ::ffff:a.b.c.d → check embedded v4
  if (
    g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 &&
    g[4] === 0 && g[5] === 0xffff
  ) {
    const a = (g[6] >> 8) & 0xff;
    const b = g[6] & 0xff;
    const c = (g[7] >> 8) & 0xff;
    const d = g[7] & 0xff;
    return isBlockedIPv4([a, b, c, d]);
  }
  return false;
}

/** Returns true if `host` is an IP literal in a blocked range. */
export function isBlockedIpLiteral(host: string): boolean {
  const bare = stripIPv6Brackets(host);
  if (bare.includes(":")) {
    // IPv6
    return isBlockedIPv6(bare);
  }
  const v4 = parseLooseIPv4(bare);
  if (v4) return isBlockedIPv4(v4);
  return false;
}

/** Returns true if `host` parses as any IP literal (blocked or not). */
function isIpLiteral(host: string): boolean {
  const bare = stripIPv6Brackets(host);
  if (bare.includes(":")) return expandIPv6(bare) !== null;
  return parseLooseIPv4(bare) !== null;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAME_EXACT.has(h)) return true;
  for (const suf of BLOCKED_HOSTNAME_SUFFIXES) {
    if (h.endsWith(suf)) return true;
  }
  return false;
}

/**
 * Validate a URL for SSRF safety. Returns the normalized URL plus a
 * `dnsChecked` flag. Throws SsrfError on any block.
 *
 * NOTE: Phase 4A. No network fetch happens here. Phase 4B must additionally
 * re-resolve DNS and re-check IPs at connect time on every redirect hop.
 */
export async function assertSafeUrl(
  input: string,
  opts: AssertSafeOpts = {},
): Promise<SafeUrl> {
  const norm = normalizeUrl(input);

  // Port allowlist
  if (!ALLOWED_PORTS.has(norm.port)) {
    throw new SsrfError("BLOCKED_HOST", { reason: "port_not_allowed" });
  }

  // Hostname suffix blocklist
  if (isBlockedHostname(norm.hostname)) {
    throw new SsrfError("BLOCKED_HOST", { reason: "blocked_hostname" });
  }

  // IP literal check
  if (isIpLiteral(norm.hostname)) {
    if (isBlockedIpLiteral(norm.hostname)) {
      throw new SsrfError("BLOCKED_HOST", { reason: "blocked_ip_literal" });
    }
    // Public IP literal — allow, no DNS step needed.
    return { ...norm, dnsChecked: false };
  }

  // DNS resolution (optional / injectable)
  if (!opts.resolveDns) {
    return { ...norm, dnsChecked: false };
  }

  const settled = await Promise.allSettled([
    opts.resolveDns(norm.hostname, "A"),
    opts.resolveDns(norm.hostname, "AAAA"),
  ]);

  const ips: string[] = [];
  let hardFailures = 0;
  let notCapableCount = 0;
  let usableResponses = 0;

  for (const r of settled) {
    if (r.status === "fulfilled") {
      usableResponses++;
      for (const ip of r.value) ips.push(ip);
    } else {
      if (isDnsNotCapableError(r.reason)) {
        notCapableCount++;
      } else if (isDnsNoRecordsError(r.reason)) {
        usableResponses++; // "no records of this type" is a valid answer
      } else {
        hardFailures++;
      }
    }
  }

  // If runtime refused DNS on both, skip the check (Phase 4A only).
  if (notCapableCount === 2) {
    return { ...norm, dnsChecked: false };
  }

  // If both lookups hard-failed (neither produced a usable answer),
  // we cannot verify safety.
  if (usableResponses === 0 && hardFailures > 0) {
    throw new SsrfError("DNS_RESOLUTION_FAILED");
  }

  for (const ip of ips) {
    if (isBlockedIpLiteral(ip)) {
      throw new SsrfError("BLOCKED_HOST", { reason: "dns_resolves_private" });
    }
  }

  return { ...norm, dnsChecked: true };
}
