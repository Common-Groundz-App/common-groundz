import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

// Rate limit configuration
const RATE_LIMITS: Record<string, { maxAttempts: number; windowSeconds: number; blockSeconds: number }> = {
  login: { maxAttempts: 5, windowSeconds: 60, blockSeconds: 300 },
  signup: { maxAttempts: 3, windowSeconds: 300, blockSeconds: 900 },
  password_reset: { maxAttempts: 3, windowSeconds: 300, blockSeconds: 600 },
  resend_verification: { maxAttempts: 2, windowSeconds: 60, blockSeconds: 300 },
};

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      }
    );

    const result = await response.json();
    console.log("Turnstile verification result:", result.success);
    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
  action: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = RATE_LIMITS[action];
  if (!config) {
    console.log(`No rate limit config for action: ${action}`);
    return { allowed: true };
  }

  const now = new Date();

  try {
    // Check for existing record
    const { data: existing, error: selectError } = await supabase
      .from("auth_rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("action", action)
      .maybeSingle();

    if (selectError) {
      console.error("Rate limit check error:", selectError);
      // Allow on error to not block legitimate users
      return { allowed: true };
    }

    if (existing) {
      // Check if currently blocked
      if (existing.blocked_until && new Date(existing.blocked_until) > now) {
        const retryAfter = Math.ceil(
          (new Date(existing.blocked_until).getTime() - now.getTime()) / 1000
        );
        console.log(`Rate limited: ${identifier} for ${action}, retry after ${retryAfter}s`);
        return { allowed: false, retryAfter };
      }

      // Check if window has expired
      const windowStart = new Date(existing.window_start);
      const windowEnd = new Date(windowStart.getTime() + config.windowSeconds * 1000);

      if (now > windowEnd) {
        // Reset window
        await supabase
          .from("auth_rate_limits")
          .update({
            attempt_count: 1,
            window_start: now.toISOString(),
            blocked_until: null,
          })
          .eq("id", existing.id);
        console.log(`Rate limit window reset for ${identifier} on ${action}`);
        return { allowed: true };
      }

      // Increment attempt count
      const newCount = existing.attempt_count + 1;

      if (newCount > config.maxAttempts) {
        // Block the identifier
        const blockedUntil = new Date(now.getTime() + config.blockSeconds * 1000);
        await supabase
          .from("auth_rate_limits")
          .update({
            attempt_count: newCount,
            blocked_until: blockedUntil.toISOString(),
          })
          .eq("id", existing.id);
        console.log(`Rate limit exceeded: ${identifier} blocked for ${action} until ${blockedUntil}`);
        return { allowed: false, retryAfter: config.blockSeconds };
      }

      // Update attempt count
      await supabase
        .from("auth_rate_limits")
        .update({ attempt_count: newCount })
        .eq("id", existing.id);
      console.log(`Rate limit attempt ${newCount}/${config.maxAttempts} for ${identifier} on ${action}`);
      return { allowed: true };
    }

    // Create new record
    await supabase.from("auth_rate_limits").insert({
      identifier,
      action,
      attempt_count: 1,
      window_start: now.toISOString(),
    });
    console.log(`Rate limit tracking started for ${identifier} on ${action}`);
    return { allowed: true };
  } catch (error) {
    console.error("Rate limit processing error:", error);
    // Allow on error to not block legitimate users
    return { allowed: true };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Create service role client for rate limiting table access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, turnstileToken, ...authData } = body;

    console.log(`Auth gateway request: action=${action}`);

    // Get client IP from headers
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    console.log(`Client IP: ${clientIP}`);

    // Check rate limit
    const rateCheck = await checkRateLimit(supabaseAdmin, clientIP, action);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many attempts. Please try again later.",
          retryAfter: rateCheck.retryAfter,
          code: "RATE_LIMITED",
        }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Retry-After": String(rateCheck.retryAfter || 60),
          },
        }
      );
    }

    // Verify Turnstile for signup
    if (action === "signup") {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({
            error: "Security verification required. Please try again.",
            code: "CAPTCHA_REQUIRED",
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      const isValidCaptcha = await verifyTurnstileToken(turnstileToken);
      if (!isValidCaptcha) {
        return new Response(
          JSON.stringify({
            error: "Security verification failed. Please refresh and try again.",
            code: "CAPTCHA_FAILED",
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create anon client for auth operations
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Forward to Supabase Auth based on action
    let result;

    switch (action) {
      case "signup": {
        const { email, password, options } = authData;
        result = await supabaseAuth.auth.signUp({
          email,
          password,
          options,
        });

        // Detect existing user: Supabase returns fake success with empty identities
        if (!result.error && result.data?.user?.identities?.length === 0) {
          console.log(`Signup detected existing user for action: ${action}`);
          return new Response(
            JSON.stringify({
              error: "User already registered",
              code: "USER_EXISTS",
            }),
            {
              status: 409,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        break;
      }

      case "login": {
        const { email, password } = authData;
        result = await supabaseAuth.auth.signInWithPassword({
          email,
          password,
        });
        break;
      }

      case "password_reset": {
        const { email, redirectTo } = authData;
        result = await supabaseAuth.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        break;
      }

      case "resend_verification": {
        const { email, redirectTo } = authData;
        result = await supabaseAuth.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: redirectTo },
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action", code: "INVALID_ACTION" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
    }

    if (result.error) {
      console.log(`Auth error for ${action}:`, result.error.message);
      return new Response(
        JSON.stringify({
          error: result.error.message,
          code: result.error.status?.toString() || "AUTH_ERROR",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Auth success for ${action}`);
    return new Response(
      JSON.stringify({ data: result.data }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Auth gateway error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred. Please try again.",
        code: "INTERNAL_ERROR",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
