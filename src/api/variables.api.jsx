import { apiClient } from '../api';

function scopeHeaders(teamId = null, orgId = null) {
  const headers = {};
  if (orgId)  headers['x-org-id']  = orgId;
  if (teamId) headers['x-team-id'] = teamId;
  return headers;
}

export async function getVariables(teamId = null, orgId = null) {
  const response = await apiClient('/api/globals', {
    method: 'GET',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

export async function createVariable(payload, teamId = null, orgId = null) {
  const response = await apiClient('/api/globals', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

export async function updateVariable(id, payload, teamId = null, orgId = null) {
  const response = await apiClient(`/api/globals/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}

export async function deleteVariable(id, teamId = null, orgId = null) {
  const response = await apiClient(`/api/globals/${id}`, {
    method: 'DELETE',
    auth: true,
    headers: scopeHeaders(teamId, orgId),
  });
  return response.data;
}
