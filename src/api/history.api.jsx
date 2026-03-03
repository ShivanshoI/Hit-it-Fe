import { apiClient } from '../api';

/**
 * Fetch all previous executions for the logged-in user
 * GET /api/history
 */
export async function getHistory() {
  const body = await apiClient('/api/history', {
    method: 'GET',
    auth: true,
  });
  return body.data; // Assuming the array is deeply wrapped in data, verify or adjust later
}
