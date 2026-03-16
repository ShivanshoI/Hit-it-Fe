import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp } from '../api/auth.api';
import { signInWithGoogle } from '../api/auth.google.api';
import './RegisterPage.css';


// ─── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  return (
    <div className="reg-steps">
      {['Info', 'Contact', 'Done'].map((label, i) => (
        <div key={label} className={`step ${i <= current ? 'active' : ''}`}>
          <div className="step-dot">{i < current ? '✓' : i + 1}</div>
          <span>{label}</span>
          {i < 2 && <div className={`step-line ${i < current ? 'filled' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showEmail, setShowEmail] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nickname: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | { error: string }

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const response = await signInWithGoogle();
      if (!response) {
        setLoading(false);
        return; // User cancelled or harmless error
      }
      setLoading(false);
      navigate('/home');
    } catch (err) {
      console.error(err);
      setLoading(false);
      setStatus({ error: err.message || 'Google sign up failed' });
    }
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const validateStep0 = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    return e;
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    return e;
  };

  const handleNext = () => {
    if (step === 0) {
      const e = validateStep0();
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    if (step === 1) {
      const e = validateStep1();
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const e = validateStep1();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    try {
      await signUp(form);
      setLoading(false);
      setStatus('success');
    } catch (err) {
      setLoading(false);
      setStatus({ error: err.message || 'Something went wrong' });
    }
  };

  // ─── Success screen ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="reg-root">
        <div className="reg-status-screen success">
          <div className="status-icon">✓</div>
          <h1>You're In!</h1>
          <p>
            Welcome, <strong>{form.nickname || form.firstName}</strong>!<br />
            Your account has been created.
          </p>
          <button className="reg-btn primary" onClick={() => navigate('/home')}>
            Go to Home →
          </button>
        </div>
      </div>
    );
  }

  // ─── Failure screen ──────────────────────────────────────────────────────────
  if (status?.error) {
    return (
      <div className="reg-root">
        <div className="reg-status-screen failure">
          <div className="status-icon">✗</div>
          <h1>Registration Failed</h1>
          <p>{status.error}</p>
          <div className="status-actions">
            <button className="reg-btn secondary" onClick={() => setStatus(null)}>
              Try Again
            </button>
            <button className="reg-btn primary" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-root">
      <div className="reg-noise" />

      <div className="reg-header">
        <span className="reg-logo" onClick={() => navigate('/')}>HIT<span>IT</span></span>
        <button className="reg-back" onClick={() => navigate('/login')}>← Back to Login</button>
      </div>

      <div className="reg-content">
        <div className="reg-card">
          <h1 className="reg-title">Create Account</h1>
          <p className="reg-subtitle">Join the community. It's free.</p>

          {!showEmail ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '2rem' }}>
              <button
                className="reg-btn primary"
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{ marginBottom: '1rem', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
              >
                {loading ? <span className="spinner" /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                    Continue with Google
                  </>
                )}
              </button>
              
              <div style={{ margin: '1.5rem 0', color: 'var(--text-dim)', fontSize: '0.9rem', width: '100%', textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border-color)', zIndex: 1 }}></div>
                <span style={{ position: 'relative', zIndex: 2, background: 'var(--bg-card)', padding: '0 10px' }}>or</span>
              </div>

              <button
                className="reg-btn secondary"
                onClick={() => setShowEmail(true)}
                style={{ width: '100%' }}
              >
                Use Email
              </button>
            </div>
          ) : (
            <>
              <Steps current={step} />

              {/* ── Step 0: Name ──────────────────────────────────────────────────── */}
              {step === 0 && (
                <div className="reg-form">
                  <div className="reg-row">
                    <div className="reg-field">
                      <label>First Name <span className="required">*</span></label>
                      <input
                        type="text"
                        placeholder="Alex"
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        className={errors.firstName ? 'error' : ''}
                        autoFocus
                      />
                      {errors.firstName && <span className="field-error">{errors.firstName}</span>}
                </div>
                <div className="reg-field">
                  <label>Last Name <span className="optional">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="Johnson"
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div className="reg-field">
                <label>Nickname <span className="optional">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Your handle, e.g. 'ace'"
                  value={form.nickname}
                  onChange={(e) => update('nickname', e.target.value)}
                />
              </div>

              <button className="reg-btn primary" onClick={handleNext}>
                Next →
              </button>
            </div>
          )}

          {/* ── Step 1: Contact ───────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="reg-form">
              <div className="reg-field">
                <label>Email Address <span className="required">*</span></label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className={errors.email ? 'error' : ''}
                  autoFocus
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="reg-field">
                <label>Phone Number <span className="optional">(optional)</span></label>
                <input
                  type="tel"
                  placeholder="+91 00000 00000"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>

              <div className="reg-actions">
                <button className="reg-btn secondary" onClick={() => setStep(0)}>
                  ← Back
                </button>
                <button
                  className="reg-btn primary"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : 'Create Account'}
                </button>
              </div>

            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
