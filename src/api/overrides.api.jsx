/**
 * Mock API for Collection-Scoped Variable Overrides
 * Scoped by collectionId (conversationId)
 */

const STORAGE_KEY = 'hitit_mock_overrides';

// Initial mocks
const INITIAL_OVERRIDES = {
  // 'collection_id': { key: { env: value } }
};

function getStored() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : INITIAL_OVERRIDES;
}

function saveStored(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function getOverrides(collectionId) {
  await new Promise(r => setTimeout(r, 200));
  const overrides = getStored();
  return overrides[collectionId] || {};
}

export async function saveOverrides(collectionId, payload) {
  await new Promise(r => setTimeout(r, 300));
  const overrides = getStored();
  overrides[collectionId] = payload;
  saveStored(overrides);
  return { success: true };
}
