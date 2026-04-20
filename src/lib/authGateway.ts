/**
 * Auth Gateway Client
 * 
 * Routes authentication requests through the edge function for rate limiting
 * and CAPTCHA verification (Phase 4 security).
 */

const SUPABASE_URL = "https://uyjtgybbktgapspodajy.supabase.co";
const AUTH_GATEWAY_URL = `${SUPABASE_URL}/functions/v1/auth-gateway`;

export interface AuthGatewayResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  retryAfter?: number;
}

export interface SignUpData {
  email: string;
  password: string;
  options?: {
    emailRedirectTo?: string;
    data?: {
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
}

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResponse {
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
  user: unknown;
}

export interface PasswordResetData {
  email: string;
  redirectTo: string;
}

export interface ResendVerificationData {
  email: string;
  redirectTo: string;
}

async function callAuthGateway<T, D extends object>(
  action: string,
  data: D,
  turnstileToken?: string
): Promise<AuthGatewayResponse<T>> {
  try {
    const response = await fetch(AUTH_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        turnstileToken,
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: result.error || 'Request failed',
        code: result.code,
        retryAfter: result.retryAfter,
      };
    }

    return { data: result.data };
  } catch (error) {
    console.error('Auth gateway error:', error);
    return {
      error: 'Network error. Please check your connection and try again.',
      code: 'NETWORK_ERROR',
    };
  }
}

export async function signUpViaGateway(
  data: SignUpData,
  turnstileToken: string
): Promise<AuthGatewayResponse> {
  return callAuthGateway('signup', data, turnstileToken);
}

export async function loginViaGateway(
  data: LoginData
): Promise<AuthGatewayResponse<LoginResponse>> {
  return callAuthGateway<LoginResponse, LoginData>('login', data);
}

export async function resetPasswordViaGateway(
  data: PasswordResetData
): Promise<AuthGatewayResponse> {
  return callAuthGateway('password_reset', data);
}

export async function resendVerificationViaGateway(
  data: ResendVerificationData
): Promise<AuthGatewayResponse> {
  return callAuthGateway('resend_verification', data);
}

/**
 * Formats rate limit error for display.
 * For signup, hints that the limit is network-level (shared Wi-Fi/NAT)
 * so users on shared connections understand it's not personal.
 */
export function formatRateLimitError(retryAfter?: number, action?: 'signup' | 'login' | 'password_reset' | 'resend_verification'): string {
  const isSignup = action === 'signup';
  const prefix = isSignup ? 'Too many signup attempts from your network.' : 'Too many attempts.';
  const suffix = isSignup ? ' or try from a different connection.' : '';

  if (!retryAfter) {
    return `${prefix} Please try again later${suffix ? ',' + suffix : '.'}`;
  }

  if (retryAfter < 60) {
    return `${prefix} Please try again in ${retryAfter} seconds${suffix ? ',' + suffix : '.'}`;
  }

  const minutes = Math.ceil(retryAfter / 60);
  const minuteStr = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${prefix} Please try again in ${minuteStr}${suffix ? ',' + suffix : '.'}`;
}
