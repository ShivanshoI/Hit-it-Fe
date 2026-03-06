import { useState, useCallback } from 'react';
import { useTeam, PALETTES } from '../context/TeamContext';
import { getMyTeams } from '../api/teams.api';
import CreateTeamModal from './CreateTeamModal';
import './TeamPanel.css';

export default function TeamPanel() {
  const { activeTeam, setActiveTeam, clearTeam, isTeamMode } = useTeam();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Fetch teams on mount
  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyTeams();
      setTeams(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on mount
  useState(() => { fetchTeams(); }, []);

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

      {/* Teams list */}
      <div className="tp-section">
        <div className="tp-section-header">
          <h2 className="tp-section-title">Your Teams</h2>
          <button className="hp-btn-new hp-btn-new-team" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 1v11M1 6.5h11"/>
            </svg>
            Create Team
          </button>
        </div>

        {loading ? (
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
                    <div>
                      <div className="tp-card-name">{team.name}</div>
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
    </div>
  );
}
