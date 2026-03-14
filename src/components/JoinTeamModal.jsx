import { useState, useRef, useEffect } from 'react';
import { acceptInvite } from '../api/teams.api';
import './JoinTeamModal.css';

export default function JoinTeamModal({ onClose, onJoined }) {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const input = tokenInput.trim();
    if (!input) return;

    // Extract token if user pasted a full URL
    let token = input;
    if (input.includes('/join-team/')) {
      token = input.split('/join-team/').pop().split('?')[0];
    }

    try {
      setLoading(true);
      setError('');
      const joinedTeam = await acceptInvite(token);
      onJoined?.(joinedTeam);
      onClose();
    } catch (err) {
      console.error('Failed to join team:', err);
      setError(err.message || 'Invalid invite link or token. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jtm-overlay" onClick={onClose}>
      <div className="jtm-modal" onClick={e => e.stopPropagation()}>
        <div className="jtm-header">
          <h2>Join Team</h2>
          <button className="jtm-close" onClick={onClose}>&times;</button>
        </div>

        <form className="jtm-body" onSubmit={handleSubmit}>
          <p className="jtm-hint">Paste an invite link or the unique token shared with you.</p>
          
          <div className="jtm-field">
            <input
              ref={inputRef}
              className={`jtm-input ${error ? 'jtm-input--error' : ''}`}
              type="text"
              placeholder="Invite link or token..."
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            {error && <div className="jtm-error-msg">{error}</div>}
          </div>

          <div className="jtm-actions">
            <button type="button" className="jtm-btn jtm-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="jtm-btn jtm-btn--join" 
              disabled={loading || !tokenInput.trim()}
            >
              {loading ? 'Joining...' : 'Join Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
