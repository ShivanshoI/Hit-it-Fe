import { useState, useEffect } from 'react';
import './AuthModal.css';

// ─── Mock API ─────────────────────────────────────────────────────────────────
const mockLogin = (identifier, password, result) =>
  new Promise((res) =>
    setTimeout(() => {
      if (result === 'success') {
        res({ success: true, user: { name: identifier.split('@')[0], email: identifier } });
      } else {
        res({ success: false });
      }
    }, 700)
  );

const mockRegister = (data, result) =>
  new Promise((res) =>
    setTimeout(() => {
      if (result === 'success') {
        res({ success: true, user: { name: data.firstName, email: data.email } });
      } else {
        res({ success: false, message: 'This email is already registered.' });
      }
    }, 800)
  );

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, required, optional, type = 'text', placeholder, value, onChange, error, autoFocus }) {
  return (
    <div className="am-field">
      <label>
        {label}
        {required && <span className="am-req"> *</span>}
        {optional && <span className="am-opt"> (optional)</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'error' : ''}
        autoFocus={autoFocus}
      />
      {error && <span className="am-err">{error}</span>}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }) {
  return (
    <div className="am-stepper">
      {['Details', 'Contact'].map((label, i) => (
        <div key={label} className="am-step-wrap">
          <div className={`am-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`am-step-label ${i === step ? 'active' : ''}`}>{label}</span>
          {i < 1 && <div className={`am-step-line ${i < step ? 'done' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, onSuccess, devConfig, forcedView }) {
  // forcedView lets DevPanel jump straight to any state
  const [view, setView] = useState(forcedView || 'login');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [loginErr, setLoginErr] = useState({});

  const [regForm, setRegForm] = useState({ firstName: '', lastName: '', email: '', phone: '', nickname: '' });
  const [regErr, setRegErr] = useState({});

  // Sync if forcedView changes while modal is open
  useEffect(() => {
    if (forcedView) setView(forcedView);
  }, [forcedView]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Esc to close
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const e = {};
    if (!loginForm.identifier.trim()) e.identifier = 'Required';
    if (!loginForm.password) e.password = 'Required';
    if (Object.keys(e).length) { setLoginErr(e); return; }
    setLoginErr({});
    setLoading(true);
    const res = await mockLogin(loginForm.identifier, loginForm.password, devConfig.loginResult);
    setLoading(false);
    res.success ? (() => { setView('login-success'); setTimeout(() => onSuccess(res.user), 1500); })()
                : setView('login-fail');
  };

  // ── Reg step 1 → 2 ───────────────────────────────────────────────────────
  const handleReg1 = () => {
    const e = {};
    if (!regForm.firstName.trim()) e.firstName = 'First name is required';
    if (Object.keys(e).length) { setRegErr(e); return; }
    setRegErr({});
    setView('reg-2');
  };

  // ── Reg submit ────────────────────────────────────────────────────────────
  const handleRegSubmit = async () => {
    const e = {};
    if (!regForm.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(regForm.email)) e.email = 'Enter a valid email';
    if (Object.keys(e).length) { setRegErr(e); return; }
    setRegErr({});
    setLoading(true);
    const res = await mockRegister(regForm, devConfig.registerResult);
    setLoading(false);
    if (res.success) {
      setView('reg-success');
      setTimeout(() => onSuccess(res.user), 1800);
    } else {
      setRegErr({ server: res.message });
      setView('reg-fail');
    }
  };

  const goReg = () => { setRegErr({}); setView('reg-1'); };

  return (
    <div className="am-backdrop" onClick={onClose}>
      <div className="am-modal" onClick={(e) => e.stopPropagation()}>

        <button className="am-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        {/* ── LOGIN ──────────────────────────────────────────────────────── */}
        {view === 'login' && (
          <div className="am-view" key="login">
            <div className="am-logo">HIT<em>IT</em></div>
            <h2 className="am-title">Sign In</h2>
            <p className="am-sub">Good to have you back.</p>
            <Field label="Email or Username" required placeholder="you@example.com"
              value={loginForm.identifier} onChange={(v) => setLoginForm({ ...loginForm, identifier: v })}
              error={loginErr.identifier} autoFocus />
            <Field label="Password" required type="password" placeholder="••••••••"
              value={loginForm.password} onChange={(v) => setLoginForm({ ...loginForm, password: v })}
              error={loginErr.password} />
            <button className="am-btn am-btn--primary" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="am-spin" /> : 'Login'}
            </button>
            <div className="am-divider"><span>or</span></div>
            <button className="am-btn am-btn--ghost" onClick={goReg}>Create an Account</button>
          </div>
        )}

        {/* ── LOGIN FAIL ─────────────────────────────────────────────────── */}
        {view === 'login-fail' && (
          <div className="am-view am-view--status" key="login-fail">
            <div className="am-status-icon am-status-icon--fail">✕</div>
            <h2 className="am-title">Login Failed</h2>
            <p className="am-sub">We couldn't verify your credentials.<br />Want to create a new account instead?</p>
            <button className="am-btn am-btn--primary" onClick={goReg}>Register Now →</button>
            <button className="am-btn am-btn--ghost" onClick={() => setView('login')}>← Try Again</button>
          </div>
        )}

        {/* ── LOGIN SUCCESS ──────────────────────────────────────────────── */}
        {view === 'login-success' && (
          <div className="am-view am-view--status" key="login-success">
            <div className="am-status-icon am-status-icon--success">✓</div>
            <h2 className="am-title">Welcome Back!</h2>
            <p className="am-sub">You're in. Taking you home…</p>
            <div className="am-progress"><div className="am-progress-fill" /></div>
          </div>
        )}

        {/* ── REG STEP 1 ─────────────────────────────────────────────────── */}
        {view === 'reg-1' && (
          <div className="am-view" key="reg-1">
            <div className="am-logo">HIT<em>IT</em></div>
            <Stepper step={0} />
            <h2 className="am-title">About You</h2>
            <div className="am-row">
              <Field label="First Name" required placeholder="Alex"
                value={regForm.firstName} onChange={(v) => setRegForm({ ...regForm, firstName: v })}
                error={regErr.firstName} autoFocus />
              <Field label="Last Name" optional placeholder="Johnson"
                value={regForm.lastName} onChange={(v) => setRegForm({ ...regForm, lastName: v })} />
            </div>
            <Field label="Nickname" optional placeholder="Your handle, e.g. 'ace'"
              value={regForm.nickname} onChange={(v) => setRegForm({ ...regForm, nickname: v })} />
            <button className="am-btn am-btn--primary" onClick={handleReg1}>Next →</button>
            <button className="am-btn am-btn--ghost" onClick={() => setView('login')}>← Back to Login</button>
          </div>
        )}

        {/* ── REG STEP 2 ─────────────────────────────────────────────────── */}
        {view === 'reg-2' && (
          <div className="am-view" key="reg-2">
            <div className="am-logo">HIT<em>IT</em></div>
            <Stepper step={1} />
            <h2 className="am-title">Contact</h2>
            <Field label="Email Address" required type="email" placeholder="you@example.com"
              value={regForm.email} onChange={(v) => setRegForm({ ...regForm, email: v })}
              error={regErr.email} autoFocus />
            <Field label="Phone Number" optional type="tel" placeholder="+91 98765 43210"
              value={regForm.phone} onChange={(v) => setRegForm({ ...regForm, phone: v })} />
            <button className="am-btn am-btn--primary" onClick={handleRegSubmit} disabled={loading}>
              {loading ? <span className="am-spin" /> : 'Create Account'}
            </button>
            <button className="am-btn am-btn--ghost" onClick={() => setView('reg-1')}>← Back</button>
          </div>
        )}

        {/* ── REG SUCCESS ────────────────────────────────────────────────── */}
        {view === 'reg-success' && (
          <div className="am-view am-view--status" key="reg-success">
            <div className="am-status-icon am-status-icon--success">✓</div>
            <h2 className="am-title">You're In!</h2>
            <p className="am-sub">
              Welcome, <strong>{regForm.nickname || regForm.firstName || 'friend'}</strong>!<br />
              Account created. Taking you home…
            </p>
            <div className="am-progress"><div className="am-progress-fill" /></div>
          </div>
        )}

        {/* ── REG FAIL ───────────────────────────────────────────────────── */}
        {view === 'reg-fail' && (
          <div className="am-view am-view--status" key="reg-fail">
            <div className="am-status-icon am-status-icon--fail">✕</div>
            <h2 className="am-title">Registration Failed</h2>
            <p className="am-sub">{regErr.server || 'Something went wrong. Please try again.'}</p>
            <button className="am-btn am-btn--primary" onClick={() => setView('reg-2')}>Try Again</button>
            <button className="am-btn am-btn--ghost" onClick={() => setView('login')}>Back to Login</button>
          </div>
        )}

      </div>
    </div>
  );
}