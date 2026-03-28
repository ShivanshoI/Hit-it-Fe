import { apiClient } from '../api';

export async function fetchTestSuiteCollections(teamId) {
  const body = await apiClient('/api/collections?testSuit=true', { method: 'GET', auth: true, teamId });
  const data = body.data;
  return Array.isArray(data) ? data : (data?.collections || []);
}

export async function fetchTestSuiteRequests(collectionId, teamId) {
  const body = await apiClient(`/api/requests/collections/${collectionId}?testSuit=true`, {
    method: 'GET',
    auth: true,
    teamId,
  });
  const data = body.data;
  const requests = Array.isArray(data) ? data : (data?.requests || []);
  // Inject collection_id into each request for later reference
  return requests.map(req => ({ ...req, collection_id: collectionId }));
}

export async function createTestSuiteCollection(payload, teamId) {
  const body = await apiClient('/api/collections', {
    method: 'POST',
    auth: true,
    teamId,
    body: JSON.stringify({ ...payload, testSuit: true }),
  });
  return body.data || body;
}

export async function renameTestSuiteCollection(id, name, teamId) {
  const body = await apiClient(`/api/collections/${id}/mod/?testSuit=true`, {
    method: 'PATCH',
    auth: true,
    teamId,
    body: JSON.stringify({ name })
  });
  return body.data || body;
}

export async function deleteTestSuiteCollection(id, teamId) {
  const body = await apiClient(`/api/collections/${id}?testSuit=true`, {
    method: 'DELETE',
    auth: true,
    teamId,
  });
  return body.data || body;
}

export async function createTestSuiteRequest(collectionId, payload, teamId) {
  const body = await apiClient(`/api/requests?testSuit=true`, {
    method: 'POST',
    auth: true,
    teamId,
    body: JSON.stringify({ ...payload, collection_id: collectionId, testSuit: true }),
  });
  return body.data || body;
}

export async function updateTestSuiteRequest(id, payload, teamId) {
  const body = await apiClient(`/api/requests/${id}?testSuit=true`, {
    method: 'PUT',
    auth: true,
    teamId,
    body: JSON.stringify({ ...payload, testSuit: true }),
  });
  return body.data || body;
}

export async function deleteTestSuiteRequest(id, teamId) {
  const body = await apiClient(`/api/requests/${id}?testSuit=true`, {
    method: 'DELETE',
    auth: true,
    teamId,
  });
  return body.data || body;
}

// ─── Test Suite Execution APIs ──────────────────────────────────────────

export async function runTestSuite(payload, teamId) {
  const body = await apiClient('/api/test-suite/run', {
    method: 'POST',
    auth: true,
    teamId,
    body: JSON.stringify(payload),
  });
  return body.data || body;
}

export async function pollTestSuiteJob(jobId, teamId) {
  const body = await apiClient(`/api/test-suite/jobs/${jobId}`, {
    method: 'GET',
    auth: true,
    teamId,
  });
  return body.data || body;
}

export async function getTestSuiteJobLogs(jobId, teamId) {
  const body = await apiClient(`/api/test-suite/jobs/${jobId}/logs`, {
    method: 'GET',
    auth: true,
    teamId,
  });
  return body.data || body;
}

export async function saveExpectedResponse(requestId, expectedResponse, teamId) {
  const body = await apiClient(`/api/test-suite/requests/${requestId}/expected`, {
    method: 'PATCH',
    auth: true,
    teamId,
    body: JSON.stringify({ expected_response: expectedResponse }),
  });
  return body.data || body;
}

export async function fetchExpectedResponse(requestId, teamId) {
  // Fetching the saved expectation (type: "saved") for diffing
  const body = await apiClient(`/api/request-responses/request/${requestId}?type=saved`, {
    method: 'GET',
    auth: true,
    teamId,
  });
  const data = body.data;
  return Array.isArray(data) ? data : (data?.responses || data?.data || data || []);
}
