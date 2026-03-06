import React, { useState, useEffect } from 'react';
import './PlanPage.css';
import ManageBillingPage from './ManageBillingPage';
import { getPlans, getSubscription, upgradePlan, cancelSubscription } from '../api/plan.api.js';

// ─── Icon helpers ─────────────────────────────────────────────────────────────
const PLAN_ICONS = {
  free: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  pro: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  enterprise: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
};

const PLAN_COLORS = {
  free: '#10b981',
  pro: '#6c3fc5',
  enterprise: '#3b82f6',
};

function formatRenewalDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PlanPage({ user }) {
  const [isLoaded, setIsLoaded]             = useState(false);
  const [billingCycle, setBillingCycle]     = useState('yearly');
  const [showManageBilling, setShowManageBilling] = useState(false);

  // Data from backend
  const [plans, setPlans]                   = useState([]);
  const [subscription, setSubscription]     = useState(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingSub, setIsLoadingSub]     = useState(true);
  const [error, setError]                   = useState('');

  // Upgrade/cancel state
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [cancelling, setCancelling]           = useState(false);
  const [actionMessage, setActionMessage]     = useState({ text: '', type: '' });

  useEffect(() => {
    setIsLoaded(true);
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoadingPlans(true);
    setIsLoadingSub(true);
    try {
      const [plansData, subData] = await Promise.all([getPlans(), getSubscription()]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err) {
      console.error('Failed to load plan data:', err);
      setError('Failed to load subscription data. Please refresh.');
    } finally {
      setIsLoadingPlans(false);
      setIsLoadingSub(false);
    }
  };

  // Derive currentPlanId from subscription (fallback to 'free')
  const currentPlanId = subscription?.planId ?? 'free';
  const currentPlanName = (Array.isArray(plans) ? plans : []).find(p => p.id === currentPlanId)?.name ?? 'Starter';

  const handleUpgrade = async (plan) => {
    if (plan.id === currentPlanId) return;
    setUpgradingPlanId(plan.id);
    setActionMessage({ text: '', type: '' });
    try {
      const result = await upgradePlan({ planId: plan.id, billingCycle });
      if (result?.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        setActionMessage({ text: `Successfully upgraded to ${plan.name}!`, type: 'success' });
        await fetchAllData(); // Refresh subscription state
      }
    } catch (err) {
      setActionMessage({ text: err.message || 'Upgrade failed. Please try again.', type: 'error' });
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel your subscription? You'll keep access until the end of your billing cycle.")) return;
    setCancelling(true);
    setActionMessage({ text: '', type: '' });
    try {
      await cancelSubscription();
      setActionMessage({ text: 'Subscription cancelled. You\'ll retain access until the period ends.', type: 'success' });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ text: err.message || 'Cancellation failed. Please try again.', type: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  if (showManageBilling) {
    return <ManageBillingPage onBack={() => setShowManageBilling(false)} />;
  }

  const isLoading = isLoadingPlans || isLoadingSub;

  return (
    <div className={`plan-root ${isLoaded ? 'plan-loaded' : ''}`}>
      {/* Background Ambience */}
      <div className="plan-glow plan-glow-primary"></div>
      <div className="plan-glow plan-glow-secondary"></div>

      <div className="plan-container">
        
        {/* Header Section */}
        <div className="plan-header glass-panel">
          <div className="plan-header-icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="plan-header-text">
            {isLoadingSub ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ height: '1.2rem', width: '14rem', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s infinite' }} />
                <div style={{ height: '0.9rem', width: '20rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
              </div>
            ) : (
              <>
                <h2>Current Plan: <span>{currentPlanName}</span></h2>
                {subscription && subscription.planId !== 'free' && subscription.status !== 'none' ? (
                  subscription.cancelAtPeriodEnd ? (
                    <p>Your subscription is <strong>cancelled</strong> and will expire on <strong>{formatRenewalDate(subscription.currentPeriodEnd)}</strong>.</p>
                  ) : (
                    <p>Your subscription is active and renews automatically on <strong>{formatRenewalDate(subscription.currentPeriodEnd)}</strong>.</p>
                  )
                ) : (
                  <p>You are on the free plan (Starter). Upgrade to unlock professional features and collaboration.</p>
                )}
              </>
            )}
          </div>
          <button className="plan-btn plan-btn-manage" onClick={() => setShowManageBilling(true)}>Manage Billing</button>
        </div>

        {/* Action Message Banner */}
        {actionMessage.text && (
          <div
            className={`plan-action-message plan-action-message-${actionMessage.type}`}
            style={{
              padding: '0.9rem 1.4rem',
              borderRadius: '12px',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: actionMessage.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: actionMessage.type === 'success' ? '#10b981' : '#ef4444',
              fontSize: '0.9rem',
            }}
          >
            {actionMessage.type === 'success' ? '✓ ' : '⚠ '}{actionMessage.text}
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '1rem' }}>{error}</div>
        )}

        {/* Pricing Toggle */}
        <div className="plan-toggle-wrap">
          <div className="plan-toggle glass-panel">
            <button 
              className={`plan-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button 
              className={`plan-toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly
              <span className="plan-badge-save">Save 25%</span>
            </button>
            <div 
              className="plan-toggle-slider" 
              style={{ transform: `translateX(${billingCycle === 'yearly' ? '100%' : '0%'})` }}
            ></div>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="plan-grid">
          {isLoadingPlans ? (
            // Skeleton cards while loading
            [0, 1, 2].map(i => (
              <div key={i} className="plan-card glass-panel" style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0.5, minHeight: '420px' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                  {[80, 120, 60, 60, 140, 50].map((w, j) => (
                    <div key={j} style={{ height: '1rem', width: `${w}%`, borderRadius: '6px', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            (Array.isArray(plans) ? plans : []).map((plan, i) => {
              const isActive      = plan.id === currentPlanId;
              const isPopular     = plan.id === 'pro';
              const color         = PLAN_COLORS[plan.id] ?? '#a07ee8';
              const icon          = PLAN_ICONS[plan.id] ?? PLAN_ICONS.free;
              const monthlyPrice  = plan.monthlyPrice ?? plan.price?.monthly ?? 0;
              const yearlyPrice   = plan.yearlyPrice  ?? plan.price?.yearly  ?? 0;
              const displayPrice  = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
              const features      = plan.features ?? [];

              return (
                <div 
                  key={plan.id} 
                  className={`plan-card glass-panel ${isPopular ? 'plan-card-popular' : ''} ${isActive ? 'plan-card-active' : ''}`}
                  style={{ animationDelay: `${0.2 + (i * 0.1)}s`, '--plan-color': color }}
                >
                  {isPopular && <div className="plan-popular-ribbon">Most Popular</div>}
                  {isActive  && <div className="plan-active-badge">Current Plan</div>}
                  
                  <div className="plan-card-header">
                    <div className="plan-icon" style={{ color, background: `${color}15` }}>
                      {icon}
                    </div>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                  </div>

                  <div className="plan-price">
                    <span className="plan-currency">$</span>
                    <span className="plan-amount">{displayPrice}</span>
                    <span className="plan-period">/ user / mo</span>
                  </div>
                  
                  {billingCycle === 'yearly' && yearlyPrice > 0 && (
                    <div className="plan-billed-yearly">
                      Billed ${(yearlyPrice * 12).toFixed(2)} yearly
                    </div>
                  )}

                  <ul className="plan-features">
                    {features.map((feature, j) => (
                      <li key={j}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="plan-card-footer">
                    <button 
                      className={`plan-btn ${isActive ? 'plan-btn-outline' : 'plan-btn-solid'}`}
                      style={{
                        background: isActive ? 'transparent' : color,
                        borderColor: isActive ? 'currentColor' : color,
                      }}
                      disabled={isActive || upgradingPlanId === plan.id}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {upgradingPlanId === plan.id
                        ? 'Processing...'
                        : isActive
                        ? 'Currently Active'
                        : `Get ${plan.name}`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cancel Subscription (only shown if user has active non-free sub) */}
        {!isLoading && subscription && !subscription.cancelAtPeriodEnd && currentPlanId !== 'free' && (
          <div className="glass-panel" style={{
            marginTop: '2rem',
            padding: '1.5rem 2rem',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <h3 style={{ color: '#ef4444', marginBottom: '0.3rem', fontSize: '1rem' }}>Cancel Subscription</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
                You'll keep access to {currentPlanName} features until <strong>{formatRenewalDate(subscription.currentPeriodEnd)}</strong>.
              </p>
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                padding: '0.65rem 1.4rem',
                borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
