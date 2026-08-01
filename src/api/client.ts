import config from '../config';
import { ApiEnvelope, TokenResponse } from './types';
import { StoredTokens, saveTokens, loadTokens, clearTokens } from './storage';

/**
 * HTTP client for the Jolly Bakery API.
 *
 * - Injects the bearer access token.
 * - On 401 (or an about-to-expire token) it silently refreshes via the
 *   rotating refresh_token and retries once.
 * - Unwraps the `{ status, data, message }` envelope and throws ApiError on
 *   non-success so React Query can surface it.
 */

export class ApiError extends Error {
  status: number;
  httpStatus?: number;
  constructor(message: string, status: number, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.httpStatus = httpStatus;
  }
}

// In-memory token cache (hydrated from SecureStore on startup).
let tokens: StoredTokens | null = null;
let refreshPromise: Promise<StoredTokens> | null = null;

// Allows AuthContext to react to a forced logout (refresh failed).
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(fn: (() => void) | null) {
  onAuthFailure = fn;
}

export async function hydrateTokens(): Promise<StoredTokens | null> {
  tokens = await loadTokens();
  return tokens;
}

export function getTokens(): StoredTokens | null {
  return tokens;
}

export async function setSession(res: TokenResponse): Promise<StoredTokens> {
  const stored: StoredTokens = {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: Date.now() + res.expires_in * 1000,
  };
  tokens = stored;
  await saveTokens(stored);
  return stored;
}

export async function clearSession(): Promise<void> {
  tokens = null;
  await clearTokens();
}

function url(path: string): string {
  const base = config.baseUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function log(...args: unknown[]) {
  if (config.debug) console.log('[JollyAPI]', ...args);
}

/** Raw token request (login OR refresh). Handles both flat and `{data:{...}}` envelopes. */
export async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const endpoint = url('/api/v1/oauth/token');
  const safeBody = { ...body, password: body.password ? '***' : undefined };
  log('POST', endpoint, safeBody);

  let res: Response;
  let raw = '';
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    raw = await res.text();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    log('NETWORK ERROR', detail);
    throw new ApiError(
      `Can't reach the server (${config.baseUrl}). ${detail}. Check the URL in src/config.ts and your connection.`,
      1
    );
  }

  log('RESPONSE', res.status, raw.slice(0, 500));

  let json: any = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError(`Server returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 140)}`, 1, res.status);
  }

  // Server wraps tokens: { status, statusCode, data: { access_token, ... } }.
  // The documented Postman example was flat, so accept either.
  const payload = json?.data ?? json;
  if (!res.ok || json?.error || !payload?.access_token) {
    // OAuth error may sit at the top level OR nested under `data`.
    const msg =
      payload?.error_description || payload?.error ||
      json?.error_description || json?.error || json?.message || json?.description ||
      `Login failed (HTTP ${res.status}).`;
    throw new ApiError(msg, 1, res.status);
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: Number(payload.expires_in) || 86400,
    token_type: payload.token_type || 'Bearer',
  };
}

async function refreshTokens(): Promise<StoredTokens> {
  if (!tokens?.refreshToken) throw new ApiError('No session', 1, 401);
  // De-dupe concurrent refreshes.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await requestToken({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: tokens!.refreshToken,
      });
      return setSession(res); // stores the newly-rotated refresh_token
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type RequestOpts = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  /** set false for the login call where we have no token yet */
  auth?: boolean;
};

/** Core request → returns unwrapped `data` (or the whole envelope when there's no `data`). */
export async function apiRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', query, body, auth = true } = opts;

  // Proactive refresh if the access token is near expiry.
  if (auth && tokens && tokens.expiresAt - Date.now() < config.tokenRefreshSkewMs) {
    try {
      await refreshTokens();
    } catch {
      /* fall through; the 401 path below will handle a hard failure */
    }
  }

  const doFetch = async (): Promise<Response> => {
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;
    return fetch(url(path) + qs, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  log(method, path, opts.query ?? '');
  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    log('NETWORK ERROR', path, detail);
    throw new ApiError(`Can't reach the server (${config.baseUrl}). ${detail}.`, 1);
  }

  // Retry once after a refresh on 401.
  if (res.status === 401 && auth && tokens?.refreshToken) {
    try {
      await refreshTokens();
      res = await doFetch();
    } catch {
      await clearSession();
      onAuthFailure?.();
      throw new ApiError('Session expired. Please sign in again.', 1, 401);
    }
  }

  const rawText = await res.text().catch(() => '');
  log('RESPONSE', path, res.status, rawText.slice(0, 300));
  let json = {} as ApiEnvelope<T> & Record<string, unknown>;
  try {
    json = rawText ? JSON.parse(rawText) : ({} as any);
  } catch {
    throw new ApiError(`Server returned non-JSON (HTTP ${res.status})`, 1, res.status);
  }

  if (res.status === 401) {
    await clearSession();
    onAuthFailure?.();
    throw new ApiError('Unauthorized', 1, 401);
  }
  // `status` is wildly inconsistent across endpoints: number 0, string "0",
  // or boolean true all mean success. Only a finite non-zero number/string,
  // or boolean false, is a real failure.
  const s: unknown = json.status;
  let logicalError = false;
  if (s === false) {
    logicalError = true;
  } else if (s === true || s === undefined || s === null) {
    logicalError = false;
  } else {
    const n = Number(s);
    logicalError = Number.isFinite(n) && n !== 0;
  }
  if (!res.ok || logicalError) {
    const msg =
      (json.message as string) ||
      (json.description as string) ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, 1, res.status);
  }

  // Prefer the `data` field; some endpoints return top-level fields (e.g. record_collection).
  return (json.data !== undefined ? json.data : (json as unknown)) as T;
}
