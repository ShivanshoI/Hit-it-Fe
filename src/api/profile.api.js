// ─── Profile API ──────────────────────────────────────────────────────────────
// Wraps all profile-related backend endpoints.
// Endpoint reference (all authenticated):
//   GET  /api/user/me/stats   → { totalCollections, requestsSent, teamsJoined }
//   GET  /api/user/activity   → [{ id, type, description, createdAt }]
//   PUT  /api/user/profile    → updates name / email / theme
//   PUT  /api/user/password   → verifies current pw, sets new one
//   DELETE /api/user/sessions → sign-out all devices (stub on server)

import { apiClient } from '../api.jsx';

// ─── Stats ────────────────────────────────────────────────────────────────────
/**
 * GET /api/user/me/stats
 * Returns { totalCollections, requestsSent, teamsJoined }
 */
export async function getProfileStats() {
  const body = await apiClient('/api/user/me/stats', {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { stats: {...} } }
  if (body?.data?.stats) return body.data.stats;
  // Handle { data: {...} }
  return body.data ?? body;
}

// ─── Recent Activity ──────────────────────────────────────────────────────────
/**
 * GET /api/user/activity
 * Returns an array of activity events.
 * Each event: { id, type, description, createdAt }
 */
export async function getRecentActivity() {
  const body = await apiClient('/api/user/activity', {
    method: 'GET',
    auth: true,
  });

  // Handle { data: { activity: [...] } }
  let items = body?.data?.activity;
  // Handle { data: [...] }
  if (!items) items = body?.data;
  // Handle [...] directly
  if (!items) items = body;

  const activityArray = Array.isArray(items) ? items : [];

  // Map backend shape → UI shape expected by ProfilePage
  return activityArray.map((ev) => ({
    id: ev.id,
    title: ev.description ?? ev.type ?? 'Activity',
    time: formatRelativeTime(ev.createdAt),
    icon: iconForType(ev.type),
  }));
}

// ─── Update Profile ───────────────────────────────────────────────────────────
/**
 * PUT /api/user/profile
 * Body: { name, email, theme }
 * 409 if email already taken.
 */
export async function updateProfile({ name, email, theme }) {
  const body = await apiClient('/api/user/profile', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ name, email, theme }),
  });
  return body.data;
}

// ─── Update Password ──────────────────────────────────────────────────────────
/**
 * PUT /api/user/password
 * Body: { currentPassword, newPassword }
 * 401 if currentPassword is wrong; 400 if newPassword < 8 chars.
 */
export async function updatePassword({ currentPassword, newPassword }) {
  const body = await apiClient('/api/user/password', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return body.data;
}

// ─── Sign Out All Devices ─────────────────────────────────────────────────────
/**
 * DELETE /api/user/sessions
 * Note: server stub – existing JWTs remain valid until natural expiry.
 */
export async function signOutAllDevices() {
  const body = await apiClient('/api/user/sessions', {
    method: 'DELETE',
    auth: true,
  });
  return body;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const nowMs = Date.now();
  const diffMs = nowMs - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays} days ago`;
  return then.toLocaleDateString();
}

function iconForType(type) {
  const map = {
    collection_created:  '📁',
    request_sent:        '🚀',
    team_joined:         '🤝',
    profile_updated:     '⚙️',
    password_changed:    '🔐',
    collection_shared:   '🔗',
    collaborator_added:  '👥',
  };
  return map[type] ?? '⚡';
}
