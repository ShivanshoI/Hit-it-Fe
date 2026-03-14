import { apiClient } from '../api';

// ─── Scope Header Builder ─────────────────────────────────────────────────────
/**
 * Builds the extra headers object that carries scope context to the backend.
 *
 * Rules (mirrors the 4-mode contract):
 *   personal          → no headers
 *   team only         → x-team-id
 *   org only          → x-org-id
 *   org + team        → x-org-id  +  x-team-id
 *
 * These are sent as HTTP headers so every middleware/route on the backend
 * can read them from req.headers without touching the query string or body.
 */
function scopeHeaders(teamId = null, orgId = null) {
  const headers = {};
  if (orgId)  headers['x-org-id']  = orgId;
  if (teamId) headers['x-team-id'] = teamId;
  return headers;
}

// ─── Collections CRUD ─────────────────────────────────────────────────────────

/**
 * Fetch collections with optional filtering, pagination, and scope.
 * GET /api/collections?page=&limit=&filter=
 */
export async function getCollections(page = 1, limit = 10, filter = '', teamId = null, orgId = null) {
  let url = `/api/collections?page=${page}&limit=${limit}`;
  if (filter) url += `&filter=${encodeURIComponent(filter)}`;

  const response = await apiClient(url, {
    method: 'GET',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Fetch a single collection by ID (with its full requests).
 * GET /api/collections/:id
 */
export async function getCollection(id, teamId = null, orgId = null) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'GET',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Create a new collection.
 * POST /api/collections
 */
export async function createCollection(payload, teamId = null, orgId = null) {
  const response = await apiClient('/api/collections', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Update an existing collection.
 * PATCH /api/collections/:id/mod/
 */
export async function updateCollection(id, payload, teamId = null, orgId = null) {
  const response = await apiClient(`/api/collections/${id}/mod/`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Delete a collection.
 * DELETE /api/collections/:id
 */
export async function deleteCollection(id, teamId = null, orgId = null) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'DELETE',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Toggle favourite status of a collection.
 * PATCH /api/collections/:id/mod/favorite
 */
export async function toggleFavoriteCollection(id, payload, teamId = null, orgId = null) {
  const response = await apiClient(`/api/collections/${id}/mod/favorite`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

/**
 * Fetch favourite collections.
 * GET /api/collections?filter=fav
 */
export async function getFavoriteCollections(page = 1, limit = 10, teamId = null, orgId = null) {
  return getCollections(page, limit, 'fav', teamId, orgId);
}

/**
 * Fetch shared collections.
 * GET /api/collections?filter=share
 */
export async function getSharedCollections(page = 1, limit = 10, teamId = null, orgId = null) {
  return getCollections(page, limit, 'share', teamId, orgId);
}