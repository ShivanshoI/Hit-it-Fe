// ─── Plan & Subscription API ──────────────────────────────────────────────────
// Wraps all plan/subscription-related backend endpoints.
// Endpoint reference (all authenticated):
//   GET  /api/plans                   → in-memory catalogue
//   GET  /api/user/subscription       → current subscription doc
//   POST /api/subscription/upgrade    → direct upgrade or Stripe checkout URL
//   POST /api/subscription/cancel     → sets cancelAtPeriodEnd: true

import { apiClient } from '../api.jsx';

// ─── Plans Catalogue ──────────────────────────────────────────────────────────
/**
 * GET /api/plans
 * Returns the full plan catalogue (no auth required by server, but we pass it anyway).
 * Shape: [{ id, name, monthlyPrice, yearlyPrice, features: string[], popular: bool }]
 */
export async function getPlans() {
  const body = await apiClient('/api/plans', {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { plans: [...] } }
  if (body?.data?.plans && Array.isArray(body.data.plans)) return body.data.plans;
  // Handle { data: [...] }
  if (Array.isArray(body?.data)) return body.data;
  // Handle [...] directly
  if (Array.isArray(body)) return body;
  return [];
}

// ─── Current Subscription ─────────────────────────────────────────────────────
/**
 * GET /api/user/subscription
 * Returns the user's active subscription document.
 * Shape: { planId, status, billingCycle, currentPeriodEnd, cancelAtPeriodEnd }
 */
export async function getSubscription() {
  const body = await apiClient('/api/user/subscription', {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { subscription: {...} } }
  if (body?.data?.subscription) return body.data.subscription;
  // Handle { data: {...} }
  if (body?.data && !Array.isArray(body.data)) return body.data;
  // Handle {...} directly
  return body ?? null;
}

// ─── Upgrade Plan ─────────────────────────────────────────────────────────────
/**
 * POST /api/subscription/upgrade
 * Body: { planId, billingCycle }
 * Returns: { upgraded: true } for direct upgrades
 *       or { checkoutUrl: "https://..." } when Stripe Checkout is needed.
 */
export async function upgradePlan({ planId, billingCycle }) {
  const body = await apiClient('/api/subscription/upgrade', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ planId, billingCycle }),
  });
  return body.data ?? body;
}

// ─── Cancel Subscription ──────────────────────────────────────────────────────
/**
 * POST /api/subscription/cancel
 * Sets cancelAtPeriodEnd: true on the subscription.
 * The user retains access until currentPeriodEnd.
 */
export async function cancelSubscription() {
  const body = await apiClient('/api/subscription/cancel', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
  return body.data ?? body;
}
