import { useState, useMemo, useRef, useEffect } from 'react';
import CollectionModal from '../components/CollectionModal';
import NewCollectionModal from '../components/NewCollectionModal';
import ImportModal from '../components/ImportModal';
import TeamPanel from '../components/TeamPanel';
import TeamActivityFeed from '../components/TeamActivityFeed';
import { useTeam, PALETTES } from '../context/TeamContext';
import { getCollections, getCollection, createCollection, updateCollection, deleteCollection, toggleFavoriteCollection, getFavoriteCollections, getSharedCollections } from '../api/homePage.api';
import { getHistory } from '../api/history.api';
import './HomePage.css';

// ─── Initial Data (now lives in state so it's mutable) ────────────────────────
// `requests` is an array of request objects — the shape the backend will return
const SORT_OPTIONS = ['Last Modified', 'Name A–Z', 'Name Z–A', 'Most Requests'];

const METHOD_COLORS = {
  GET:    { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  POST:   { bg: 'rgba(108,63,197,0.12)', text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.12)', text: '#0ea5e9' },
};

// ─── SVG Thumbnail Patterns ───────────────────────────────────────────────────
function Thumbnail({ color, pattern }) {
  const opacity = 0.18;
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
      <rect width="100%" height="100%" fill={color} opacity={0.08} />
      {pattern === 'waves' && (
        <g stroke={color} strokeWidth="1.5" fill="none" opacity={opacity}>
          {[0,20,40,60,80,100].map(y => (
            <path key={y} d={`M0 ${y} Q40 ${y-12} 80 ${y} Q120 ${y+12} 160 ${y} Q200 ${y-12} 240 ${y}`} />
          ))}
        </g>
      )}
      {pattern === 'grid' && (
        <g stroke={color} strokeWidth="1" opacity={opacity}>
          {[0,20,40,60,80,100,120].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100%" />)}
          {[0,20,40,60,80,100].map(y => <line key={`h${y}`} x1="0" y1={y} x2="100%" y2={y} />)}
        </g>
      )}
      {pattern === 'dots' && (
        <g fill={color} opacity={opacity}>
          {[16,48,80,112,144,176,208].flatMap(x =>
            [14,42,70,98].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r="3" />)
          )}
        </g>
      )}
      {pattern === 'lines' && (
        <g stroke={color} strokeWidth="1.5" opacity={opacity}>
          {[0,16,32,48,64,80,96,112].map(i => (
            <line key={i} x1={i * 2} y1="0" x2="0" y2={i * 2} />
          ))}
        </g>
      )}
      {pattern === 'cross' && (
        <g stroke={color} strokeWidth="1.5" opacity={opacity}>
          {[24,72,120,168].flatMap(x =>
            [18,54,90].map(y => (
              <g key={`${x}${y}`}>
                <line x1={x-6} y1={y} x2={x+6} y2={y} />
                <line x1={x} y1={y-6} x2={x} y2={y+6} />
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
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="hc-menu-wrap" ref={ref}>
      <button
        className="hc-card-menu"
        title="Options"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
        </svg>
      </button>
      {open && (
        <div className="hc-menu-dropdown" onClick={e => e.stopPropagation()}>
          <button className="hc-menu-item" onClick={() => { setOpen(false); onOpen(); }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="1" y="2" width="11" height="9" rx="1.5"/><path d="M4 5h5M4 7.5h3"/>
            </svg>
            Open
          </button>
          <button className="hc-menu-item" onClick={() => { setOpen(false); onCustomize(); }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="1.5"/><path d="M6.5 1v1.5M6.5 9.5V11M1 6.5h1.5M9.5 6.5H11M2.9 2.9l1.1 1.1M8.9 8.9l1.1 1.1M2.9 10.1l1.1-1.1M8.9 4.1l1.1-1.1"/>
            </svg>
            Customize
          </button>
          <div className="hc-menu-divider"/>
          <button className="hc-menu-item hc-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3.5h9M5.5 3.5V2.5h2V3.5M5 3.5v7M8 3.5v7M3 3.5l.5 7.5h5.5l.5-7.5"/>
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
  const method = METHOD_COLORS[collection.default_method] || METHOD_COLORS.GET;
  const days = Math.floor((Date.now() - new Date(collection.updated_at)) / 86400000);
  const timeStr = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;

  return (
    <div className={`hc-card${isFav ? ' hc-card--fav' : ''}`} style={style} onClick={onClick}>
      {/* Thumbnail */}
      <div className="hc-card-thumb" style={{ borderBottom: `2px solid ${collection.accent_color}22` }}>
        <Thumbnail color={collection.accent_color} pattern={collection.pattern} />
        <div className="hc-card-method" style={{ background: method.bg, color: method.text }}>
          {collection.default_method}
        </div>
        {/* ── Favourite star ── */}
        <button
          className={`hc-fav-btn${isFav ? ' hc-fav-btn--on' : ''}`}
          title={isFav ? 'Remove from favourites' : 'Add to favourites'}
          onClick={e => { e.stopPropagation(); onToggleFav?.(); }}
          aria-label={isFav ? 'Unfavourite' : 'Favourite'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={isFav ? '#f59e0b' : 'none'}
            stroke={isFav ? '#f59e0b' : 'currentColor'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="hc-card-body">
        <div className="hc-card-top">
          <h3 className="hc-card-name">{collection.name || 'Untitled Collection'}</h3>
          <CardMenu
            onOpen={onClick}
            onCustomize={onCustomize}
            onDelete={onDelete}
          />
        </div>

        <div className="hc-card-tags">
          {collection.tags.map(t => (
            <span key={t} className="hc-tag">{t}</span>
          ))}
        </div>

        <div className="hc-card-meta">
          <span className="hc-meta-item">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="10" height="9" rx="1.5"/><path d="M4 1v2M8 1v2M1 5h10"/>
            </svg>
            {timeStr}
          </span>
          <span className="hc-meta-item">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2v8" strokeLinecap="round"/>
            </svg>
            {collection.total_requests ?? (collection.requests || []).length} requests
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
            <path d="M11 4v14M4 11h14"/>
          </svg>
        </div>
        <span>New Collection</span>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ user, onLogout, active, setActive, onQuicky, activeTeam, onClearTeam }) {
  const isTeamMode = !!activeTeam;

  const navItems = [
    { id: 'home', label: isTeamMode ? 'HOME' : 'Home', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/>
      </svg>
    )},
    { id: 'quicky', label: 'Quicky', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m13 2-10 12h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    )},
    { id: 'favorites', label: 'Favorites', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 2l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2z"/>
      </svg>
    )},
    { id: 'shared', label: 'Shared', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 5.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM4 11.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM15 11.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM4 10l5-3M11 7l3.5 3.5"/>
      </svg>
    )},
    { id: 'history', label: 'History', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 2.5"/>
      </svg>
    )},
    { id: 'envs', label: 'Environments', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="6"/><path d="M8 2a9 9 0 010 12M2 8h12"/>
      </svg>
    )},
    { id: 'team', label: 'Team', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="6" cy="6" r="2.5"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/>
        <circle cx="12" cy="5" r="2"/><path d="M14.5 12c0-1.8-1-3-2.5-3"/>
      </svg>
    )},
  ];

  return (
    <aside className="hp-sidebar">
      {/* Logo — shows team name when in team mode */}
      <div className="hp-sidebar-logo">
        {isTeamMode ? (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            onClick={() => onClearTeam?.()}
            title="Click to exit team mode"
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: PALETTES[activeTeam.theme]?.accent || '#6c3fc5',
              boxShadow: `0 0 6px ${PALETTES[activeTeam.theme]?.accent || '#6c3fc5'}`,
            }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.02em' }}>{activeTeam.name}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.4, marginLeft: 'auto' }}>
              <path d="M8 1H11v3M7 5l4-4M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"/>
            </svg>
          </div>
        ) : (
          <>HIT<em>IT</em></>
        )}
      </div>

      <nav className="hp-sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`hp-nav-item ${active === item.id ? 'active' : ''} ${item.id === 'quicky' ? 'hp-nav-item--quicky' : ''}`}
            onClick={() => {
              if (item.id === 'quicky') {
                onQuicky?.();
              } else {
                setActive(item.id);
              }
            }}
            style={item.id === 'home' && isTeamMode ? { fontWeight: 800, letterSpacing: '0.06em' } : {}}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="hp-sidebar-bottom">
        <div className="hp-sidebar-user">
          <div className="hp-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
          <div className="hp-user-info">
            <span className="hp-user-name">{user?.name || 'User'}</span>
            <span className="hp-user-email">{user?.email || ''}</span>
            {isTeamMode && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: PALETTES[activeTeam.theme]?.accent || '#6c3fc5',
                marginTop: '0.15rem',
              }}>
                Team: {activeTeam.name}
              </span>
            )}
          </div>
        </div>
        <button className="hp-sidebar-logout" onClick={onLogout} title="Logout">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 7.5H2M7 4.5l3 3-3 3"/><path d="M6 2H13v11H6"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function HomePage({ user, onLogout }) {
  const { activeTeam, clearTeam, isTeamMode, teamId } = useTeam();

  const [collections, setCollections]         = useState([]);
  const [page, setPage]                       = useState(1);
  const [hasMore, setHasMore]                 = useState(true);
  const [loading, setLoading]                 = useState(false);
  
  const [search, setSearch]                   = useState('');
  const [sort, setSort]                       = useState('Last Modified');
  const [sortOpen, setSortOpen]               = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [favCollections, setFavCollections]   = useState(() => new Set());
  const [showFavOnly, setShowFavOnly]         = useState(false);
  // New/Edit collection modal
  const [newCollOpen, setNewCollOpen]         = useState(false);
  const [editingColl, setEditingColl]         = useState(null); // null = create, obj = edit
  
  // Import collection state
  const [importOpen, setImportOpen]           = useState(false);

  const [activeTab, setActiveTab]             = useState('home');
  const [historyItems, setHistoryItems]       = useState([]);

  // Team Activity Feed toggle
  const [showTeamFeed, setShowTeamFeed]       = useState(false);

  // Reset data when switching between team/personal
  useEffect(() => {
    setCollections([]);
    setHistoryItems([]);
    setPage(1);
    setHasMore(true);
    setSelectedCollection(null);
    if (activeTab === 'team' && !isTeamMode) {
      setActiveTab('home');
    }
  }, [teamId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(1, true);
    } else {
      fetchCollections(1, true);
    }
  }, [user?.id, activeTab]);

  const fetchHistory = async (pageNumber = 1, isReset = false) => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await getHistory(pageNumber, 20, teamId);
      const history = Array.isArray(data) ? data : (data?.history || []);
      
      setHasMore(history.length === 50);
      
      if (isReset) {
        setHistoryItems(history);
      } else {
        setHistoryItems(prev => [...prev, ...history]);
      }
      setPage(pageNumber);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async (pageNumber, isReset = false) => {
    if (!user?.id) return;
    try {
      setLoading(true);
      let response;
      if (activeTab === 'favorites') {
        response = await getFavoriteCollections(pageNumber, 14, teamId);
      } else if (activeTab === 'shared') {
        response = await getSharedCollections(pageNumber, 14, teamId);
      } else {
        response = await getCollections(pageNumber, 14, '', teamId);
      }
      
      let data = Array.isArray(response) ? response : (response?.collections || []);
      
      setHasMore(data.length === 14);
      
      // Sync favorite status from the server response
      setFavCollections(prev => {
        const next = new Set(prev);
        data.forEach(c => {
          if (c.favorite) next.add(c.id);
          else next.delete(c.id);
        });
        return next;
      });

      if (isReset) {
        setCollections(data);
      } else {
        setCollections(prev => {
          const prevArr = Array.isArray(prev) ? prev : [];
          const map = new Map(prevArr.map(c => [c.id, c]));
          data.forEach(c => map.set(c.id, c));
          return Array.from(map.values());
        });
      }
      setPage(pageNumber);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavCollection = async (id) => {
    const isFav = favCollections.has(id);
    try {
      await toggleFavoriteCollection(id, { favorite: !isFav }, teamId);
      setFavCollections(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = useMemo(() => {
    let list = Array.isArray(collections) ? [...collections] : [];
    if (showFavOnly) list = list.filter(c => favCollections.has(c.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    switch (sort) {
      case 'Name A–Z': list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'Name Z–A': list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'Most Requests': list.sort((a, b) => (b.total_requests ?? (b.requests || []).length) - (a.total_requests ?? (a.requests || []).length)); break;
      default: list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }
    return list;
  }, [collections, search, sort, showFavOnly, favCollections]);

  const currentFavCount = useMemo(() => {
    if (!Array.isArray(collections)) return 0;
    return collections.filter(c => favCollections.has(c.id)).length;
  }, [collections, favCollections]);

  const handleQuicky = () => {
    // Open the modal with a special "Quicky" collection
    // This allows it to open immediately independent of existing collections
    setSelectedCollection({
      id: 'quicky',
      name: 'Quick Request',
      isQuicky: true,
      requests: [{
        id: 'quicky-req',
        name: 'Untitled Request',
        method: 'GET',
        url: '',
        headers: [],
        params: [],
        body: '',
        auth: 'No Auth'
      }]
    });
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openNewCollectionModal = () => {
    setEditingColl(null);
    setNewCollOpen(true);
  };

  const openCustomizeModal = (collection, e) => {
    if (e) e.stopPropagation();
    setEditingColl(collection);
    setNewCollOpen(true);
  };

  const handleSaveCollection = async (collection, isEdit) => {
    try {
      // Ensure timestamps match backend expectations
      const payload = {
        ...collection,
        updated_at: new Date().toISOString(),
        ...(isEdit ? {} : { created_at: new Date().toISOString() })
      };

      let savedCollection;
      if (isEdit) {
        savedCollection = await updateCollection(payload.id, payload, teamId);
      } else {
        savedCollection = await createCollection(payload, teamId);
      }

      if (isEdit) {
        // Update existing
        setCollections(prev => prev.map(c => c.id === savedCollection.id ? savedCollection : c));
        // If the currently-open modal is this one, sync its display
        if (selectedCollection?.id === savedCollection.id) setSelectedCollection(savedCollection);
      } else {
        // Add new and open it immediately
        setCollections(prev => [savedCollection, ...prev]);
        setSelectedCollection(savedCollection);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCollection = async (id) => {
    try {
      await deleteCollection(id, teamId);
      setCollections(prev => prev.filter(c => c.id !== id));
      if (selectedCollection?.id === id) setSelectedCollection(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="hp-root">
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        active={activeTab} 
        setActive={setActiveTab} 
        onQuicky={handleQuicky}
        activeTeam={activeTeam}
        onClearTeam={clearTeam}
      />

      <div className="hp-main">
        {/* Top bar */}
        <header className="hp-topbar">
          <div className="hp-topbar-left">
            <h1 className="hp-page-title">
              {activeTab === 'history'
                ? 'Execution History'
                : activeTab === 'team'
                  ? 'Teams & Organization'
                  : isTeamMode
                    ? `${activeTeam.name} — Collections`
                    : 'Collections'}
            </h1>
          </div>
          <div className="hp-topbar-right" style={{ display: 'flex', gap: '8px' }}>
            {/* Team Feed toggle (only in team mode) */}
            {isTeamMode && activeTab !== 'team' && (
              <button
                className="hp-btn-new"
                style={{ background: showTeamFeed ? 'var(--purple-mid)' : '#4b5563', borderColor: showTeamFeed ? 'var(--purple-mid)' : '#4b5563' }}
                onClick={() => setShowTeamFeed(v => !v)}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1h4v5H1zM8 1h4v4H8zM8 7h4v5H8zM1 8h4v4H1z"/>
                </svg>
                {showTeamFeed ? 'Hide Feed' : 'Team Feed'}
              </button>
            )}
            {(activeTab === 'home' || activeTab === 'collections' || activeTab === 'favorites' || activeTab === 'shared') && (
              <>
                <button className="hp-btn-new" onClick={() => setImportOpen(true)} style={{ background: '#4b5563', borderColor: '#4b5563' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6.5 1v8M3.5 6l3 3 3-3M1 11h11"/>
                  </svg>
                  Import
                </button>
                <button className="hp-btn-new" onClick={openNewCollectionModal}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6.5 1v11M1 6.5h11"/>
                  </svg>
                  New Collection
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'team' ? (
          <div className="hp-team-view" style={{ padding: '1.5rem 2.4rem 3rem' }}>
            {/* Organization Section */}
            <div className="hp-org-section">
              <h2 className="hp-section-title">Organization</h2>
              <div className="hp-org-card">
                <div className="hp-org-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M13 3l8 4v14M9 11v2M9 15v2M17 11v2M17 15v2"/></svg>
                </div>
                <div className="hp-org-details">
                  <h3>Acme Corp</h3>
                  <div className="hp-org-meta">
                    <span className="hp-badge hp-badge--role">Member</span>
                    <span className="hp-meta-dot">•</span>
                    <span>120 Members</span>
                    <span className="hp-meta-dot">•</span>
                    <span className="hp-meta-muted">Assigned via Backend</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Teams Section — now uses TeamPanel component */}
            <TeamPanel />
          </div>
        ) : activeTab === 'history' ? (
          <div className="hp-history-view" style={{ padding: '0 2.4rem 3rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="hp-empty">
                <div className="hp-empty-icon">◷</div>
                <p>No execution history found</p>
              </div>
            ) : (
              <div className="hp-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                {historyItems.map((h, i) => (
                  <div key={h.id || i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', cursor: 'default' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '0.05em', background: METHOD_COLORS[h.method]?.bg || 'rgba(255,255,255,0.1)', color: METHOD_COLORS[h.method]?.text || '#fff' }}>
                          {h.method || 'GET'}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>{h.url || 'Unknown URL'}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5"/><path d="M4 1.5v2M8 1.5v2M1.5 5.5h9"/></svg>
                        {new Date(h.executed_at || Date.now()).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: (h.status_code >= 400 ? '#ef4444' : '#10b981') }}>
                        {h.status_code || 200}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'var(--bg-2)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        {h.response_time_ms || 0} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Toolbar: search + sort */}
            <div className="hp-toolbar">
              <div className="hp-search-wrap">
                <svg className="hp-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5l3 3"/>
                </svg>
                <input
                  className="hp-search"
                  type="text"
                  placeholder="Search collections, tags…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="hp-search-clear" onClick={() => setSearch('')}>×</button>
                )}
              </div>

              <div className="hp-sort-wrap">
                <button className="hp-sort-btn" onClick={() => setSortOpen(!sortOpen)}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 3h11M3 6.5h7M5 10h3"/>
                  </svg>
                  {sort}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d={sortOpen ? "M2 7l3-3 3 3" : "M2 3l3 3 3-3"}/>
                  </svg>
                </button>
                {sortOpen && (
                  <div className="hp-sort-dropdown">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        className={`hp-sort-option ${sort === opt ? 'active' : ''}`}
                        onClick={() => { setSort(opt); setSortOpen(false); }}
                      >
                        {sort === opt && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 5l2.5 2.5L8 3"/>
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
                <button
                  className={`hp-fav-filter${showFavOnly ? ' active' : ''}`}
                  onClick={() => setShowFavOnly(v => !v)}
                  title={showFavOnly ? 'Show all collections' : 'Show favourites only'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24"
                    fill={showFavOnly ? '#f59e0b' : 'none'}
                    stroke={showFavOnly ? '#f59e0b' : 'currentColor'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Favourites ({currentFavCount})
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="hp-grid">
          {filtered.map((c, i) => (
            <CollectionCard
              key={c.id}
              collection={c}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => {
                setSelectedCollection(c);
              }}
              onCustomize={() => openCustomizeModal(c)}
              onDelete={() => handleDeleteCollection(c.id)}
              isFav={favCollections.has(c.id)}
              onToggleFav={() => toggleFavCollection(c.id)}
            />
          ))}
          {(activeTab === 'home' || activeTab === 'collections') && (
            <NewCard
              style={{ animationDelay: `${filtered.length * 0.05}s` }}
              onClick={openNewCollectionModal}
            />
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && hasMore && (
          <div className="hp-pagination" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', paddingBottom: '24px' }}>
            {activeTab === 'history' ? (
              <button 
                className="hp-btn-load-more" 
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--purple)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => fetchHistory(page + 1)}
              >
                Load More History
              </button>
            ) : (
              collections.length < 20 ? (
                <button 
                  className="hp-btn-load-more" 
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => fetchCollections(page + 1)}
                >
                  Load More
                </button>
              ) : (
                <button 
                  className="hp-btn-next" 
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => fetchCollections(page + 1, true)}
                >
                  Next
                </button>
              )
            )}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '24px', paddingBottom: '24px', color: '#6b7280' }}>
            Loading collections...
          </div>
        )}

            {filtered.length === 0 && (
              <div className="hp-empty">
                <div className="hp-empty-icon">⊘</div>
                {activeTab === 'shared' ? (
                  <p>No file shared with you</p>
                ) : (
                  <>
                    <p>No collections match <strong>"{search}"</strong></p>
                    <button className="hp-empty-clear" onClick={() => setSearch('')}>Clear search</button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Collection viewer modal */}
      {selectedCollection && (
        <CollectionModal
          user={user}
          collection={selectedCollection}
          recentCollections={collections}
          onSelectCollection={setSelectedCollection}
          onClose={() => setSelectedCollection(null)}
          onCustomize={() => openCustomizeModal(selectedCollection)}
        />
      )}

      {/* New / Edit collection modal */}
      {newCollOpen && (
        <NewCollectionModal
          existing={editingColl}
          onClose={() => { setNewCollOpen(false); setEditingColl(null); }}
          onSave={handleSaveCollection}
        />
      )}

      {/* Import Modal */}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            fetchCollections(1, true);
          }}
        />
      )}

      {/* Team Activity Feed — right sidebar */}
      {isTeamMode && showTeamFeed && (
        <TeamActivityFeed onClose={() => setShowTeamFeed(false)} />
      )}
    </div>
  );
}