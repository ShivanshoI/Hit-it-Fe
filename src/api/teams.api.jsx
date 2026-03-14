import { apiClient } from '../api';

// ─── Scope Header Builder (mirrors homePage.api.js) ───────────────────────────
function scopeHeaders(teamId = null, orgId = null) {
  const headers = {};
  if (orgId)  headers['x-org-id']  = orgId;
  if (teamId) headers['x-team-id'] = teamId;
  return headers;
}

// ─── Teams CRUD ───────────────────────────────────────────────────────────────

export async function getMyTeams(orgId = null) {
  const body = await apiClient('/api/teams', { 
    method: 'GET', 
    auth: true,
    headers: scopeHeaders(null, orgId),
  });
  return body.data;
}

export async function getTeam(id) {
  const body = await apiClient(`/api/teams/${id}`, { method: 'GET', auth: true });
  return body.data;
}

export async function createTeam(payload, orgId = null) {
  const body = await apiClient('/api/teams', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(null, orgId),
  });
  return body.data;
}

export async function updateTeam(id, payload) {
  const body = await apiClient(`/api/teams/${id}`, {
    method: 'PATCH', auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function deleteTeam(id) {
  const body = await apiClient(`/api/teams/${id}`, { method: 'DELETE', auth: true });
  return body.data;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getTeamMembers(id) {
  const body = await apiClient(`/api/teams/${id}/members`, { method: 'GET', auth: true });
  return body.data;
}

export async function removeMember(teamId, userId) {
  const body = await apiClient(`/api/teams/${teamId}/members/${userId}`, {
    method: 'DELETE', auth: true,
  });
  return body.data;
}

export async function updateMemberRole(teamId, userId, role) {
  const body = await apiClient(`/api/teams/${teamId}/members/${userId}`, {
    method: 'PATCH', auth: true,
    body: JSON.stringify({ role }),
  });
  return body.data;
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function inviteByEmail(teamId, emails) {
  const body = await apiClient(`/api/teams/${teamId}/invite`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ emails }),
  });
  return body.data;
}

export async function getInviteLink(teamId) {
  const body = await apiClient(`/api/teams/${teamId}/invite-link`, { method: 'GET', auth: true });
  return body.data;
}

export async function acceptInvite(token) {
  const body = await apiClient(`/api/join-team/${token}`, { method: 'POST', auth: true });
  return body.data;
}

// ─── Team Activity Feed ───────────────────────────────────────────────────────

export async function getTeamFeed(teamId, page = 1, limit = 50) {
  const body = await apiClient(`/api/teams/${teamId}/feed?page=${page}&limit=${limit}`, {
    method: 'GET', auth: true,
  });
  return body.data;
}

export async function sendTeamMessage(teamId, payload) {
  // payload: { type: 'message'|'issue', message, title?, mentions?: [] }
  const body = await apiClient(`/api/teams/${teamId}/feed/send`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function resolveTeamIssue(teamId, feedId) {
  const body = await apiClient(`/api/teams/${teamId}/feed/${feedId}/resolve`, {
    method: 'PATCH', auth: true,
  });
  return body.data;
}