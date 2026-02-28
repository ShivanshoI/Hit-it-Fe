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
 * PUT /api/requests/:id
 */
export async function updateCollectionRequest(requestId, payload) {
  const body = await apiClient(`/api/requests/${requestId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * Fetch lightweight summaries of all requests in a collection
 * GET /api/requests/collections/:id
 */
export async function getCollectionRequestsSummary(collectionId) {
  const body = await apiClient(`/api/requests/collections/${collectionId}`, {
    method: 'GET',
    auth: true,
  });
  return body.data;
}

/**
 * Fetch a single request with full details
 * GET /api/requests/:id
 */
export async function getRequestDetails(requestId) {
  const body = await apiClient(`/api/requests/${requestId}`, {
    method: 'GET',
    auth: true,
  });
  return body.data;
}

export async function updateRequestNote(requestId, note) {
  const body = await apiClient(`/api/requests/${requestId}/modify/note`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ note }),
  });
  return body.data;
}