import { apiClient } from '../api';

/**
 * Create a new request
 * POST /api/requests
 */
export async function createCollectionRequest(payload) {
  const body = await apiClient('/api/requests', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * Update a request
 * PATCH /api/requests/:id
 */
export async function updateCollectionRequest(requestId, payload) {
  const body = await apiClient(`/api/requests/${requestId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}
