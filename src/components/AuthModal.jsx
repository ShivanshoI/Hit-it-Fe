import { useState, useEffect } from 'react';
import { signIn, signUp } from '../api/auth.api';
import { signInWithGoogle } from '../api/auth.google.api';
import { ApiError } from '../api';
import './AuthModal.css';



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
export default function AuthModal({ onClose, onSuccess }) {
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [loginErr, setLoginErr] = useState({});

  const [regForm, setRegForm] = useState({ firstName: '', lastName: '', email: '', phone: '', nickname: '' });
  const [regErr, setRegErr] = useState({});


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

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { user } = await signInWithGoogle();
      setLoading(false);
      setView('login-success');
      setTimeout(() => onSuccess(user), 1500);
    } catch (err) {
      console.error(err);
      setLoading(false);
      if (err instanceof ApiError) {
        setLoginErr({ server: err.message });
      } else {
        setLoginErr({ server: err.message || 'Google Auth failed' });
      }
      setView('login-fail');
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const e = {};
    if (!loginForm.identifier.trim()) e.identifier = 'Required';
    if (!loginForm.password) e.password = 'Required';
    if (Object.keys(e).length) { setLoginErr(e); return; }
    setLoginErr({});
    setLoading(true);
    
    try {
      const { user } = await signIn({ 
        emailAddress: loginForm.identifier, 
        password: loginForm.password 
      });
      setLoading(false);
      setView('login-success'); 
      setTimeout(() => onSuccess(user), 1500);
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        setLoginErr({ server: err.message });
      }
      setView('login-fail');
    }
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

    try {
      const { user } = await signUp(regForm);
      setLoading(false);
      setView('reg-success');
      setTimeout(() => onSuccess(user), 1800);
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        setRegErr({ server: err.message });
      } else {
        setRegErr({ server: 'Something went wrong. Please try again.' });
      }
      setView('reg-fail');
    }
  };

  const goReg = () => { setRegErr({}); setView('reg-1'); setShowEmail(false); };
  const goLogin = () => { setLoginErr({}); setView('login'); setShowEmail(false); };

  const googleIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      <path fill="none" d="M1 1h22v22H1z"/>
    </svg>
  );

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
            
            {!showEmail ? (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', marginTop: '1rem' }}>
                <button 
                  className="am-btn am-btn--primary" 
                  onClick={handleGoogleAuth} 
                  disabled={loading}
                  style={{ background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {loading ? <span className="am-spin" /> : <>{googleIcon} Continue with Google</>}
                </button>
                <div className="am-divider" style={{ margin: '1rem 0', width: '100%' }}><span>or</span></div>
                <button className="am-btn am-btn--ghost" onClick={() => setShowEmail(true)}>Use Email / Password</button>
              </div>
            ) : (
              <>
                <Field label="Email or Username" required placeholder="you@example.com"
                  value={loginForm.identifier} onChange={(v) => setLoginForm({ ...loginForm, identifier: v })}
                  error={loginErr.identifier} autoFocus />
                <Field label="Password" required type="password" placeholder="••••••••"
                  value={loginForm.password} onChange={(v) => setLoginForm({ ...loginForm, password: v })}
                  error={loginErr.password} />
                <button className="am-btn am-btn--primary" onClick={handleLogin} disabled={loading}>
                  {loading ? <span className="am-spin" /> : 'Login'}
                </button>
              </>
            )}
            
            <div className="am-divider" style={{ marginTop: '1.5rem' }}><span>or</span></div>
            <button className="am-btn am-btn--ghost" onClick={goReg}>Create an Account</button>
          </div>
        )}

        {/* ── LOGIN FAIL ─────────────────────────────────────────────────── */}
        {view === 'login-fail' && (
          <div className="am-view am-view--status" key="login-fail">
            <div className="am-status-icon am-status-icon--fail">✕</div>
            <h2 className="am-title">Login Failed</h2>
            <p className="am-sub">{loginErr.server || "We couldn't verify your credentials."}<br />Want to create a new account instead?</p>
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
            {!showEmail ? (
              <>
                <h2 className="am-title">Create Account</h2>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', marginTop: '1rem' }}>
                  <button 
                    className="am-btn am-btn--primary" 
                    onClick={handleGoogleAuth} 
                    disabled={loading}
                    style={{ background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {loading ? <span className="am-spin" /> : <>{googleIcon} Continue with Google</>}
                  </button>
                  <div className="am-divider" style={{ margin: '1rem 0', width: '100%' }}><span>or</span></div>
                  <button className="am-btn am-btn--ghost" onClick={() => setShowEmail(true)}>Sign up with Email</button>
                  <div className="am-divider" style={{ marginTop: '1.5rem', width: '100%' }}></div>
                  <button className="am-btn am-btn--ghost" onClick={goLogin}>← Back to Login</button>
                </div>
              </>
            ) : (
              <>
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
                <button className="am-btn am-btn--ghost" onClick={goLogin}>← Back to Login</button>
              </>
            )}
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