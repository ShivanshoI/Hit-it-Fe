import { apiClient } from '../api'; 

export async function importCollaborators(payload) {
  const response = await apiClient('/api/collaborators/import', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return response?.data || response;
}

export async function exportCollaborators(payload) {
  const response = await apiClient('/api/collaborators/export', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  return response?.data || response;
}
export async function getCollaborators(masterID) {
  const response = await apiClient(`/api/collaborators/${masterID}`, {
    method: 'GET',
    auth: true,
  });
  return response?.data || response;
}
