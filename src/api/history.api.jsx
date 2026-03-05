import { apiClient } from '../api';

/**
 * Fetch all previous executions for the logged-in user
 * GET /api/history
 */
export async function getHistory(page = 1, limit = 20) {
  const body = await apiClient(`/api/history?page=${page}&limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
  return body.data; // Assuming the array is deeply wrapped in data
}
