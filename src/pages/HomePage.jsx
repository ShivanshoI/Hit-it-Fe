import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import CollectionModal from '../components/CollectionModal';
import NewCollectionModal from '../components/NewCollectionModal';
import ImportModal from '../components/ImportModal';
import TeamPanel from '../components/TeamPanel';
import TeamActivityFeed from '../components/TeamActivityFeed';
import ProfilePage from './ProfilePage';
import PlanPage from './PlanPage';
import { useTeam, PALETTES } from '../context/TeamContext';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  toggleFavoriteCollection,
  getFavoriteCollections,
  getSharedCollections,
} from '../api/homePage.api';
import { getHistory } from '../api/history.api';
import './HomePage.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = ['Last Modified', 'Name A–Z', 'Name Z–A', 'Most Requests'];
const PAGE_SIZE = 14;
const HISTORY_PAGE_SIZE = 20;

// Tabs that show the collections grid + Import/New buttons
const COLLECTION_TABS = new Set(['home', 'collections', 'favorites', 'shared']);

const METHOD_COLORS = {
  GET:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  POST:   { bg: 'rgba(108,63,197,0.12)',  text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.12)',  text: '#0ea5e9' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeDay(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function requestCount(c) {
  return c.total_requests ?? (c.requests?.length ?? 0);
}

// ─── SVG Thumbnail Patterns ───────────────────────────────────────────────────
function Thumbnail({ color, pattern }) {
  const opacity = 0.18;
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
      <rect width="100%" height="100%" fill={color} opacity={0.08} />
      {pattern === 'waves' && (
        <g stroke={color} strokeWidth="1.5" fill="none" opacity={opacity}>
          {[0, 20, 40, 60, 80, 100].map(y => (
            <path key={y} d={`M0 ${y} Q40 ${y - 12} 80 ${y} Q120 ${y + 12} 160 ${y} Q200 ${y - 12} 240 ${y}`} />
          ))}
        </g>
      )}
      {pattern === 'grid' && (
        <g stroke={color} strokeWidth="1" opacity={opacity}>
          {[0, 20, 40, 60, 80, 100, 120].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100%" />)}
          {[0, 20, 40, 60, 80, 100].map(y => <line key={`h${y}`} x1="0" y1={y} x2="100%" y2={y} />)}
        </g>
      )}
      {pattern === 'dots' && (
        <g fill={color} opacity={opacity}>
          {[16, 48, 80, 112, 144, 176, 208].flatMap(x =>
            [14, 42, 70, 98].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />)
          )}
        </g>
      )}
      {pattern === 'lines' && (
        <g stroke={color} strokeWidth="1.5" opacity={opacity}>
          {[0, 16, 32, 48, 64, 80, 96, 112].map(i => (
            <line key={i} x1={i * 2} y1="0" x2="0" y2={i * 2} />
          ))}
        </g>
      )}
      {pattern === 'cross' && (
        <g stroke={color} strokeWidth="1.5" opacity={opacity}>
          {[24, 72, 120, 168].flatMap(x =>
            [18, 54, 90].map(y => (
              <g key={`${x}-${y}`}>
                <line x1={x - 6} y1={y} x2={x + 6} y2={y} />
                <line x1={x} y1={y - 6} x2={x} y2={y + 6} />
              </g>
            ))
          )}
        </g>
      )}
      <circle cx="90%" cy="85%" r="28" fill={color} opacity={0.12} />
      <circle cx="90%" cy="85%" r="14" fill={color} opacity={0.1} />
    </svg>
  );
}

// ─── Card ⋮ Menu ─────────────────────────────────────────────────────────────
function CardMenu({ onOpen, onCustomize, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(e => { e.stopPropagation(); setOpen(v => !v); }, []);
  const handleOpen   = useCallback(() => { setOpen(false); onOpen(); },      [onOpen]);
  const handleCustom = useCallback(() => { setOpen(false); onCustomize(); }, [onCustomize]);
  const handleDelete = useCallback(() => { setOpen(false); onDelete(); },    [onDelete]);

  return (
    <div className="hc-menu-wrap" ref={ref}>
      <button className="hc-card-menu" title="Options" onClick={handleToggle}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.3" /><circle cx="7" cy="7" r="1.3" /><circle cx="7" cy="12" r="1.3" />
        </svg>
      </button>
      {open && (
        <div className="hc-menu-dropdown" onClick={e => e.stopPropagation()}>
          <button className="hc-menu-item" onClick={handleOpen}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="1" y="2" width="11" height="9" rx="1.5" /><path d="M4 5h5M4 7.5h3" />
            </svg>
            Open
          </button>
          <button className="hc-menu-item" onClick={handleCustom}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="1.5" />
              <path d="M6.5 1v1.5M6.5 9.5V11M1 6.5h1.5M9.5 6.5H11M2.9 2.9l1.1 1.1M8.9 8.9l1.1 1.1M2.9 10.1l1.1-1.1M8.9 4.1l1.1-1.1" />
            </svg>
            Customize
          </button>
          <div className="hc-menu-divider" />
          <button className="hc-menu-item hc-menu-item--danger" onClick={handleDelete}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3.5h9M5.5 3.5V2.5h2V3.5M5 3.5v7M8 3.5v7M3 3.5l.5 7.5h5.5l.5-7.5" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Collection Card ──────────────────────────────────────────────────────────
function CollectionCard({ collection, style, onClick, onCustomize, onDelete, isFav, onToggleFav }) {
  const method  = METHOD_COLORS[collection.default_method] || METHOD_COLORS.GET;
  const timeStr = relativeDay(collection.updated_at);
  const count   = requestCount(collection);
  const handleFavClick = useCallback(e => { e.stopPropagation(); onToggleFav?.(); }, [onToggleFav]);

  return (
    <div className={`hc-card${isFav ? ' hc-card--fav' : ''}`} style={style} onClick={onClick}>
      <div className="hc-card-thumb" style={{ borderBottom: `2px solid ${collection.accent_color}22` }}>
        <Thumbnail color={collection.accent_color} pattern={collection.pattern} />
        <div className="hc-card-method" style={{ background: method.bg, color: method.text }}>
          {collection.default_method}
        </div>
        <button
          className={`hc-fav-btn${isFav ? ' hc-fav-btn--on' : ''}`}
          title={isFav ? 'Remove from favourites' : 'Add to favourites'}
          onClick={handleFavClick}
          aria-label={isFav ? 'Unfavourite' : 'Favourite'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={isFav ? '#f59e0b' : 'none'}
            stroke={isFav ? '#f59e0b' : 'currentColor'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>

      <div className="hc-card-body">
        <div className="hc-card-top">
          <h3 className="hc-card-name">{collection.name || 'Untitled Collection'}</h3>
          <CardMenu onOpen={onClick} onCustomize={onCustomize} onDelete={onDelete} />
        </div>
        {collection.tags?.length > 0 && (
          <div className="hc-card-tags">
            {collection.tags.map(t => <span key={t} className="hc-tag">{t}</span>)}
          </div>
        )}
        <div className="hc-card-meta">
          <span className="hc-meta-item">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="10" height="9" rx="1.5" /><path d="M4 1v2M8 1v2M1 5h10" />
            </svg>
            {timeStr}
          </span>
          <span className="hc-meta-item">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2v8" strokeLinecap="round" />
            </svg>
            {count} requests
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── New Collection Card ──────────────────────────────────────────────────────
function NewCard({ style, onClick }) {
  return (
    <div className="hc-card hc-card--new" style={style} onClick={onClick}>
      <div className="hc-new-inner">
        <div className="hc-new-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M11 4v14M4 11h14" />
          </svg>
        </div>
        <span>New Collection</span>
      </div>
    </div>
  );
}

// ─── Sidebar Nav Items (module-level constant — never recreated on render) ────
const NAV_ITEMS = [
  {
    id: 'home', label: 'Home',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" /></svg>,
  },
  {
    id: 'quicky', label: 'Quicky',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-10 12h9l-1 8 10-12h-9l1-8z" /></svg>,
  },
  {
    id: 'favorites', label: 'Favorites',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 2l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2z" /></svg>,
  },
  {
    id: 'shared', label: 'Shared',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM4 11.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM15 11.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM4 10l5-3M11 7l3.5 3.5" /></svg>,
  },
  {
    id: 'history', label: 'History',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M8 4v4l2.5 2.5" /></svg>,
  },
  {
    id: 'envs', label: 'Environments',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 2a9 9 0 010 12M2 8h12" /></svg>,
  },
  {
    id: 'team', label: 'Team',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="6" r="2.5" /><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" /><circle cx="12" cy="5" r="2" /><path d="M14.5 12c0-1.8-1-3-2.5-3" /></svg>,
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
/**
 * Purely presentational. Handles all 4 scope modes visually.
 *
 * Logo zone priority:
 *   org + team  → team name (innermost scope) + org name micro-label
 *   team only   → team name with accent dot
 *   org only    → org name with purple dot        ← was missing before
 *   personal    → HITIT wordmark
 *
 * Exit wiring:
 *   team logo   → clearTeam  (stays in org if org active)
 *   org logo    → clearOrg   (exits org scope; team stays if team active)
 */
function Sidebar({ user, onLogout, active, setActive, onQuicky,
                   activeTeam, activeOrg, isTeamMode, isOrgMode,
                   onClearTeam, onClearOrg }) {

  const teamAccent = isTeamMode ? (PALETTES[activeTeam.theme]?.accent || '#6c3fc5') : '#6c3fc5';

  const renderLogo = () => {
    if (isTeamMode) {
      return (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '100%', minWidth: 0 }}
          onClick={onClearTeam}
          title="Click to leave team workspace"
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: teamAccent, boxShadow: `0 0 6px ${teamAccent}` }} />
          <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTeam.name}
          </span>
          {isOrgMode && (
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginLeft: 'auto', flexShrink: 0 }}>
              {activeOrg.name}
            </span>
          )}
        </div>
      );
    }
    if (isOrgMode) {
      return (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '100%', minWidth: 0 }}
          onClick={onClearOrg}
          title="Click to leave organization workspace"
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#6c3fc5', boxShadow: '0 0 6px rgba(108,63,197,0.6)' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeOrg.name}
          </span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.35, marginLeft: 'auto', flexShrink: 0 }}>
            <path d="M8 1H11v3M7 5l4-4M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" />
          </svg>
        </div>
      );
    }
    return <>HIT<em>IT</em></>;
  };

  return (
    <aside className="hp-sidebar">
      <div className="hp-sidebar-logo">{renderLogo()}</div>

      <nav className="hp-sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`hp-nav-item${active === item.id ? ' active' : ''}${item.id === 'quicky' ? ' hp-nav-item--quicky' : ''}`}
            onClick={() => item.id === 'quicky' ? onQuicky?.() : setActive(item.id)}
            style={item.id === 'home' && (isTeamMode || isOrgMode) ? { fontWeight: 800, letterSpacing: '0.06em' } : undefined}
          >
            {item.icon}
            <span>
              {item.id === 'home' && (isTeamMode || isOrgMode) ? 'HOME' : 
               item.id === 'shared' ? (
                 isTeamMode ? 'Teams' : 
                 isOrgMode ? 'Organization' : 
                 'Shared'
               ) : item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="hp-sidebar-bottom">
        <div className="hp-sidebar-user" onClick={() => setActive('profile')} style={{ cursor: 'pointer' }} title="View Profile">
          <div className="hp-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
          <div className="hp-user-info">
            <span className="hp-user-name">{user?.name || 'User'}</span>
            <span className="hp-user-email">{user?.email || ''}</span>
            {/* Scope badge — shows deepest active scope */}
            {isTeamMode && isOrgMode && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: teamAccent, marginTop: '0.15rem' }}>
                {activeOrg.name} / {activeTeam.name}
              </span>
            )}
            {isTeamMode && !isOrgMode && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: teamAccent, marginTop: '0.15rem' }}>
                Team: {activeTeam.name}
              </span>
            )}
            {!isTeamMode && isOrgMode && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6c3fc5', marginTop: '0.15rem' }}>
                Org: {activeOrg.name}
              </span>
            )}
          </div>
        </div>
        <button className="hp-sidebar-logout" onClick={onLogout} title="Logout">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 7.5H2M7 4.5l3 3-3 3" /><path d="M6 2H13v11H6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function HomePage({ user, onLogout }) {
  const {
    activeTeam, clearTeam, isTeamMode, teamId,
    activeOrg,  clearOrg,  isOrgMode,  orgId,
  } = useTeam();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [collections,  setCollections]  = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [favIds,       setFavIds]       = useState(() => new Set());
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [loading,      setLoading]      = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('Last Modified');
  const [sortOpen,    setSortOpen]    = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [activeTab,   setActiveTab]   = useState('home');

  // Modals
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [editingColl,        setEditingColl]        = useState(null);
  const [newCollOpen,        setNewCollOpen]        = useState(false);
  const [importOpen,         setImportOpen]         = useState(false);

  // Team feed
  const [showTeamFeed, setShowTeamFeed] = useState(false);

  // In-flight fetch guard (prevents double-fires from IntersectionObserver + useEffect)
  const fetchingRef  = useRef(false);
  const loaderRef    = useRef(null);

  // Keep a ref to activeTab so the scope-reset effect can read it without
  // becoming a dep (which would make it re-run on every tab click)
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ── Scope change → full data reset ─────────────────────────────────────────
  // Watches only the primitive ids. Fires on: personal↔team, personal↔org,
  // team↔org+team, org→org+team, and full clears.
  useEffect(() => {
    setCollections([]);
    setHistoryItems([]);
    setFavIds(new Set());
    setPage(1);
    setHasMore(true);
    setSelectedCollection(null);
    fetchingRef.current = false; // unblock so next fetch fires cleanly

    // Redirect away from team tab only when both scopes are cleared
    if (activeTabRef.current === 'team' && !teamId && !orgId) {
      setActiveTab('home');
    }
  }, [teamId, orgId]);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  /**
   * History fetch. Scope is forwarded to getHistory which sends it as headers.
   * Mode matrix:
   *   personal    → teamId=null, orgId=null  → no scope headers
   *   team only   → teamId set               → x-team-id
   *   org only    → orgId set                → x-org-id
   *   org + team  → both set                 → x-org-id + x-team-id
   */
  const fetchHistory = useCallback(async (pageNumber = 1, isReset = false) => {
    if (!user?.id || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const data    = await getHistory(pageNumber, HISTORY_PAGE_SIZE, teamId, orgId);
      const history = Array.isArray(data) ? data : (data?.history ?? []);
      setHasMore(history.length === HISTORY_PAGE_SIZE);
      setHistoryItems(prev => isReset ? history : [...prev, ...history]);
      setPage(pageNumber);
    } catch (err) {
      console.error('[fetchHistory]', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user?.id, teamId, orgId]);

  /**
   * Collections fetch. Same scope matrix as above.
   */
  const fetchCollections = useCallback(async (pageNumber = 1, isReset = false) => {
    if (!user?.id || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      let response;
      if (activeTab === 'favorites') {
        response = await getFavoriteCollections(pageNumber, PAGE_SIZE, teamId, orgId);
      } else if (activeTab === 'shared') {
        response = await getSharedCollections(pageNumber, PAGE_SIZE, teamId, orgId);
      } else {
        response = await getCollections(pageNumber, PAGE_SIZE, '', teamId, orgId);
      }

      const data = Array.isArray(response) ? response : (response?.collections ?? []);
      setHasMore(data.length === PAGE_SIZE);

      setFavIds(prev => {
        const next = new Set(prev);
        data.forEach(c => (c.favorite ? next.add(c.id) : next.delete(c.id)));
        return next;
      });

      if (isReset) {
        setCollections(data);
      } else {
        setCollections(prev => {
          const map = new Map(prev.map(c => [c.id, c]));
          data.forEach(c => map.set(c.id, c));
          return Array.from(map.values());
        });
      }
      setPage(pageNumber);
    } catch (err) {
      console.error('[fetchCollections]', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user?.id, activeTab, teamId, orgId]);

  // ── Tab switch → reset guard + fetch ───────────────────────────────────────
  useEffect(() => {
    if (['team', 'profile', 'plan'].includes(activeTab)) return;
    fetchingRef.current = false; // clear guard on every tab change
    if (activeTab === 'history') {
      fetchHistory(1, true);
    } else {
      fetchCollections(1, true);
    }
  }, [activeTab, fetchCollections, fetchHistory]);

  // ── Infinite scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !fetchingRef.current) {
          if (activeTab === 'history') fetchHistory(page + 1);
          else fetchCollections(page + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMore, page, activeTab, fetchCollections, fetchHistory]);

  // ── Toggle favourite (optimistic with rollback) ─────────────────────────────
  const toggleFavCollection = useCallback(async (id) => {
    const wasFav = favIds.has(id);
    setFavIds(prev => {
      const next = new Set(prev);
      wasFav ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await toggleFavoriteCollection(id, { favorite: !wasFav }, teamId, orgId);
    } catch (err) {
      console.error('[toggleFav]', err);
      setFavIds(prev => {
        const next = new Set(prev);
        wasFav ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }, [favIds, teamId, orgId]);

  // ── Filtered + sorted list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...collections];
    if (showFavOnly && activeTab !== 'favorites') {
      list = list.filter(c => favIds.has(c.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    switch (sort) {
      case 'Name A–Z':      list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'Name Z–A':      list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'Most Requests': list.sort((a, b) => requestCount(b) - requestCount(a)); break;
      default:              list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }
    return list;
  }, [collections, search, sort, showFavOnly, favIds, activeTab]);

  const currentFavCount = useMemo(
    () => collections.filter(c => favIds.has(c.id)).length,
    [collections, favIds]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleQuicky = useCallback(() => {
    setSelectedCollection({
      id: 'quicky', name: 'Quick Request', isQuicky: true,
      requests: [{ id: 'quicky-req', name: 'Untitled Request', method: 'GET', url: '', headers: [], params: [], body: '', auth: 'No Auth' }],
    });
  }, []);

  const openNewCollectionModal = useCallback(() => { setEditingColl(null); setNewCollOpen(true); }, []);
  const openCustomizeModal     = useCallback((c)  => { setEditingColl(c);    setNewCollOpen(true); }, []);

  const handleSaveCollection = useCallback(async (collection, isEdit) => {
    try {
      const payload = {
        ...collection,
        updated_at: new Date().toISOString(),
        ...(!isEdit ? { created_at: new Date().toISOString() } : {}),
      };
      const saved = isEdit
        ? await updateCollection(payload.id, payload, teamId, orgId)
        : await createCollection(payload, teamId, orgId);

      if (isEdit) {
        setCollections(prev => prev.map(c => c.id === saved.id ? saved : c));
        if (selectedCollection?.id === saved.id) setSelectedCollection(saved);
      } else {
        setCollections(prev => [saved, ...prev]);
        setSelectedCollection(saved);
      }
    } catch (err) {
      console.error('[handleSaveCollection]', err);
    }
  }, [teamId, orgId, selectedCollection?.id]);

  const handleDeleteCollection = useCallback(async (id) => {
    try {
      await deleteCollection(id, teamId, orgId);
      setCollections(prev => prev.filter(c => c.id !== id));
      if (selectedCollection?.id === id) setSelectedCollection(null);
    } catch (err) {
      console.error('[handleDeleteCollection]', err);
    }
  }, [teamId, orgId, selectedCollection?.id]);

  // ── Page title ──────────────────────────────────────────────────────────────
  const pageTitle = useMemo(() => {
    if (activeTab === 'profile') return 'Your Profile';
    if (activeTab === 'plan')    return 'Subscription Plan';
    if (activeTab === 'history') return 'Execution History';
    if (activeTab === 'team')    return 'Teams & Organization';
    if (isTeamMode && isOrgMode) return `${activeOrg.name} / ${activeTeam.name} — Collections`;
    if (isTeamMode)              return `${activeTeam.name} — Collections`;
    if (isOrgMode)               return `${activeOrg.name} — Collections`;
    return 'Collections';
  }, [activeTab, isTeamMode, isOrgMode, activeOrg, activeTeam]);

  const showCollectionButtons = COLLECTION_TABS.has(activeTab);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="hp-root">
      <Sidebar
        user={user}
        onLogout={onLogout}
        active={activeTab}
        setActive={setActiveTab}
        onQuicky={handleQuicky}
        activeTeam={activeTeam}
        activeOrg={activeOrg}
        isTeamMode={isTeamMode}
        isOrgMode={isOrgMode}
        onClearTeam={clearTeam}
        onClearOrg={clearOrg}
      />

      <div className="hp-main">
        <header className="hp-topbar">
          <div className="hp-topbar-left">
            <h1 className="hp-page-title">{pageTitle}</h1>
          </div>
          <div className="hp-topbar-right" style={{ display: 'flex', gap: '8px' }}>
            {isTeamMode && activeTab !== 'team' && (
              <button
                className="hp-btn-new"
                style={{ background: showTeamFeed ? 'var(--purple-mid)' : '#4b5563', borderColor: showTeamFeed ? 'var(--purple-mid)' : '#4b5563' }}
                onClick={() => setShowTeamFeed(v => !v)}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1h4v5H1zM8 1h4v4H8zM8 7h4v5H8zM1 8h4v4H1z" />
                </svg>
                {showTeamFeed ? 'Hide Feed' : 'Team Feed'}
              </button>
            )}
            {showCollectionButtons && (
              <>
                <button className="hp-btn-new" onClick={() => setImportOpen(true)} style={{ background: '#4b5563', borderColor: '#4b5563' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6.5 1v8M3.5 6l3 3 3-3M1 11h11" />
                  </svg>
                  Import
                </button>
                <button className="hp-btn-new" onClick={openNewCollectionModal}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6.5 1v11M1 6.5h11" />
                  </svg>
                  New Collection
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'profile' ? (
          <ProfilePage user={user} onLogout={onLogout} />

        ) : activeTab === 'plan' ? (
          <PlanPage user={user} />

        ) : activeTab === 'team' ? (
          <div className="hp-team-view" style={{ padding: '1.5rem 2.4rem 3rem' }}>
            <TeamPanel user={user} />
          </div>

        ) : activeTab === 'history' ? (
          <div className="hp-history-view" style={{ padding: '0 2.4rem 3rem' }}>
            {loading && historyItems.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="hp-empty">
                <div className="hp-empty-icon">◷</div>
                <p>No execution history found</p>
              </div>
            ) : (
              <div className="hp-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                {historyItems.map((h, i) => {
                  const ms = METHOD_COLORS[h.method] || {};
                  return (
                    <div key={h.id ?? i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '0.05em', background: ms.bg || 'rgba(255,255,255,0.1)', color: ms.text || '#fff' }}>
                            {h.method || 'GET'}
                          </span>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>{h.url || 'Unknown URL'}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="1.5" y="2.5" width="9" height="8" rx="1.5" /><path d="M4 1.5v2M8 1.5v2M1.5 5.5h9" />
                          </svg>
                          {new Date(h.executed_at ?? Date.now()).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: h.status_code >= 400 ? '#ef4444' : '#10b981' }}>
                          {h.status_code || 200}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'var(--bg-2)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {h.response_time_ms ?? 0} ms
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : (
          <>
            {/* Toolbar */}
            <div className="hp-toolbar">
              <div className="hp-search-wrap">
                <svg className="hp-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5l3 3" />
                </svg>
                <input
                  className="hp-search" type="text"
                  placeholder="Search collections, tags…"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
                {search && <button className="hp-search-clear" onClick={() => setSearch('')}>×</button>}
              </div>

              <div className="hp-sort-wrap">
                <button className="hp-sort-btn" onClick={() => setSortOpen(v => !v)}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 3h11M3 6.5h7M5 10h3" />
                  </svg>
                  {sort}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d={sortOpen ? 'M2 7l3-3 3 3' : 'M2 3l3 3 3-3'} />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="hp-sort-dropdown">
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt} className={`hp-sort-option${sort === opt ? ' active' : ''}`}
                        onClick={() => { setSort(opt); setSortOpen(false); }}>
                        {sort === opt && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 5l2.5 2.5L8 3" />
                          </svg>
                        )}
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="hp-count">{filtered.length} collection{filtered.length !== 1 ? 's' : ''}</span>

              {activeTab !== 'favorites' && currentFavCount > 0 && (
                <button className={`hp-fav-filter${showFavOnly ? ' active' : ''}`}
                  onClick={() => setShowFavOnly(v => !v)}
                  title={showFavOnly ? 'Show all collections' : 'Show favourites only'}>
                  <svg width="12" height="12" viewBox="0 0 24 24"
                    fill={showFavOnly ? '#f59e0b' : 'none'}
                    stroke={showFavOnly ? '#f59e0b' : 'currentColor'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Favourites ({currentFavCount})
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="hp-grid">
              {filtered.map((c, i) => (
                <CollectionCard
                  key={c.id} collection={c}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => setSelectedCollection(c)}
                  onCustomize={() => openCustomizeModal(c)}
                  onDelete={() => handleDeleteCollection(c.id)}
                  isFav={favIds.has(c.id)}
                  onToggleFav={() => toggleFavCollection(c.id)}
                />
              ))}
              {(activeTab === 'home' || activeTab === 'collections') && (
                <NewCard style={{ animationDelay: `${filtered.length * 0.05}s` }} onClick={openNewCollectionModal} />
              )}
            </div>

            {/* Infinite Scroll Sentinel */}
            <div ref={loaderRef} style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px', paddingBottom: '40px' }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'hp-spin 0.8s linear infinite', color: 'var(--purple)' }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <span style={{ fontWeight: 500, letterSpacing: '0.02em' }}>Fetching more…</span>
                </div>
              )}
              {!hasMore && filtered.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '40px', height: '1px', background: 'var(--border)' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>End of results</span>
                </div>
              )}
            </div>

            {!loading && filtered.length === 0 && (
              <div className="hp-empty">
                <div className="hp-empty-icon">⊘</div>
                {activeTab === 'shared' ? (
                  <p>No files shared with you</p>
                ) : search ? (
                  <>
                    <p>No collections match <strong>"{search}"</strong></p>
                    <button className="hp-empty-clear" onClick={() => setSearch('')}>Clear search</button>
                  </>
                ) : (
                  <p>No collections yet — create one!</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {selectedCollection && (
        <CollectionModal
          user={user} collection={selectedCollection}
          recentCollections={collections}
          onSelectCollection={setSelectedCollection}
          onClose={() => setSelectedCollection(null)}
          onCustomize={() => openCustomizeModal(selectedCollection)}
        />
      )}
      {newCollOpen && (
        <NewCollectionModal
          existing={editingColl}
          onClose={() => { setNewCollOpen(false); setEditingColl(null); }}
          onSave={handleSaveCollection}
        />
      )}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => { setImportOpen(false); fetchCollections(1, true); }}
        />
      )}
      {isTeamMode && showTeamFeed && (
        <TeamActivityFeed onClose={() => setShowTeamFeed(false)} />
      )}
    </div>
  );
}