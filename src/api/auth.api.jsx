// ─── Auth API ─────────────────────────────────────────────────────────────────
// All authentication-related calls live here.
// Import the named functions you need directly in your components/hooks.

import { apiClient, tokenStore } from '../api';

// ─── Sign In ──────────────────────────────────────────────────────────────────
/**
 * signIn({ emailAddress, password })
 *
 * POST /api/auth/sign-in
 *
 * On success  → stores the JWT, returns a normalised `user` object.
 * On failure  → throws ApiError with server message (e.g. "Invalid email or password.")
 *
 * Success response shape from server:
 * {
 *   success: true,
 *   data: {
 *     user: { id, first_name, last_name, email_address, phone_number, created_at, updated_at },
 *     token: "eyJ..."
 *   }
 * }
 *
 * @param   {{ emailAddress: string, password: string }} credentials
 * @returns {Promise<{ user: NormalisedUser, token: string }>}
 */
export async function signIn({ emailAddress, password }) {
  const body = await apiClient('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({
      identifier: emailAddress,
      password,
    }),
  });

  const { user: rawUser, token } = body.data;

  // Persist token so every subsequent apiClient({ auth: true }) call is authenticated
  tokenStore.set(token);

  // Return a normalised user shape that the rest of the frontend expects
  return {
    user: normaliseUser(rawUser),
    token,
  };
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────
/**
 * signUp(data)
 *
 * POST /api/auth/sign-up
 *
 * @param   {object} userData 
 * @returns {Promise<{ user: NormalisedUser, token: string }>}
 */
export async function signUp({ firstName, lastName, email, phone, nickname, password }) {
  const body = await apiClient('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email_address: email,
      phone_number: phone,
      nick_name: nickname,
      password: password || '0000', // Matches your curl example password
    }),
  });

  const { user: rawUser, token } = body.data || {};

  if (token) {
    tokenStore.set(token);
  }

  return {
    // If the server returns a token but no user, fallback to the requested firstName
    user: rawUser ? normaliseUser(rawUser) : { name: firstName },
    token,
  };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────
/**
 * signOut()
 *
 * Clears the stored token locally.
 * Extend this if your backend has a /api/auth/sign-out endpoint.
 */
export function signOut() {
  tokenStore.remove();
}

// ─── Get Me ───────────────────────────────────────────────────────────────────
/**
 * getMe()
 *
 * GET /api/auth/me
 *
 * Checks the stored token. If valid, returns the user data.
 */
export async function getMe() {
  const token = tokenStore.get();
  if (!token) return null;
  
  const body = await apiClient('/api/auth/me', {
    method: 'GET',
    auth: true,
  });

  return {
    user: normaliseUser(body.data?.user || body.data),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Maps the raw snake_case server user onto the camelCase shape
 * the rest of the app (AuthModal, HomePage sidebar, etc.) already uses.
 *
 * Raw server fields  →  Normalised fields
 * ─────────────────────────────────────────
 * id                 →  id
 * first_name         →  firstName / name  (name = "First Last" for display)
 * last_name          →  lastName
 * email_address      →  email
 * phone_number       →  phoneNumber
 * created_at         →  createdAt
 * updated_at         →  updatedAt
 *
 * @param {object} raw  — user object straight from the server
 * @returns {NormalisedUser}
 */
function normaliseUser(raw) {
  return {
    id:          raw.id,
    firstName:   raw.first_name,
    lastName:    raw.last_name,
    nickName:    raw.nick_name,
    name:        [raw.first_name, raw.last_name].filter(Boolean).join(' '),
    email:       raw.email_address,
    phoneNumber: raw.phone_number,
    createdAt:   raw.created_at,
    updatedAt:   raw.updated_at,
  };
}