import { apiClient } from '../api';

/**
 * Sends feedback or contact information to the backend.
 * @param {Object} data - The feedback/contact payload.
 * @returns {Promise<Object>} The response from the server.
 */
export async function sendFeedback(data) {
  return apiClient('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true, // Automatically attaches the token if available
  });
}
