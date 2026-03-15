import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { apiClient, tokenStore } from '../api';
import { normaliseUser } from './auth.api';

/**
 * signInWithGoogle()
 *
 * Opens a Google login popup, gets the Firebase ID token,
 * and sends it to our backend to retrieve the native app JWT.
 * 
 * @returns {Promise<{ user: NormalisedUser, token: string }>}
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
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
  
  // Persist token so every subsequent apiClient({ auth: true }) call is authenticated
  tokenStore.set(token);

  return {
    user: normaliseUser(rawUser),
    token,
  };
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
