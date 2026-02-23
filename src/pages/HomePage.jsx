import { useState, useMemo } from 'react';
import CollectionModal from '../components/CollectionModal';
import './HomePage.css';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_COLLECTIONS = [
  {
    id: 1, name: 'Auth Service', tags: ['REST', 'OAuth'],
    modified: '2026-02-21', requests: 14, method: 'POST',
    color: '#7c3aed', pattern: 'waves',
  },
  {
    id: 2, name: 'Payment Gateway', tags: ['REST', 'Stripe'],
    modified: '2026-02-20', requests: 8, method: 'POST',
    color: '#0ea5e9', pattern: 'grid',
  },
  {
    id: 3, name: 'User Profiles API', tags: ['GraphQL'],
    modified: '2026-02-18', requests: 22, method: 'GET',
    color: '#10b981', pattern: 'dots',
  },
  {
    id: 4, name: 'Webhook Listeners', tags: ['WebSocket', 'Events'],
    modified: '2026-02-15', requests: 6, method: 'WS',
    color: '#f59e0b', pattern: 'lines',
  },
  {
    id: 5, name: 'Search Endpoints', tags: ['REST', 'Elastic'],
    modified: '2026-02-12', requests: 11, method: 'GET',
    color: '#ec4899', pattern: 'cross',
  },
  {
    id: 6, name: 'Notification Service', tags: ['REST', 'Firebase'],
    modified: '2026-02-10', requests: 9, method: 'POST',
    color: '#6366f1', pattern: 'waves',
  },
];

const SORT_OPTIONS = ['Last Modified', 'Name A–Z', 'Name Z–A', 'Most Requests'];

const METHOD_COLORS = {
  GET:  { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  POST: { bg: 'rgba(108,63,197,0.12)', text: '#7c3aed' },
  PUT:  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  DEL:  { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  WS:   { bg: 'rgba(14,165,233,0.12)', text: '#0ea5e9' },
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
      {/* Corner accent */}
      <circle cx="90%" cy="85%" r="28" fill={color} opacity={0.12} />
      <circle cx="90%" cy="85%" r="14" fill={color} opacity={0.1} />
    </svg>
  );
}

// ─── Collection Card ──────────────────────────────────────────────────────────
function CollectionCard({ collection, style, onClick }) {
  const method = METHOD_COLORS[collection.method] || METHOD_COLORS.GET;
  const days = Math.floor((Date.now() - new Date(collection.modified)) / 86400000);
  const timeStr = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;

  return (
    <div className="hc-card" style={style} onClick={onClick}>
      {/* Thumbnail */}
      <div className="hc-card-thumb" style={{ borderBottom: `2px solid ${collection.color}22` }}>
        <Thumbnail color={collection.color} pattern={collection.pattern} />
        <div className="hc-card-method" style={{ background: method.bg, color: method.text }}>
          {collection.method}
        </div>
      </div>

      {/* Body */}
      <div className="hc-card-body">
        <div className="hc-card-top">
          <h3 className="hc-card-name">{collection.name}</h3>
          <button className="hc-card-menu" title="Options">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="7" cy="2" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
            </svg>
          </button>
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
            {collection.requests} requests
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── New Collection Card ──────────────────────────────────────────────────────
function NewCard({ style }) {
  return (
    <div className="hc-card hc-card--new" style={style}>
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
function Sidebar({ user, onLogout }) {
  const [active, setActive] = useState('home');

  const navItems = [
    { id: 'home', label: 'Home', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/>
      </svg>
    )},
    { id: 'collections', label: 'Collections', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
        <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
      </svg>
    )},
    { id: 'envs', label: 'Environments', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="6"/><path d="M8 2a9 9 0 010 12M2 8h12"/>
      </svg>
    )},
    { id: 'history', label: 'History', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 1.5"/>
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
      <div className="hp-sidebar-logo">
        HIT<em>IT</em>
      </div>

      <nav className="hp-sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`hp-nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => setActive(item.id)}
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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Last Modified');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const filtered = useMemo(() => {
    let list = [...MOCK_COLLECTIONS];
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
      case 'Most Requests': list.sort((a, b) => b.requests - a.requests); break;
      default: list.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    }
    return list;
  }, [search, sort]);

  return (
    <div className="hp-root">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="hp-main">
        {/* Top bar */}
        <header className="hp-topbar">
          <div className="hp-topbar-left">
            <h1 className="hp-page-title">Collections</h1>
          </div>
          <button className="hp-btn-new">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 1v11M1 6.5h11"/>
            </svg>
            New Collection
          </button>
        </header>

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
        </div>

        {/* Grid */}
        <div className="hp-grid">
          {filtered.map((c, i) => (
            <CollectionCard
              key={c.id}
              collection={c}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => setSelectedCollection(c)}
            />
          ))}
          <NewCard style={{ animationDelay: `${filtered.length * 0.05}s` }} />
        </div>

        {filtered.length === 0 && (
          <div className="hp-empty">
            <div className="hp-empty-icon">⊘</div>
            <p>No collections match <strong>"{search}"</strong></p>
            <button className="hp-empty-clear" onClick={() => setSearch('')}>Clear search</button>
          </div>
        )}
      </div>

      {selectedCollection && (
        <CollectionModal
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
        />
      )}
    </div>
  );
}