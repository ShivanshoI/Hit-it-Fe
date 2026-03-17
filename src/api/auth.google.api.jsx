import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { apiClient, tokenStore } from '../api';
import { normaliseUser } from './auth.api';

/**
 * handleGoogleAuthResult(result)
 * 
 * Takes a Firebase Auth result (from popup or redirect)
 * and performs the backend handshake.
 */
async function handleGoogleAuthResult(result) {
  if (!result?.user) return null;

  const idToken = await result.user.getIdToken();

  const body = await apiClient('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  });

  if (body.data.is_new_user) {
    return {
      isNewUser: true,
      googleProfile: body.data.google_profile,
      idToken,
    };
  }

  const { user: rawUser, token } = body.data;
  tokenStore.set(token);

  return {
    user: normaliseUser(rawUser),
    token,
  };
}

/**
 * signInWithGoogle()
 *
 * Chooses between Popup and Redirect based on browser restrictions.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await handleGoogleAuthResult(result);
  } catch (err) {
    if (
      err.code === 'auth/cancelled-popup-request' ||
      err.code === 'auth/popup-closed-by-user'
    ) {
      return null; // User cancelled, no action needed
    }
    if (err.code === 'auth/popup-blocked') {
      // Browser blocked popup → fall back to redirect silently
      await signInWithRedirect(auth, googleProvider);
      return { type: 'redirecting' };
    }
    throw err; // Any other error, bubble up
  }
}

/**
 * getGoogleRedirectResult()
 * 
 * Checks if the user just returned from a Google redirect and processes it.
 */
export async function getGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return await handleGoogleAuthResult(result);
  } catch (err) {
    console.error("Redirect auth error:", err);
    throw err;
  }
}

/**
 * createGoogleAccount()
 *
 * Finalizes Google signup by providing user details.
 */
export async function createGoogleAccount(payload) {
  const body = await apiClient('/api/auth/google/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const { user: rawUser, token } = body.data;
  tokenStore.set(token);

  return {
    user: normaliseUser(rawUser),
    token,
  };
}
