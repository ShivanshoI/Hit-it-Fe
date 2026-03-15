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

  const { user: rawUser, token } = body.data;
  
  // Persist token so every subsequent apiClient({ auth: true }) call is authenticated
  tokenStore.set(token);

  return {
    user: normaliseUser(rawUser),
    token,
  };
}
