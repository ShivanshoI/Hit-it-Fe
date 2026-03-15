/**
 * Mock API for Variable Definitions
 * Persisted in localStorage for functional behavior
 */

const STORAGE_KEY = 'hitit_mock_variables';

const INITIAL_VARS = [
  {
    id: 1, key: 'auth_token', category: 'auth', secret: true, description: 'JWT bearer for all requests', tags: ['auth', 'jwt'],
    values: { dev: 'eyJhbGciOiJIUzI1NiJ9.dev_token', staging: 'eyJhbGciOiJIUzI1NiJ9.staging_token', prod: 'eyJhbGciOiJIUzI1NiJ9.prod_token' },
  },
  {
    id: 2, key: 'base_url', category: 'api', secret: false, description: 'Root API endpoint', tags: ['url'],
    values: { dev: 'https://dev.api.hitit.io', staging: 'https://staging.api.hitit.io', prod: 'https://api.hitit.io' },
  },
];

function getStored() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : INITIAL_VARS;
}

function saveStored(vars) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
}

export async function getVariables() {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 300));
  return getStored();
}

export async function createVariable(payload) {
  await new Promise(r => setTimeout(r, 300));
  const vars = getStored();
  const newVar = { ...payload, id: Date.now() };
  vars.push(newVar);
  saveStored(vars);
  return newVar;
}

export async function updateVariable(id, payload) {
  await new Promise(r => setTimeout(r, 300));
  const vars = getStored();
  const index = vars.findIndex(v => v.id === id);
  if (index === -1) throw new Error('Variable not found');
  vars[index] = { ...vars[index], ...payload };
  saveStored(vars);
  return vars[index];
}

export async function deleteVariable(id) {
  await new Promise(r => setTimeout(r, 300));
  const vars = getStored();
  const filtered = vars.filter(v => v.id !== id);
  saveStored(filtered);
  return { success: true };
}
