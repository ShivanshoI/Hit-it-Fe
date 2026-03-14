import { apiClient } from '../api';

/**
 * Create a new request
 * POST /api/requests
 */
export async function createCollectionRequest(payload, teamId = null, orgId = null) {
  const body = await apiClient('/api/requests', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

/**
 * Update a request
 * PUT /api/requests/:id
 */
export async function updateCollectionRequest(requestId, payload, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/${requestId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

/**
 * Fetch lightweight summaries of all requests in a collection
 * GET /api/requests/collections/:id
 */
export async function getCollectionRequestsSummary(collectionId, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/collections/${collectionId}`, {
    method: 'GET',
    auth: true,
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

/**
 * Fetch a single request with full details
 * GET /api/requests/:id
 */
export async function getRequestDetails(requestId, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/${requestId}`, {
    method: 'GET',
    auth: true,
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

export async function updateRequestNote(requestId, note, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/${requestId}/modify/note`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ note }),
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

export async function toggleRequestFavorite(requestId, favorite, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/${requestId}/modify/`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ favorite }),
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}

/**
 * Execute a request
 * POST /api/requests/:id/hit
 */
export async function hitRequest(requestId, teamId = null, orgId = null) {
  const body = await apiClient(`/api/requests/${requestId}/hit`, {
    method: 'POST',
    auth: true,
    ...(teamId ? { teamId } : {}),
    ...(orgId ? { orgId } : {}),
  });
  return body.data;
}