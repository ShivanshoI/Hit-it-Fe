import { useState, useRef, useEffect } from 'react';
import './CollectionModal.css';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_CURLS = [
  { id: 1, name: 'Get User by ID',      method: 'GET',    url: 'https://api.hitit.dev/users/:id',           status: 200, time: '142ms' },
  { id: 2, name: 'Create User',          method: 'POST',   url: 'https://api.hitit.dev/users',               status: 201, time: '208ms' },
  { id: 3, name: 'Update User',          method: 'PUT',    url: 'https://api.hitit.dev/users/:id',           status: 200, time: '175ms' },
  { id: 4, name: 'Delete User',          method: 'DELETE', url: 'https://api.hitit.dev/users/:id',           status: 204, time: '98ms'  },
  { id: 5, name: 'List All Users',       method: 'GET',    url: 'https://api.hitit.dev/users?page=1',        status: 200, time: '310ms' },
  { id: 6, name: 'Auth Token Exchange',  method: 'POST',   url: 'https://api.hitit.dev/auth/token',          status: 200, time: '189ms' },
];

const MOCK_RECENT = [
  { id: 1, name: 'Auth Service',       method: 'POST', color: '#7c3aed' },
  { id: 2, name: 'Payment Gateway',    method: 'POST', color: '#0ea5e9' },
  { id: 3, name: 'User Profiles API',  method: 'GET',  color: '#10b981' },
  { id: 4, name: 'Webhook Listeners',  method: 'WS',   color: '#f59e0b' },
  { id: 5, name: 'Search Endpoints',   method: 'GET',  color: '#ec4899' },
];

const RECENT_SORT = ['Last Opened', 'Name A–Z', 'Most Used'];

const METHOD_STYLE = {
  GET:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  POST:   { bg: 'rgba(124,58,237,0.12)', text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.12)', text: '#0ea5e9' },
};

const STATUS_COLOR = { 2: '#10b981', 3: '#f59e0b', 4: '#ef4444', 5: '#ef4444' };

const MOCK_RESPONSE = `{
  "id": "usr_01HX4K9B2M",
  "name": "Shivansh Yadav",
  "email": "shivansh@hitit.dev",
  "role": "admin",
  "created_at": "2026-01-15T08:32:11Z",
  "metadata": {
    "plan": "pro",
    "requests_this_month": 4821,
    "last_active": "2026-02-23T14:10:00Z"
  }
}`;

const MOCK_COMMENTS = [
  { id: 1, author: 'Shivansh', avatar: 'S', time: '2h ago', text: 'Auth header must be Bearer token — session tokens will 401.', resolved: false },
  { id: 2, author: 'Priya',    avatar: 'P', time: '1d ago', text: 'Rate limit is 100 req/min per IP. Add retry logic.', resolved: true  },
  { id: 3, author: 'Dev',      avatar: 'D', time: '3d ago', text: 'Response includes deprecated fields — ignore `legacy_id`.', resolved: false },
];

// ─── Method Badge ─────────────────────────────────────────────────────────────
function MethodBadge({ method, small }) {
  const s = METHOD_STYLE[method] || METHOD_STYLE.GET;
  return (
    <span className={`cm-badge ${small ? 'cm-badge--sm' : ''}`} style={{ background: s.bg, color: s.text }}>
      {method}
    </span>
  );
}

// ─── Left Panel — Curl List ───────────────────────────────────────────────────
function CurlPanel({ curls, activeCurl, onSelect, open }) {
  return (
    <div className={`cm-curl-panel ${open ? 'cm-curl-panel--open' : ''}`}>
      <div className="cm-curl-panel-head">
        <span>Requests</span>
        <button className="cm-icon-btn" title="Add request">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6.5 1v11M1 6.5h11"/>
          </svg>
        </button>
      </div>
      <div className="cm-curl-list">
        {curls.map((curl, i) => (
          <button
            key={curl.id}
            className={`cm-curl-item ${activeCurl?.id === curl.id ? 'active' : ''}`}
            onClick={() => onSelect(curl)}
            style={{ animationDelay: open ? `${i * 0.04}s` : '0s' }}
          >
            <MethodBadge method={curl.method} small />
            <span className="cm-curl-item-name">{curl.name}</span>
            {curl.status && (
              <span className="cm-curl-status" style={{ color: STATUS_COLOR[Math.floor(curl.status / 100)] }}>
                {curl.status}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Comments Panel ───────────────────────────────────────────────────────────
function CommentsPanel({ open, onClose }) {
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [draft, setDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const visible = comments.filter(c => showResolved || !c.resolved);

  const addComment = () => {
    if (!draft.trim()) return;
    setComments(prev => [...prev, {
      id: Date.now(), author: 'You', avatar: 'Y', time: 'just now', text: draft.trim(), resolved: false,
    }]);
    setDraft('');
  };

  return (
    <div className={`cm-comments-panel ${open ? 'cm-comments-panel--open' : ''}`}>
      <div className="cm-comments-head">
        <span>Comments</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className={`cm-resolve-toggle ${showResolved ? 'active' : ''}`}
            onClick={() => setShowResolved(!showResolved)}
            title="Show resolved"
          >
            Resolved
          </button>
          <button className="cm-icon-btn" onClick={onClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="cm-comments-list">
        {visible.length === 0 && (
          <div className="cm-comments-empty">No comments yet. Start a thread below.</div>
        )}
        {visible.map(c => (
          <div key={c.id} className={`cm-comment ${c.resolved ? 'cm-comment--resolved' : ''}`}>
            <div className="cm-comment-avatar">{c.avatar}</div>
            <div className="cm-comment-body">
              <div className="cm-comment-meta">
                <span className="cm-comment-author">{c.author}</span>
                <span className="cm-comment-time">{c.time}</span>
                {c.resolved && <span className="cm-resolved-badge">Resolved</span>}
              </div>
              <p className="cm-comment-text">{c.text}</p>
              {!c.resolved && (
                <button
                  className="cm-resolve-btn"
                  onClick={() => setComments(prev => prev.map(x => x.id === c.id ? { ...x, resolved: true } : x))}
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cm-comment-input-wrap">
        <textarea
          className="cm-comment-input"
          placeholder="Add a comment…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }}
          rows={2}
        />
        <div className="cm-comment-actions">
          <span className="cm-comment-hint">⌘↵ to post</span>
          <button className="cm-post-btn" onClick={addComment} disabled={!draft.trim()}>Post</button>
        </div>
      </div>
    </div>
  );
}

// ─── Recent Tabs strip ────────────────────────────────────────────────────────
function RecentTabs({ onClose }) {
  const [sort, setSort] = useState('Last Opened');
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <div className="cm-recent-strip">
      <div className="cm-recent-header">
        <span className="cm-recent-title">Recent</span>
        <div className="cm-recent-sort-wrap">
          <button className="cm-recent-sort-btn" onClick={() => setSortOpen(!sortOpen)}>
            {sort}
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d={sortOpen ? "M1 6l3.5-3.5L8 6" : "M1 3l3.5 3.5L8 3"}/>
            </svg>
          </button>
          {sortOpen && (
            <div className="cm-recent-dropdown">
              {RECENT_SORT.map(opt => (
                <button
                  key={opt}
                  className={`cm-recent-opt ${sort === opt ? 'active' : ''}`}
                  onClick={() => { setSort(opt); setSortOpen(false); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="cm-recent-tabs">
        {MOCK_RECENT.map(r => (
          <button key={r.id} className="cm-recent-tab" style={{ '--col': r.color }}>
            <span className="cm-recent-dot" style={{ background: r.color }} />
            <span className="cm-recent-tab-name">{r.name}</span>
            <MethodBadge method={r.method} small />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CollectionModal({ collection, onClose }) {
  const [curlPanelOpen, setCurlPanelOpen] = useState(false);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeCurl, setActiveCurl] = useState(MOCK_CURLS[0]);
  const [activeTab, setActiveTab] = useState('body');  // body | headers | auth | params
  const [url, setUrl] = useState(MOCK_CURLS[0].url);
  const [method, setMethod] = useState(MOCK_CURLS[0].method);
  const [methodOpen, setMethodOpen] = useState(false);
  const [recentHover, setRecentHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(MOCK_RESPONSE);
  const [responseSaved, setResponseSaved] = useState(false);
  const [collComment, setCollComment] = useState('');
  const recentTimer = useRef(null);

  const TABS = ['body', 'headers', 'auth', 'params'];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSelectCurl = (curl) => {
    setActiveCurl(curl);
    setUrl(curl.url);
    setMethod(curl.method);
  };

  const handleSend = () => {
    setLoading(true);
    setResponse('');
    setTimeout(() => {
      setLoading(false);
      setResponse(MOCK_RESPONSE);
    }, 900);
  };

  const handleSaveResponse = () => {
    setResponseSaved(true);
    setTimeout(() => setResponseSaved(false), 2200);
  };

  const handleRecentEnter = () => {
    clearTimeout(recentTimer.current);
    setRecentHover(true);
  };
  const handleRecentLeave = () => {
    recentTimer.current = setTimeout(() => setRecentHover(false), 300);
  };

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Modal Header ──────────────────────────────────────────────────── */}
        <div className="cm-modal-header">
          <div className="cm-modal-header-left">
            {/* Toggle curl panel */}
            <button
              className={`cm-panel-toggle ${curlPanelOpen ? 'active' : ''}`}
              onClick={() => setCurlPanelOpen(!curlPanelOpen)}
              title="Toggle request list"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <rect x="1.5" y="1.5" width="12" height="12" rx="2"/>
                <path d="M5.5 1.5v12"/>
              </svg>
            </button>
            <div className="cm-modal-title-group">
              <span className="cm-modal-collection-name">{collection?.name || 'Auth Service'}</span>
              <div className="cm-modal-breadcrumb">
                <span>{activeCurl?.name}</span>
              </div>
            </div>
          </div>

          <div className="cm-modal-header-right">
            {/* Comments toggle */}
            <button
              className={`cm-icon-btn-label ${commentsPanelOpen ? 'active' : ''}`}
              onClick={() => setCommentsPanelOpen(!commentsPanelOpen)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2l3 3 3-3h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              Comments
              <span className="cm-comment-count">{MOCK_COMMENTS.filter(c => !c.resolved).length}</span>
            </button>
            <button className="cm-close-btn" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Modal Body ────────────────────────────────────────────────────── */}
        <div className="cm-modal-body">

          {/* Left curl panel */}
          <CurlPanel
            curls={MOCK_CURLS}
            activeCurl={activeCurl}
            onSelect={handleSelectCurl}
            open={curlPanelOpen}
          />

          {/* Main workspace */}
          <div className="cm-workspace">

            {/* URL bar */}
            <div className="cm-url-bar">
              <div className="cm-method-wrap">
                <button className="cm-method-btn" onClick={() => setMethodOpen(!methodOpen)}>
                  <MethodBadge method={method} />
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 3l3.5 3.5L8 3"/>
                  </svg>
                </button>
                {methodOpen && (
                  <div className="cm-method-dropdown">
                    {Object.keys(METHOD_STYLE).map(m => (
                      <button key={m} className={`cm-method-opt ${method === m ? 'active' : ''}`}
                        onClick={() => { setMethod(m); setMethodOpen(false); }}>
                        <MethodBadge method={m} small />
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="cm-url-input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
              />
              <button className="cm-send-btn" onClick={handleSend} disabled={loading}>
                {loading
                  ? <span className="cm-spin" />
                  : <>Send <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 5.5h9M6.5 2l3.5 3.5L6.5 9"/></svg></>
                }
              </button>
            </div>

            {/* Tabs */}
            <div className="cm-tabs">
              {TABS.map(t => (
                <button
                  key={t}
                  className={`cm-tab ${activeTab === t ? 'active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="cm-tab-content">
              {activeTab === 'body' && (
                <div className="cm-editor-wrap">
                  <div className="cm-editor-toolbar">
                    <span className="cm-editor-label">Request Body</span>
                    <span className="cm-editor-type">JSON</span>
                  </div>
                  <textarea className="cm-editor" defaultValue={`{\n  "id": ":id"\n}`} spellCheck={false} />
                </div>
              )}
              {activeTab === 'headers' && (
                <div className="cm-kv-table">
                  <div className="cm-kv-header">
                    <span>Key</span><span>Value</span><span />
                  </div>
                  {[['Authorization', 'Bearer {{token}}'], ['Content-Type', 'application/json'], ['X-Request-ID', '{{$randomUUID}}']].map(([k, v], i) => (
                    <div key={i} className="cm-kv-row">
                      <input className="cm-kv-input" defaultValue={k} />
                      <input className="cm-kv-input" defaultValue={v} />
                      <button className="cm-kv-del">×</button>
                    </div>
                  ))}
                  <button className="cm-kv-add">+ Add header</button>
                </div>
              )}
              {activeTab === 'auth' && (
                <div className="cm-auth-panel">
                  <div className="cm-auth-type">
                    <span className="cm-auth-label">Type</span>
                    <select className="cm-auth-select">
                      <option>Bearer Token</option>
                      <option>API Key</option>
                      <option>Basic Auth</option>
                      <option>OAuth 2.0</option>
                      <option>No Auth</option>
                    </select>
                  </div>
                  <div className="cm-kv-row" style={{ marginTop: '1rem' }}>
                    <span className="cm-auth-label" style={{ width: 80 }}>Token</span>
                    <input className="cm-kv-input" defaultValue="{{auth_token}}" style={{ flex: 1 }} />
                  </div>
                </div>
              )}
              {activeTab === 'params' && (
                <div className="cm-kv-table">
                  <div className="cm-kv-header"><span>Key</span><span>Value</span><span /></div>
                  {[['page', '1'], ['limit', '20']].map(([k, v], i) => (
                    <div key={i} className="cm-kv-row">
                      <input className="cm-kv-input" defaultValue={k} />
                      <input className="cm-kv-input" defaultValue={v} />
                      <button className="cm-kv-del">×</button>
                    </div>
                  ))}
                  <button className="cm-kv-add">+ Add param</button>
                </div>
              )}
            </div>

            {/* Response */}
            <div className="cm-response-section">
              <div className="cm-response-header">
                <div className="cm-response-header-left">
                  <span className="cm-response-label">Response</span>
                  {response && !loading && (
                    <>
                      <span className="cm-response-status" style={{ color: STATUS_COLOR[2] }}>200 OK</span>
                      <span className="cm-response-time">142ms</span>
                      <span className="cm-response-size">0.8 KB</span>
                    </>
                  )}
                </div>
                {response && !loading && (
                  <button
                    className={`cm-save-btn ${responseSaved ? 'saved' : ''}`}
                    onClick={handleSaveResponse}
                  >
                    {responseSaved ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l2.5 2.5L10 3"/>
                        </svg>
                        Saved!
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                          <path d="M2 2h6l2 2v6a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M3 2v3h5V2M3 7h6"/>
                        </svg>
                        Save Response
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="cm-response-body">
                {loading && (
                  <div className="cm-response-loading">
                    <div className="cm-loading-dots"><span/><span/><span/></div>
                    <span>Sending request…</span>
                  </div>
                )}
                {!loading && response && (
                  <pre className="cm-response-pre">{response}</pre>
                )}
                {!loading && !response && (
                  <div className="cm-response-empty">Hit Send to see the response</div>
                )}
              </div>
            </div>

            {/* Collection-level comment */}
            <div className="cm-coll-comment">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M11 1H2a1 1 0 00-1 1v6a1 1 0 001 1h2l2.5 2.5L9 9h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              <input
                className="cm-coll-comment-input"
                placeholder="Add a note to this collection…"
                value={collComment}
                onChange={e => setCollComment(e.target.value)}
              />
              {collComment && <button className="cm-coll-comment-save" onClick={() => setCollComment('')}>Save</button>}
            </div>
          </div>

          {/* Comments panel */}
          <CommentsPanel open={commentsPanelOpen} onClose={() => setCommentsPanelOpen(false)} />
        </div>

        {/* ── Recent tabs — hover to reveal ─────────────────────────────────── */}
        <div
          className="cm-recent-trigger"
          onMouseEnter={handleRecentEnter}
          onMouseLeave={handleRecentLeave}
        >
          <div className={`cm-recent-peek ${recentHover ? 'cm-recent-peek--open' : ''}`}>
            <RecentTabs />
          </div>
          <div className="cm-recent-handle">
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d={recentHover ? "M2 6l6-4 6 4" : "M2 2l6 4 6-4"}/>
            </svg>
            <span>Recent collections</span>
          </div>
        </div>

      </div>
    </div>
  );
}