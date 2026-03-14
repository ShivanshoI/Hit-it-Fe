import { useState, useRef, useEffect } from 'react';
import { useTeam, PALETTES } from '../context/TeamContext';
import { createTeam, inviteByEmail } from '../api/teams.api';
import './CreateTeamModal.css';

const THEME_OPTIONS = Object.entries(PALETTES).map(([key, val]) => ({
  id: key,
  accent: val.accent,
  label: key.charAt(0).toUpperCase() + key.slice(1),
}));

export default function CreateTeamModal({ onClose, onCreated }) {
  const { isOrgMode, orgId } = useTeam();

  const [name, setName] = useState('');
  const [theme, setTheme] = useState('purple');
  const [description, setDescription] = useState('');
  const [emails, setEmails] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [createdTeam, setCreatedTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Email chip handling
  const addEmail = (value) => {
    const email = (value || emailInput).trim().toLowerCase();
    if (email && email.includes('@') && !emails.includes(email)) {
      setEmails(prev => [...prev, email]);
      setEmailInput('');
    }
  };
  const removeEmail = (email) => setEmails(prev => prev.filter(e => e !== email));

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    } else if (e.key === 'Backspace' && !emailInput && emails.length) {
      setEmails(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 3) return;
    setLoading(true);

    try {
      const newTeam = await createTeam({
        name: name.trim(),
        theme,
        description: description.trim(),
      }, isOrgMode ? orgId : null);

      // If emails provided, send invites
      if (emails.length > 0) {
        await inviteByEmail(newTeam.id, emails);
      }

      setCreatedTeam(newTeam);
      setStep('success');
    } catch (err) {
      console.error('Failed to create team:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdTeam?.invite_link) return;
    try {
      await navigator.clipboard.writeText(createdTeam.invite_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = createdTeam.invite_link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterTeam = () => {
    if (createdTeam) {
      onCreated?.(createdTeam);
    }
    onClose();
  };

  return (
    <div className="ctm-overlay" onClick={onClose}>
      <div className="ctm-modal" onClick={e => e.stopPropagation()}>
        <div className="ctm-header">
          <h2>{step === 'success' ? 'Team Created!' : 'Create Team'}</h2>
          <button className="ctm-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14"/>
            </svg>
          </button>
        </div>

        {step === 'form' ? (
          <div className="ctm-body">
            {/* Team Name */}
            <div className="ctm-field">
              <label className="ctm-label">Team Name</label>
              <input
                ref={nameRef}
                className="ctm-input"
                type="text"
                placeholder="e.g. Backend Squad"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            {/* Theme Picker */}
            <div className="ctm-field">
              <label className="ctm-label">Theme Color</label>
              <div className="ctm-themes">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    className={`ctm-theme-btn ${theme === opt.id ? 'active' : ''}`}
                    style={{ background: opt.accent }}
                    title={opt.label}
                    onClick={() => setTheme(opt.id)}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="ctm-field">
              <label className="ctm-label">Description <span style={{ opacity: 0.5, textTransform: 'none' }}>(optional)</span></label>
              <textarea
                className="ctm-input ctm-textarea"
                placeholder="What does this team work on?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>

            {/* Email Invites */}
            <div className="ctm-field">
              <label className="ctm-label">Invite Members <span style={{ opacity: 0.5, textTransform: 'none' }}>(optional)</span></label>
              <div className="ctm-chip-wrap">
                {emails.map(email => (
                  <span key={email} className="ctm-chip">
                    {email}
                    <button className="ctm-chip-x" onClick={() => removeEmail(email)}>×</button>
                  </span>
                ))}
                <input
                  className="ctm-chip-input"
                  type="email"
                  placeholder={emails.length ? 'Add more...' : 'team@company.com, press Enter'}
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => emailInput && addEmail()}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="ctm-actions">
              <button className="ctm-btn ctm-btn--cancel" onClick={onClose}>Cancel</button>
              <button
                className="ctm-btn ctm-btn--create"
                disabled={!name.trim() || name.trim().length < 3 || loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M7 1v2M7 11v2M1 7h2M11 7h2"/>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M7 1v12M1 7h12"/>
                    </svg>
                    Create Team
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Success State */
          <div className="ctm-body">
            <div className="ctm-success">
              <div className="ctm-success-icon">🎉</div>
              <h3>{createdTeam?.name}</h3>
              <p>Your team is ready! Share the invite link with your teammates.</p>
              <div className="ctm-link-box">
                <code>{createdTeam?.invite_link}</code>
                <button className="ctm-copy-btn" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              {emails.length > 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  📧 Invites sent to {emails.length} email{emails.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="ctm-actions">
              <button className="ctm-btn ctm-btn--cancel" onClick={onClose}>Close</button>
              <button className="ctm-btn ctm-btn--create" onClick={handleEnterTeam}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 7h12M8 2l5 5-5 5"/>
                </svg>
                Enter Team
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
