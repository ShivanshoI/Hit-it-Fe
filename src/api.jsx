// ─── Base API Client ──────────────────────────────────────────────────────────
// Central setup for all HTTP calls to the backend.
// Every feature-specific api file imports `apiClient` from here.

const BASE_URL = 'http://localhost:8080';

// ─── Token helpers ────────────────────────────────────────────────────────────
// Stored once after sign-in; attached automatically to every authenticated call.

export const tokenStore = {
  get:    ()      => localStorage.getItem('auth_token'),
  set:    (token) => localStorage.setItem('auth_token', token),
  remove: ()      => localStorage.removeItem('auth_token'),
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
/**
 * apiClient(endpoint, options)
 *
 * @param {string} endpoint   — e.g. '/api/auth/sign-in'
 * @param {object} options    — same shape as fetch() options + optional `auth` flag
 * @param {boolean} [options.auth=false]  — when true, attaches Bearer token header
 * @returns {Promise<any>}    — parsed JSON body
 * @throws  {ApiError}        — structured error with { message, status, data }
 */
export async function apiClient(endpoint, { auth = false, headers = {}, ...rest } = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
    ...(auth && tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
  };

  const response = await fetch(url, {
    headers: finalHeaders,
    ...rest,
  });

  // Parse JSON regardless of status so we can forward server error messages
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // Throw a structured error — callers decide how to surface it in the UI
    throw new ApiError(
      body?.error?.message || `Request failed with status ${response.status}`,
      response.status,
      body
    );
  }

  return body;
}

// ─── Structured error class ───────────────────────────────────────────────────
export class ApiError extends Error {
  /**
   * @param {string} message  — human-readable reason (from server or fallback)
   * @param {number} status   — HTTP status code
   * @param {any}    data     — raw response body for debugging
   */
  constructor(message, status, data = null) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.data   = data;
  }
}