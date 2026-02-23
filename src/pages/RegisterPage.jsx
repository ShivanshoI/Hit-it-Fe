import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RegisterPage.css';

// ─── Mock register ─────────────────────────────────────────────────────────────
function mockRegister(data) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate: fail if email already exists
      if (data.email === 'admin@hitit.com' || data.email === 'test@hitit.com') {
        resolve({ success: false, message: 'This email is already registered.' });
      } else {
        resolve({ success: true });
      }
    }, 900);
  });
}

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
    setLoading(true);
    const result = await mockRegister(form);
    setLoading(false);
    if (result.success) {
      setStatus('success');
    } else {
      setStatus({ error: result.message });
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

              <p className="reg-note">
                ⚠️ Try <code>admin@hitit.com</code> to simulate a failure.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
