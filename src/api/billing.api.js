// ─── Billing API ──────────────────────────────────────────────────────────────
// Wraps all billing-related backend endpoints.
// Endpoint reference (all authenticated):
//   GET  /api/billing/payment-method        → card metadata or null
//   PUT  /api/billing/payment-method        → store Stripe pm_xxx token
//   GET  /api/billing/info                  → full billing address
//   PUT  /api/billing/info                  → upsert billing address
//   GET  /api/billing/invoices              → paginated invoice list
//   GET  /api/billing/invoices/{id}/download → redirects to pdfUrl

import { apiClient } from '../api.jsx';

// ─── Payment Method ───────────────────────────────────────────────────────────
/**
 * GET /api/billing/payment-method
 * Returns card metadata or null when none is stored.
 * Shape: { brand, last4, expMonth, expYear } | null
 */
export async function getPaymentMethod() {
  const body = await apiClient('/api/billing/payment-method', {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { paymentMethod: {...} } }
  if (body?.data?.paymentMethod) return body.data.paymentMethod;
  // Handle { data: {...} }
  return body.data ?? body ?? null;
}

/**
 * PUT /api/billing/payment-method
 * Body: { paymentMethodId: "pm_xxx" }
 * Stores the Stripe payment method token.
 * Note: brand/last4 will be placeholder until real Stripe SDK is integrated server-side.
 */
export async function updatePaymentMethod(paymentMethodId) {
  const body = await apiClient('/api/billing/payment-method', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ paymentMethodId }),
  });
  return body.data ?? body;
}

// ─── Billing Info ─────────────────────────────────────────────────────────────
/**
 * GET /api/billing/info
 * Returns full billing address.
 * Shape: { companyName, addressLine1, addressLine2, city, state, postalCode, country, taxId }
 */
export async function getBillingInfo() {
  const body = await apiClient('/api/billing/info', {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { billingInfo: {...} } }
  if (body?.data?.billingInfo) return body.data.billingInfo;
  // Handle { data: {...} }
  return body.data ?? body ?? null;
}

/**
 * PUT /api/billing/info
 * Upserts billing address.
 * Body: { companyName, addressLine1, city, state, postalCode, country, taxId }
 */
export async function updateBillingInfo(payload) {
  const body = await apiClient('/api/billing/info', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
  return body.data ?? body;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
/**
 * GET /api/billing/invoices?page=1&limit=10
 * Returns paginated invoice list.
 * Each invoice: { id, invoiceNumber, amount, currency, status, createdAt, pdfUrl }
 */
export async function getInvoices(page = 1, limit = 20) {
  const body = await apiClient(`/api/billing/invoices?page=${page}&limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
  // Handle { data: { invoices: [...] } }
  let data = body?.data?.invoices;
  // Handle { data: [...] }
  if (!data) data = body?.data;
  // Handle [...] directly
  if (!data) data = body;

  return Array.isArray(data) ? data : [];
}

/**
 * buildInvoiceDownloadUrl(id)
 * Returns the direct download URL which the server will redirect to the stored pdfUrl.
 * Used as an <a href> so the browser handles the redirect natively.
 */
export function buildInvoiceDownloadUrl(invoiceId) {
  return `https://hitit-backend-199827594435.asia-south1.run.app/api/billing/invoices/${invoiceId}/download`;
}
