import { apiClient } from '../api';

/**
 * Fetch organization details using the orgId.
 * GET /api/orgs/{id}
 */
export async function getOrganizationDetails(orgId) {
  const response = await apiClient(`/api/orgs/${orgId}`, {
    method: 'GET',
    auth: true,
  });
  return response.data || response;
}

/**
 * Verify / Connect user to an organization.
 * POST /api/orgs/{id}/verify
 */
export async function verifyOrganization(orgId) {
  const response = await apiClient(`/api/orgs/${orgId}/verify`, {
    method: 'POST',
    auth: true,
  });
  return response.data || response;
}
