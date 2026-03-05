import { apiClient } from '../api';

/**
 * Fetch activities for a collection
 * GET /api/feed/:collectionId?scope=group|personal
 */
export async function getActivities(collectionId, scope = 'group', page = 1, limit = 20) {
  const body = await apiClient(`/api/feed/${collectionId}?scope=${scope}&page=${page}&limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
  return body.data;
}

/**
 * Send a message or raise an issue
 * POST /api/feed/:collectionId/send
 */
export async function sendActivity(collectionId, payload) {
  const body = await apiClient(`/api/feed/${collectionId}/send`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * Resolve an issue
 * PATCH /api/feed/issue/:id/resolve
 */
export async function resolveIssueApi(activityId, masterId) {
  const body = await apiClient(`/api/feed/issue/${activityId}/resolve?master_id=${masterId}`, {
    method: 'PATCH',
    auth: true,
  });
  return body.data;
}

/**
 * Query the AI assistant
 * POST /api/feed/ai/query
 */
export async function queryAiAssistant(collectionId, payload) {
  const body = await apiClient(`/api/feed/ai/query?master_id=${collectionId}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}
