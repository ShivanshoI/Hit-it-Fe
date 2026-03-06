import { apiClient } from '../api';

/**
 * Fetch collections with optional filtering, pagination, and team scope
 * GET /api/collections?filter=...&page=...&limit=...
 */
export async function getCollections(page = 1, limit = 10, filter = '', teamId = null) {
  let url = `/api/collections?page=${page}&limit=${limit}`;
  if (filter) url += `&filter=${filter}`;
  const response = await apiClient(url, {
    method: 'GET',
    auth: true,
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Fetch a single collection by ID (with its full requests)
 * GET /api/collections/:id
 */
export async function getCollection(id, teamId = null) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'GET',
    auth: true,
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Create a new collection (team-scoped when teamId provided)
 * POST /api/collections
 */
export async function createCollection(payload, teamId = null) {
  const response = await apiClient('/api/collections', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Update an existing collection
 * PATCH /api/collections/:id/mod/
 */
export async function updateCollection(id, payload, teamId = null) {
  const response = await apiClient(`/api/collections/${id}/mod/`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Delete a collection
 * DELETE /api/collections/:id
 */
export async function deleteCollection(id, teamId = null) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'DELETE',
    auth: true,
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Toggle favourite status of a collection
 * PATCH /api/collections/:id/mod/favorite
 */
export async function toggleFavoriteCollection(id, payload, teamId = null) {
  const response = await apiClient(`/api/collections/${id}/mod/favorite`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    ...(teamId ? { teamId } : {}),
  });
  return response.data;
}

/**
 * Fetch favorite collections
 * GET /api/collections?filter=fav
 */
export async function getFavoriteCollections(page = 1, limit = 10, teamId = null) {
  return getCollections(page, limit, 'fav', teamId);
}

/**
 * Fetch shared collections
 * GET /api/collections?filter=share
 */
export async function getSharedCollections(page = 1, limit = 10, teamId = null) {
  return getCollections(page, limit, 'share', teamId);
}
