import { useState } from 'react';
import './DevPanel.css';

const VIEWS = [
  { group: 'Login', key: 'loginView', options: [
    { label: 'Default',      value: 'login' },
    { label: 'Success →',    value: 'login-success' },
    { label: 'Fail →',       value: 'login-fail' },
  ]},
  { group: 'Register', key: 'registerView', options: [
    { label: 'Step 1',       value: 'reg-1' },
    { label: 'Step 2',       value: 'reg-2' },
    { label: 'Success →',    value: 'reg-success' },
    { label: 'Fail →',       value: 'reg-fail' },
  ]},
];

export default function DevPanel({ config, onChange, onForceView }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`dp ${open ? 'dp--open' : 'dp--closed'}`}>
      <button className="dp-toggle" onClick={() => setOpen(!open)}>
        <span className="dp-toggle-icon">⚙</span>
        {open && <span className="dp-toggle-label">Dev Panel</span>}
        <span className="dp-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="dp-body">
          <p className="dp-note">🔧 Local only · Never ships to prod</p>

          {/* ── Mock result toggles ─────────────────────────────────────────── */}
          <div className="dp-section">
            <span className="dp-section-title">Mock API Results</span>

            <div className="dp-row">
              <span className="dp-label">Login</span>
              <div className="dp-pills">
                {['success','fail'].map(v => (
                  <button
                    key={v}
                    className={`dp-pill ${config.loginResult === v ? (v === 'success' ? 'dp-pill--pass' : 'dp-pill--fail') : ''}`}
                    onClick={() => onChange({ ...config, loginResult: v })}
                  >
                    {v === 'success' ? '✓ Pass' : '✕ Fail'}
                  </button>
                ))}
              </div>
            </div>

            <div className="dp-row">
              <span className="dp-label">Register</span>
              <div className="dp-pills">
                {['success','fail'].map(v => (
                  <button
                    key={v}
                    className={`dp-pill ${config.registerResult === v ? (v === 'success' ? 'dp-pill--pass' : 'dp-pill--fail') : ''}`}
                    onClick={() => onChange({ ...config, registerResult: v })}
                  >
                    {v === 'success' ? '✓ Pass' : '✕ Fail'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Jump to view ────────────────────────────────────────────────── */}
          <div className="dp-section">
            <span className="dp-section-title">Jump to State</span>
            {VIEWS.map(({ group, options }) => (
              <div key={group} className="dp-jump-group">
                <span className="dp-jump-label">{group}</span>
                <div className="dp-jump-btns">
                  {options.map(({ label, value }) => (
                    <button
                      key={value}
                      className="dp-jump-btn"
                      onClick={() => onForceView(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
