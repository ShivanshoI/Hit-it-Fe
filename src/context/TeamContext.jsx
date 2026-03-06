import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Theme Palettes ──────────────────────────────────────────────────────────
const PALETTES = {
  purple:  { accent: '#6c3fc5', mid: '#7e52d4', light: '#a07ee8', dim: 'rgba(108,63,197,0.1)',  glow: 'rgba(108,63,197,0.18)' },
  emerald: { accent: '#10b981', mid: '#34d399', light: '#6ee7b7', dim: 'rgba(16,185,129,0.1)',   glow: 'rgba(16,185,129,0.18)' },
  blue:    { accent: '#3b82f6', mid: '#60a5fa', light: '#93c5fd', dim: 'rgba(59,130,246,0.1)',   glow: 'rgba(59,130,246,0.18)' },
  orange:  { accent: '#f59e0b', mid: '#fbbf24', light: '#fcd34d', dim: 'rgba(245,158,11,0.1)',   glow: 'rgba(245,158,11,0.18)' },
  rose:    { accent: '#f43f5e', mid: '#fb7185', light: '#fda4af', dim: 'rgba(244,63,94,0.1)',    glow: 'rgba(244,63,94,0.18)' },
  cyan:    { accent: '#06b6d4', mid: '#22d3ee', light: '#67e8f9', dim: 'rgba(6,182,212,0.1)',    glow: 'rgba(6,182,212,0.18)' },
};

const DEFAULT_PALETTE = PALETTES.purple;

// ─── Context ──────────────────────────────────────────────────────────────────
const TeamContext = createContext(null);

export const useTeam = () => {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
};

export { PALETTES };

// ─── Provider ─────────────────────────────────────────────────────────────────
export function TeamProvider({ children }) {
  const [activeTeam, setActiveTeamState] = useState(() => {
    try {
      const stored = localStorage.getItem('hitit_active_team');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const isTeamMode = !!activeTeam;

  // Apply theme CSS variables
  useEffect(() => {
    const palette = activeTeam ? (PALETTES[activeTeam.theme] || DEFAULT_PALETTE) : DEFAULT_PALETTE;
    const root = document.documentElement;
    root.style.setProperty('--purple', palette.accent);
    root.style.setProperty('--purple-mid', palette.mid);
    root.style.setProperty('--purple-light', palette.light);
    root.style.setProperty('--purple-dim', palette.dim);
    root.style.setProperty('--purple-glow', palette.glow);
    // Also update border colors that reference purple
    root.style.setProperty('--border', `${palette.accent}1F`);   // ~12% opacity
    root.style.setProperty('--border-2', `${palette.accent}40`); // ~25% opacity
  }, [activeTeam]);

  // Persist to localStorage
  useEffect(() => {
    if (activeTeam) {
      localStorage.setItem('hitit_active_team', JSON.stringify(activeTeam));
    } else {
      localStorage.removeItem('hitit_active_team');
    }
  }, [activeTeam]);

  const setActiveTeam = useCallback((team) => {
    setActiveTeamState(team);
  }, []);

  const clearTeam = useCallback(() => {
    setActiveTeamState(null);
  }, []);

  const value = {
    activeTeam,
    setActiveTeam,
    clearTeam,
    isTeamMode,
    teamId: activeTeam?.id || null,
    teamTheme: activeTeam ? (PALETTES[activeTeam.theme] || DEFAULT_PALETTE) : null,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}

export default TeamContext;
