import { useState, useCallback, useEffect } from 'react';
import { useTeam, PALETTES } from '../context/TeamContext';
import { getMyTeams } from '../api/teams.api';
import { getOrganizationDetails, verifyOrganization } from '../api/orgs.api';
import CreateTeamModal from './CreateTeamModal';
import JoinTeamModal from './JoinTeamModal';
import TeamMembersModal from './TeamMembersModal';
import './TeamPanel.css';

export default function TeamPanel({ user }) {
  const { activeTeam, setActiveTeam, clearTeam, isTeamMode, isOrgMode, clearOrg, setActiveOrg, activeOrg, orgId } = useTeam();
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [managingTeam, setManagingTeam] = useState(null);

  const handleJoined = (team) => {
    setTeams(prev => [team, ...prev]);
    setActiveTeam(team);
    fetchTeamsAndOrg(); // Full refresh to get members and feed
  };

  // Org State
  const [orgData, setOrgData] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [manualOrgId, setManualOrgId] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Fetch teams and org on mount
  const fetchTeamsAndOrg = useCallback(async () => {
    try {
      setLoadingTeams(true);
      setLoadingOrg(true);

      console.log('DEBUG: User OrgID:', user?.organizationId);
      
      // Issue requests in parallel
      const apiCalls = [getMyTeams(isOrgMode ? orgId : null).catch(err => { console.error(err); return []; })];
      
      // Only auto-fetch org if we are already in Org Mode
      // If we only have user.organizationId (affiliation but not active), we let the user click "Connect"
      if (isOrgMode && orgId) {
        apiCalls.push(verifyOrganization(orgId).catch(() => []));
      } else {
        apiCalls.push(Promise.resolve([]));
      }

      const [teamsData, orgRes] = await Promise.all(apiCalls);

      setTeams(Array.isArray(teamsData) ? teamsData : []);
      
      // Handle response structure { success, org: { ... } } or just the org object
      const actualOrg = orgRes?.org || orgRes;
      
      if (!actualOrg || (Array.isArray(actualOrg) && actualOrg.length === 0)) {
        setOrgData(null);
      } else {
        setOrgData(actualOrg);
      }

    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoadingTeams(false);
      setLoadingOrg(false);
    }
  }, [user?.organizationId, isOrgMode, orgId]);

  const handleManualSearch = async (overrideId) => {
    const searchId = (typeof overrideId === 'string' ? overrideId : manualOrgId).trim();
    if (!searchId) return;
    try {
      setIsSearching(true);
      const res = await verifyOrganization(searchId);
      const verifiedOrg = res?.org || (res.success ? res : null);
      
      if (!verifiedOrg || (Array.isArray(verifiedOrg) && verifiedOrg.length === 0)) {
        alert('No organization found or verification failed.');
        setOrgData(null);
      } else {
        setOrgData({ ...verifiedOrg, is_verified: true });
        setIsSearching(false);
      }
    } catch (err) {
      alert(err.message || 'Error connecting to organization.');
    } finally {
      setIsSearching(false);
    }
  };

  // Run on mount and when orgId changes
  useEffect(() => { 
    fetchTeamsAndOrg(); 
  }, [fetchTeamsAndOrg]);

  const handleVerify = async () => {
    if (!orgData?.id) return;
    try {
      setVerifying(true);
      const res = await verifyOrganization(orgData.id);
      // Use res.org if present (consistent with provided JSON spec)
      const verifiedOrg = res?.org || (res.success ? orgData : null);
      
      if (verifiedOrg) {
        setOrgData({ ...verifiedOrg, is_verified: true });
      }
    } catch (err) {
      alert(err.message || 'Failed to verify organization.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSelectTeam = useCallback((team) => {
    setActiveTeam({
      id: team.id,
      name: team.name,
      theme: team.theme,
      description: team.description,
      role: team.role,
      member_count: team.member_count,
      invite_link: team.invite_link,
    });
  }, [setActiveTeam]);

  const handleTeamCreated = useCallback((newTeam) => {
    setTeams(prev => [newTeam, ...prev]);
    setActiveTeam(newTeam);
  }, [setActiveTeam]);

  return (
    <div className="tp-container">
      {/* Active organization banner */}
      {isOrgMode && (
        <div className="tp-active-banner tp-active-banner--org" style={{ marginBottom: '1rem', borderLeftColor: 'var(--purple)' }}>
          <div className="tp-active-dot" style={{ background: 'var(--purple)', boxShadow: '0 0 8px var(--purple)' }} />
          <div className="tp-active-info">
            <h4>Currently in Organization Workspace: {activeOrg?.name}</h4>
            <span>All collections and history are currently scoped to {activeOrg?.name}</span>
          </div>
          <button className="tp-leave-btn" onClick={clearOrg}>
            Leave Org Mode
          </button>
        </div>
      )}

      {/* Active team banner */}
      {isTeamMode && (
        <div className="tp-active-banner">
          <div
            className="tp-active-dot"
            style={{
              background: PALETTES[activeTeam.theme]?.accent || '#6c3fc5',
              color: PALETTES[activeTeam.theme]?.accent || '#6c3fc5',
            }}
          />
          <div className="tp-active-info">
            <h4>Currently in: {activeTeam.name}</h4>
            <span>Click the team name in the sidebar to return to your personal workspace</span>
          </div>
          <button className="tp-leave-btn" onClick={clearTeam}>
            Leave Team View
          </button>
        </div>
      )}

      {/* Organization Section */}
      <div className="hp-org-section" style={{ marginBottom: '2rem' }}>
        <div className="tp-section-header">
          <h2 className="tp-section-title">Organization</h2>
        </div>

        {loadingOrg ? (
          <div className="tp-empty">
            <div className="tp-empty-icon" style={{ animation: 'spin 1s linear infinite' }}>⟳</div>
            <p>Loading organization details...</p>
          </div>
        ) : !orgData ? (
          <div className="tp-empty" style={{ padding: '2.5rem 1rem' }}>
            <div className="tp-empty-icon">🏢</div>
            {user?.organizationId && !isSearching && !manualOrgId ? (
              <>
                <p style={{ marginTop: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Organization Found</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '1.5rem', opacity: 0.7 }}>
                  Your profile is associated with an organization.
                </p>
                <button 
                  className="hp-btn-new"
                  onClick={() => handleManualSearch(user.organizationId)}
                >
                  Connect to Organization
                </button>
                <div style={{ marginTop: '1.2rem' }}>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setIsSearching(true)}
                  >
                    Enter a different Org ID
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginTop: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                  {isSearching || manualOrgId ? 'Link Organization' : 'Connect to Organization'}
                </p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.2rem', marginBottom: '1.5rem', opacity: 0.7 }}>
                  Enter your Organization ID below to sync your workspace.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '340px', margin: '0 auto', width: '100%' }}>
                  <input 
                    className="hp-search" 
                    autoFocus
                    style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                    placeholder="e.g. org_123..."
                    value={manualOrgId}
                    onChange={e => setManualOrgId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                  />
                  <button 
                    className="hp-btn-new" 
                    style={{ padding: '0 1.2rem', minHeight: 'auto', fontSize: '0.85rem' }}
                    onClick={() => handleManualSearch()}
                    disabled={isSearching || !manualOrgId.trim()}
                  >
                    {isSearching ? '...' : 'Connect'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div 
            className={`hp-org-card ${isOrgMode ? 'hp-org-card--active' : ''}`}
            onClick={() => {
              if (!orgData.is_verified) return; // Prevent clicking into unverified orgs
              if (isOrgMode) {
                clearOrg();
              } else {
                setActiveOrg({ id: orgData.id, name: orgData.name });
              }
            }}
            style={{
              cursor: orgData.is_verified ? 'pointer' : 'default',
              border: isOrgMode ? '2px solid var(--purple)' : '1px solid var(--border)',
              background: isOrgMode ? 'var(--purple-dim)' : 'var(--surface)',
              transition: 'all 0.2s',
              opacity: orgData.is_verified ? 1 : 0.8
            }}
          >
            <div className="hp-org-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M13 3l8 4v14M9 11v2M9 15v2M17 11v2M17 15v2"/></svg>
            </div>
            <div className="hp-org-details" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3>{orgData.name}</h3>
                {!orgData.is_verified && (
                  <button 
                    className="hp-btn-new" 
                    onClick={handleVerify}
                    disabled={verifying}
                    style={{ padding: '0.4rem 0.8rem', minHeight: 'auto', fontSize: '0.8rem' }}
                  >
                    {verifying ? 'Connecting...' : 'Connect to Organization'}
                  </button>
                )}
              </div>
              <div className="hp-org-meta" style={{ marginTop: '0.4rem' }}>
                <span className="hp-badge hp-badge--role">{orgData.role || 'Member'}</span>
                <span className="hp-meta-dot">•</span>
                <span>{orgData.member_count} Members</span>
                {orgData.is_verified && (
                  <>
                    <span className="hp-meta-dot">•</span>
                    <span className="hp-meta-muted">
                      {isOrgMode ? 'Currently Active Workspace' : 'Click to enter Organization Workspace'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teams list */}
      <div className="tp-section">
        <div className="tp-section-header">
          <h2 className="tp-section-title">Your Teams</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="hp-btn-new hp-btn-join-team" onClick={() => setShowJoin(true)} style={{ background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Join Team
            </button>
            <button className="hp-btn-new hp-btn-new-team" onClick={() => setShowCreate(true)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6.5 1v11M1 6.5h11"/>
              </svg>
              Create Team
            </button>
          </div>
        </div>

        {showJoin && (
          <JoinTeamModal 
            onClose={() => setShowJoin(false)}
            onJoined={handleJoined}
          />
        )}

        {loadingTeams ? (
          <div className="tp-empty">
            <div className="tp-empty-icon" style={{ animation: 'spin 1s linear infinite' }}>⟳</div>
            <p>Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="tp-empty">
            <div className="tp-empty-icon">👥</div>
            <p>You're not part of any teams yet</p>
            <button className="hp-btn-new" onClick={() => setShowCreate(true)}>
              Create your first team
            </button>
          </div>
        ) : (
          <div className="tp-grid">
            {teams.map((team, i) => {
              const palette = PALETTES[team.theme] || PALETTES.purple;
              const isActive = activeTeam?.id === team.id;
              return (
                <div
                  key={team.id}
                  className={`tp-card ${isActive ? 'tp-card--active' : ''}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => handleSelectTeam(team)}
                >
                  <div className="tp-card-header">
                    <div className="tp-card-color" style={{ background: palette.accent }}>
                      {team.name[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="tp-card-name">{team.name}</div>
                      {team.parent_team_id && (
                        <div className="tp-card-parent">
                          Sub-team of: {teams.find(t => t.id === team.parent_team_id)?.name || 'Parent Team'}
                        </div>
                      )}
                    </div>
                  </div>

                  {team.description && (
                    <div className="tp-card-desc">{team.description}</div>
                  )}

                  <div className="tp-card-footer">
                    <span className="tp-card-meta">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <circle cx="6" cy="6" r="2.5"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/>
                        <circle cx="12" cy="5" r="2"/><path d="M14.5 12c0-1.8-1-3-2.5-3"/>
                      </svg>
                      {team.member_count} members
                    </span>
                    <span className={`tp-role-badge tp-role-badge--${team.role}`}>
                      {team.role}
                    </span>
                  </div>

                  <button
                    className="tp-manage-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setManagingTeam(team);
                    }}
                  >
                    {team.role === 'owner' ? 'Manage Members' : 'View Members'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreate && (
        <CreateTeamModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTeamCreated}
        />
      )}

      {/* Manage Members Modal */}
      {managingTeam && (
        <TeamMembersModal
          team={managingTeam}
          currentUser={user}
          onClose={() => setManagingTeam(null)}
        />
      )}
    </div>
  );
}
