import { apiClient } from '../api';

/**
 * Fetch all collections for the user
 * GET /api/collections
 */
export async function getCollections(page = 1, limit = 10) {
  const body = await apiClient(`/api/collections?page=${page}&limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
  return body.data;
}

/**
 * Fetch a single collection by ID (with its full requests)
 * GET /api/collections/:id
 */
export async function getCollection(id) {
  const body = await apiClient(`/api/collections/${id}`, {
    method: 'GET',
    auth: true,
  });
  return body.data;
}

/**
 * Create a new collection
 * POST /api/collections
 */
export async function createCollection(payload) {
  const body = await apiClient('/api/collections', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * Update an existing collection
 * PUT /api/collections/:id
 */
export async function updateCollection(id, payload) {
  const body = await apiClient(`/api/collections/${id}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * Delete a collection
 * DELETE /api/collections/:id
 */
export async function deleteCollection(id) {
  const body = await apiClient(`/api/collections/${id}`, {
    method: 'DELETE',
    auth: true,
  });
  return body.data;
}

/**
 * Toggle favourite status of a collection
 * PATCH /api/collections/:id/favorite
 */
export async function toggleFavoriteCollection(id, isFavorite) {
  const body = await apiClient(`/api/collections/${id}/favorite`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ favorite: isFavorite }),
  });
  return body.data;
}
