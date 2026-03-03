import { apiClient } from '../api';

/**
 * Fetch collections with optional filtering and pagination
 * GET /api/collections?filter=...&page=...&limit=...
 */
export async function getCollections(page = 1, limit = 10, filter = '') {
  let url = `/api/collections?page=${page}&limit=${limit}`;
  if (filter) {
    url += `&filter=${filter}`;
  }
  const response = await apiClient(url, {
    method: 'GET',
    auth: true,
  });
  return response.data;
}

/**
 * Fetch a single collection by ID (with its full requests)
 * GET /api/collections/:id
 */
export async function getCollection(id) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'GET',
    auth: true,
  });
  return response.data;
}

/**
 * Create a new collection
 * POST /api/collections
 */
export async function createCollection(payload) {
  const response = await apiClient('/api/collections', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return response.data;
}

/**
 * Update an existing collection
 * PATCH /api/collections/:id/mod/
 */
export async function updateCollection(id, payload) {
  const response = await apiClient(`/api/collections/${id}/mod/`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
  return response.data;
}

/**
 * Delete a collection
 * DELETE /api/collections/:id
 */
export async function deleteCollection(id) {
  const response = await apiClient(`/api/collections/${id}`, {
    method: 'DELETE',
    auth: true,
  });
  return response.data;
}

/**
 * Toggle favourite status of a collection
 * PATCH /api/collections/:id/favorite
 */
export async function toggleFavoriteCollection(id, payload) {
  const response = await apiClient(`/api/collections/${id}/mod/favorite`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
  return response.data;
}

/**
 * Fetch favorite collections
 * GET /api/collections?filter=fav
 */
export async function getFavoriteCollections(page = 1, limit = 10) {
  return getCollections(page, limit, 'fav');
}

/**
 * Fetch shared collections
 * GET /api/collections?filter=share
 */
export async function getSharedCollections(page = 1, limit = 10) {
  return getCollections(page, limit, 'share');
}
