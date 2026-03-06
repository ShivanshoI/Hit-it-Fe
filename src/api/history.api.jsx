import { apiClient } from '../api';

/**
 * Fetch all previous executions for the logged-in user (or team when teamId provided)
 * GET /api/history
 */
export async function getHistory(page = 1, limit = 20, teamId = null) {
  const body = await apiClient(`/api/history?page=${page}&limit=${limit}`, {
    method: 'GET',
    auth: true,
    ...(teamId ? { teamId } : {}),
  });
  return body.data;
}
