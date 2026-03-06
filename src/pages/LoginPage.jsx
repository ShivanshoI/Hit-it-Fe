import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../api/auth.api';
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

          <div className="login-divider">or</div>

          <button
            className="login-btn secondary"
            onClick={() => navigate('/register')}
          >
            Create Account
          </button>

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
