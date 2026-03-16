import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../api/auth.api';
import { signInWithGoogle } from '../api/auth.google.api';
import './LoginPage.css';


// ─── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ type, onClose, onRegister }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box ${type}`} onClick={(e) => e.stopPropagation()}>
        {type === 'success' ? (
          <>
            <div className="modal-icon">✓</div>
            <h2>Welcome Back!</h2>
            <p>You've logged in successfully.</p>
            <button className="modal-btn primary" onClick={onClose}>
              Continue →
            </button>
          </>
        ) : (
          <>
            <div className="modal-icon">✗</div>
            <h2>Login Failed</h2>
            <p>We couldn't find your account. Want to create one?</p>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={onClose}>
                Try Again
              </button>
              <button className="modal-btn primary" onClick={onRegister}>
                Register →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'success' | 'failure' | null
  const [errors, setErrors] = useState({});
  const [showEmail, setShowEmail] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const response = await signInWithGoogle();
      if (!response) {
        setLoading(false);
        return; // User cancelled or harmless error
      }
      setLoading(false);
      setModal('success');
    } catch (err) {
      console.error(err);
      setLoading(false);
      setModal('failure');
    }
  };

  const validate = () => {
    const e = {};
    if (!form.identifier.trim()) e.identifier = 'Email or username is required';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleLogin = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    try {
      await signIn({ emailAddress: form.identifier, password: form.password });
      setLoading(false);
      setModal('success');
    } catch (err) {
      setLoading(false);
      setModal('failure');
    }
  };

  const handleModalClose = () => {
    if (modal === 'success') navigate('/home');
    setModal(null);
  };

  return (
    <div className="login-root">
      <div className="login-noise" />
      <div className="login-left">
        <span className="login-logo" onClick={() => navigate('/')}>
          HIT<span>IT</span>
        </span>
        <div className="login-tagline">
          <h2>Track. Compete.<br />Win.</h2>
        </div>
        <div className="login-left-glow" />
      </div>

      <div className="login-right">
        <div className="login-card">
          <h1 className="login-title">Sign In</h1>
          <p className="login-subtitle">Welcome back. Let's get to work.</p>

          <button
            className="login-btn primary"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ marginBottom: '1rem', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {loading ? <span className="spinner" /> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                Continue with Google
              </>
            )}
          </button>
          
          <div className="login-divider">or</div>

          {!showEmail ? (
            <button
              className="login-btn secondary"
              onClick={() => setShowEmail(true)}
            >
              Use Password
            </button>
          ) : (
            <>
              <div className="login-field">
                <label>Email / Username</label>
                <input
                  type="text"
                  placeholder="you@example.com"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  className={errors.identifier ? 'error' : ''}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                {errors.identifier && <span className="field-error">{errors.identifier}</span>}
              </div>

              <div className="login-field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={errors.password ? 'error' : ''}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              <button
                className="login-btn primary"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : 'Login'}
              </button>
            </>
          )}

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              className="login-btn secondary"
              style={{ padding: '0.5rem', border: 'none', background: 'transparent', textDecoration: 'underline' }}
              onClick={() => navigate('/register')}
            >
              Create Account
            </button>
          </div>

        </div>
      </div>

      {modal && (
        <Modal
          type={modal}
          onClose={handleModalClose}
          onRegister={() => { setModal(null); navigate('/register'); }}
        />
      )}
    </div>
  );
}
