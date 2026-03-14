import { useState, useEffect, useCallback } from 'react';
import { getTeamMembers, removeMember, bulkRemoveMembers, transferOwnership, inviteByEmail, getInviteLink } from '../api/teams.api';
import './TeamMembersModal.css';

export default function TeamMembersModal({ team, onClose, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [emailInput, setEmailInput] = useState('');
  const [inviting, setInviting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');
  const [fetchingLink, setFetchingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = team.role === 'owner';
  const isAdmin = team.role === 'admin';
  const canManage = isOwner || isAdmin;

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTeamMembers(team.id);
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedIds.size} members?`)) return;
    
    try {
      setLoading(true);
      await bulkRemoveMembers(team.id, Array.from(selectedIds));
      setMembers(prev => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
    } catch (err) {
      alert(err.message || 'Failed to remove members.');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId, newOwnerName) => {
    if (!window.confirm(`Are you sure you want to transfer ownership to ${newOwnerName}? You will lose owner permissions.`)) return;
    
    try {
      setTransferring(true);
      await transferOwnership(team.id, newOwnerId);
      alert('Ownership transferred successfully.');
      onClose(); // Close modal as user role changed
      window.location.reload(); // Refresh to update roles everywhere
    } catch (err) {
      alert(err.message || 'Failed to transfer ownership.');
    } finally {
      setTransferring(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      setRemovingId(userId);
      await removeMember(team.id, userId);
      setMembers(prev => prev.filter(m => m.id !== userId));
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      setFetchingLink(true);
      const res = await getInviteLink(team.id);
      if (res && res.link) {
        await navigator.clipboard.writeText(res.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      alert(err.message || 'Failed to get invite link.');
    } finally {
      setFetchingLink(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;

    try {
      setInviting(true);
      await inviteByEmail(team.id, [email]);
      setEmailInput('');
      alert('Invite sent!');
    } catch (err) {
      alert(err.message || 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  const canRemoveMember = (member) => {
    if (member.role === 'owner') return false; // No one can remove owner
    if (isOwner) return true; // Owner can remove everyone else
    if (isAdmin && member.role === 'member') return true; // Admin can remove members
    return false;
  };

  return (
    <div className="tmm-overlay" onClick={onClose}>
      <div className="tmm-modal" onClick={e => e.stopPropagation()}>
        <div className="tmm-header">
          <div className="tmm-title-wrap">
            <h2>Team Members</h2>
            <span className="tmm-subtitle">{team.name}</span>
          </div>
          <button className="tmm-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tmm-body">
          {canManage && (
            <div className="tmm-manage-header">
              <form className="tmm-invite-form" onSubmit={handleInvite}>
                <input
                  className="tmm-input"
                  type="email"
                  placeholder="Invite by email..."
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  disabled={inviting}
                />
                <button className="tmm-invite-btn" disabled={inviting || !emailInput.trim()} title="Send Invite">
                  {inviting ? (
                    '...'
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="8.5" cy="7" r="4"/>
                      <line x1="20" y1="8" x2="20" y2="14"/>
                      <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                  )}
                </button>
              </form>
              <button 
                className={`tmm-copy-link-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
                disabled={fetchingLink}
                title={copied ? "Copied!" : "Copy shareable invite link"}
              >
                {fetchingLink ? (
                  '...'
                ) : copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {error && <div className="tmm-error">{error}</div>}

          <div className="tmm-list-container">
            {loading ? (
              <div className="tmm-loading">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="tmm-empty">No members found</div>
            ) : (
              <div className="tmm-list">
                {members.map(member => (
                  <div key={member.id} className="tmm-item">
                    <div className="tmm-member-info">
                      {canRemoveMember(member) && (
                        <input 
                          type="checkbox" 
                          className="tmm-checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={() => handleToggleSelect(member.id)}
                        />
                      )}
                      <div className="tmm-avatar">
                        {member.name[0].toUpperCase()}
                      </div>
                      <div className="tmm-details">
                        <span className="tmm-name">
                          {member.name} 
                          {member.id === currentUser?.id && <span className="tmm-you-tag"> (You)</span>}
                        </span>
                        <span className="tmm-email">{member.email}</span>
                      </div>
                    </div>
                    
                    <div className="tmm-actions">
                      <span className={`tmm-role-badge tmm-role-badge--${member.role}`}>
                        {member.role}
                      </span>
                      {canRemoveMember(member) && (
                        <div className="tmm-owner-actions">
                          {isOwner && (
                            <button 
                              className="tmm-transfer-btn"
                              title="Transfer Ownership"
                              onClick={() => handleTransferOwnership(member.id, member.name)}
                              disabled={transferring}
                            >
                              👑
                            </button>
                          )}
                          <button 
                            className="tmm-remove-btn"
                            onClick={() => handleRemove(member.id)}
                            disabled={removingId === member.id}
                          >
                            {removingId === member.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {canManage && selectedIds.size > 0 && (
          <div className="tmm-footer">
            <span>{selectedIds.size} selected</span>
            <button className="tmm-bulk-remove-btn" onClick={handleBulkRemove}>
              Remove Selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
