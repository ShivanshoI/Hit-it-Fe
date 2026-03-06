import React, { useState, useEffect } from 'react';
import './ManageBillingPage.css';
import { getPaymentMethod, getBillingInfo, updateBillingInfo, getInvoices, buildInvoiceDownloadUrl } from '../api/billing.api.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(amount, currency) {
  const amt = (amount ?? 0) / 100; // amounts are often in cents from Stripe
  const curr = (currency ?? 'usd').toUpperCase();
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amt);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageBillingPage({ onBack }) {
  const [isLoaded, setIsLoaded]   = useState(false);

  // Payment method
  const [paymentMethod, setPaymentMethod]       = useState(null);
  const [isLoadingPM, setIsLoadingPM]           = useState(true);

  // Billing info + edit state
  const [billingInfo, setBillingInfo]           = useState(null);
  const [isLoadingBI, setIsLoadingBI]           = useState(true);
  const [isEditingBI, setIsEditingBI]           = useState(false);
  const [billingForm, setBillingForm]           = useState({});
  const [isSavingBI, setIsSavingBI]             = useState(false);
  const [biMessage, setBiMessage]               = useState({ text: '', type: '' });

  // Invoices
  const [invoices, setInvoices]                 = useState([]);
  const [isLoadingInv, setIsLoadingInv]         = useState(true);

  useEffect(() => {
    setIsLoaded(true);
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchPaymentMethod(),
      fetchBillingInfo(),
      fetchInvoices(),
    ]);
  };

  const fetchPaymentMethod = async () => {
    setIsLoadingPM(true);
    try {
      const data = await getPaymentMethod();
      setPaymentMethod(data);
    } catch (err) {
      console.warn('Failed to fetch payment method:', err);
      setPaymentMethod(null);
    } finally {
      setIsLoadingPM(false);
    }
  };

  const fetchBillingInfo = async () => {
    setIsLoadingBI(true);
    try {
      const data = await getBillingInfo();
      setBillingInfo(data);
      if (data) setBillingForm(data);
    } catch (err) {
      console.warn('Failed to fetch billing info:', err);
      setBillingInfo(null);
    } finally {
      setIsLoadingBI(false);
    }
  };

  const fetchInvoices = async () => {
    setIsLoadingInv(true);
    try {
      const data = await getInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch invoices:', err);
      setInvoices([]);
    } finally {
      setIsLoadingInv(false);
    }
  };

  const handleBillingFormChange = (field, value) => {
    setBillingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBillingInfoSave = async (e) => {
    e.preventDefault();
    setIsSavingBI(true);
    setBiMessage({ text: '', type: '' });
    try {
      const updated = await updateBillingInfo(billingForm);
      setBillingInfo(updated ?? billingForm);
      setIsEditingBI(false);
      setBiMessage({ text: 'Billing information updated.', type: 'success' });
      setTimeout(() => setBiMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setBiMessage({ text: err.message || 'Failed to update billing info.', type: 'error' });
    } finally {
      setIsSavingBI(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`mbp-root ${isLoaded ? 'mbp-loaded' : ''}`}>
      {/* Background Ambience */}
      <div className="mbp-glow mbp-glow-primary"></div>
      
      <div className="mbp-container">
        
        {/* Header */}
        <div className="mbp-header glass-panel">
          <button className="mbp-btn-back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Plans
          </button>
          <h2>Manage Billing &amp; Subscription</h2>
        </div>

        {/* ── Payment Method ────────────────────────────────────── */}
        <div className="mbp-card glass-panel" style={{ animationDelay: '0.1s' }}>
          <div className="mbp-card-header">
            <h3>Payment Method</h3>
          </div>
          {isLoadingPM ? (
            <div className="mbp-skeleton-row" />
          ) : paymentMethod ? (
            <div className="mbp-payment-method">
              <div className="mbp-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div className="mbp-card-details">
                <h4>{paymentMethod.brand ? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1) : 'Card'} ending in {paymentMethod.last4 ?? '••••'}</h4>
                <p>
                  {paymentMethod.expMonth && paymentMethod.expYear
                    ? `Expires ${String(paymentMethod.expMonth).padStart(2, '0')}/${String(paymentMethod.expYear).slice(-2)} • `
                    : ''}
                  Default payment method
                </p>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
              No payment method on file.
            </div>
          )}
        </div>

        {/* ── Billing Information ───────────────────────────────── */}
        <div className="mbp-card glass-panel" style={{ animationDelay: '0.2s' }}>
          <div className="mbp-card-header">
            <h3>Billing Information</h3>
            {!isEditingBI && (
              <button className="mbp-btn-ghost" onClick={() => { setIsEditingBI(true); if (billingInfo) setBillingForm(billingInfo); }}>
                Edit Details
              </button>
            )}
          </div>

          {biMessage.text && (
            <div style={{
              padding: '0.7rem 1rem',
              marginBottom: '0.8rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              background: biMessage.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${biMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: biMessage.type === 'success' ? '#10b981' : '#ef4444',
            }}>
              {biMessage.text}
            </div>
          )}

          {isLoadingBI ? (
            <div className="mbp-skeleton-block" />
          ) : isEditingBI ? (
            <form onSubmit={handleBillingInfoSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {[
                ['companyName',  'Company / Full Name'],
                ['addressLine1', 'Address Line 1'],
                ['addressLine2', 'Address Line 2 (optional)'],
                ['city',         'City'],
                ['state',        'State / Province'],
                ['postalCode',   'Postal Code'],
                ['country',      'Country'],
                ['taxId',        'VAT / Tax ID (optional)'],
              ].map(([field, label]) => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{label}</label>
                  <input
                    type="text"
                    value={billingForm[field] ?? ''}
                    onChange={e => handleBillingFormChange(field, e.target.value)}
                    className="pp-input"
                    placeholder={label}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" className="pp-btn-primary" disabled={isSavingBI}>
                  {isSavingBI ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="mbp-btn-ghost"
                  onClick={() => { setIsEditingBI(false); setBiMessage({ text: '', type: '' }); }}
                  style={{ padding: '0.6rem 1.2rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : billingInfo ? (
            <div className="mbp-address-details">
              {billingInfo.companyName  && <p><strong>{billingInfo.companyName}</strong></p>}
              {billingInfo.addressLine1 && <p>{billingInfo.addressLine1}</p>}
              {billingInfo.addressLine2 && <p>{billingInfo.addressLine2}</p>}
              {(billingInfo.city || billingInfo.state || billingInfo.postalCode) && (
                <p>{[billingInfo.city, billingInfo.state, billingInfo.postalCode].filter(Boolean).join(', ')}</p>
              )}
              {billingInfo.country      && <p>{billingInfo.country}</p>}
              {billingInfo.taxId        && <p className="mbp-tax-id">VAT/Tax ID: {billingInfo.taxId}</p>}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No billing information on file.</div>
          )}
        </div>

        {/* ── Invoice History ───────────────────────────────────── */}
        <div className="mbp-card glass-panel" style={{ animationDelay: '0.3s' }}>
          <div className="mbp-card-header">
            <h3>Invoice History</h3>
          </div>
          {isLoadingInv ? (
            <div className="mbp-skeleton-block" />
          ) : invoices.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
              No invoices yet. They will appear here after your first billing cycle.
            </div>
          ) : (
            <div className="mbp-invoice-list">
              {invoices.map((inv, idx) => {
                const statusClass = (inv.status ?? 'paid').toLowerCase();
                return (
                  <div key={inv.id ?? idx} className="mbp-invoice-item">
                    <div className="mbp-invoice-info">
                      <h4>{formatDate(inv.createdAt)}</h4>
                      <p>{inv.invoiceNumber ?? inv.id}</p>
                    </div>
                    <div className="mbp-invoice-status">
                      <span className={`mbp-badge mbp-badge-${statusClass}`}>
                        {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Paid'}
                      </span>
                      <strong className="mbp-invoice-amount">
                        {formatAmount(inv.amount, inv.currency)}
                      </strong>
                      <a
                        href={buildInvoiceDownloadUrl(inv.id)}
                        className="mbp-btn-icon"
                        title="Download PDF"
                        target="_blank"
                        rel="noreferrer"
                        download
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
