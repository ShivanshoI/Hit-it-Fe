import { apiClient } from '../api';

// ─── Scope Header Builder (mirrors homePage.api.js) ───────────────────────────
function scopeHeaders(teamId = null, orgId = null) {
  const headers = {};
  if (orgId)  headers['x-org-id']  = orgId;
  if (teamId) headers['x-team-id'] = teamId;
  return headers;
}

/**
 * Fetch all previous executions for the logged-in user.
 * Scope is carried via headers:
 *   personal       → no extra headers
 *   team only      → x-team-id
 *   org only       → x-org-id
 *   org + team     → x-org-id + x-team-id
 *
 * GET /api/history?page=&limit=
 */
export async function getHistory(page = 1, limit = 20, teamId = null, orgId = null) {
  const body = await apiClient(`/api/history?page=${page}&limit=${limit}&source=manual`, {
    method: 'GET',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return body.data;
}