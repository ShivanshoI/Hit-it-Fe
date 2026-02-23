import GlobalStore from './GlobalStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import './CollectionModal.css';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_CURLS = [
  { id: 1, name: 'Get User by ID',     method: 'GET',    url: 'https://api.hitit.dev/users/:id'       },
  { id: 2, name: 'Create User',         method: 'POST',   url: 'https://api.hitit.dev/users'            },
  { id: 3, name: 'Update User',         method: 'PUT',    url: 'https://api.hitit.dev/users/:id'        },
  { id: 4, name: 'Delete User',         method: 'DELETE', url: 'https://api.hitit.dev/users/:id'        },
  { id: 5, name: 'List All Users',      method: 'GET',    url: 'https://api.hitit.dev/users?page=1'     },
  { id: 6, name: 'Auth Token Exchange', method: 'POST',   url: 'https://api.hitit.dev/auth/token'       },
];

// Per-request shared data — headers, params, auth each request "owns"
const CURL_DATA = {
  1: { headers: [{ k:'X-User-Context', v:'admin' },{ k:'Cache-Control', v:'no-cache' }], params: [{ k:'id', v:'usr_01HX4K9B2M' }], auth: 'Bearer', token: '{{auth_token}}', body: '{\n  "id": ":id"\n}' },
  2: { headers: [{ k:'Idempotency-Key', v:'{{$uuid}}' }],                                params: [],                                auth: 'Bearer', token: '{{auth_token}}', body: '{\n  "name": "New User",\n  "email": "user@example.com"\n}' },
  3: { headers: [{ k:'If-Match', v:'"etag_value"' }],                                    params: [{ k:'id', v:'usr_01HX4K9B2M' }], auth: 'Bearer', token: '{{auth_token}}', body: '{\n  "name": "Updated Name"\n}' },
  4: { headers: [],                                                                        params: [{ k:'id', v:'usr_01HX4K9B2M' }], auth: 'Bearer', token: '{{auth_token}}', body: '' },
  5: { headers: [],                                                                        params: [{ k:'page', v:'1' },{ k:'limit', v:'20' }], auth: 'Bearer', token: '{{auth_token}}', body: '' },
  6: { headers: [{ k:'X-Client-ID', v:'hitit_web' }],                                    params: [],                                auth: 'Basic',  token: '{{client_secret}}', body: '{\n  "grant_type": "client_credentials"\n}' },
};

// ── Shared headers across ALL requests (union)
const getAllSharedHeaders = () => {
  const seen = new Map();
  Object.values(CURL_DATA).forEach(d =>
    d.headers.forEach(h => { if (h.k && !seen.has(h.k)) seen.set(h.k, h.v); })
  );
  return [...seen.entries()].map(([k, v]) => ({ k, v }));
};

const getAllSharedParams = () => {
  const seen = new Map();
  Object.values(CURL_DATA).forEach(d =>
    d.params.forEach(p => { if (p.k && !seen.has(p.k)) seen.set(p.k, p.v); })
  );
  return [...seen.entries()].map(([k, v]) => ({ k, v }));
};

// ── Initial global vars for the collection — now managed at app level (HomePage)
// Kept here only as fallback shape reference
const GLOBALS_SHAPE = { id: 0, key: '', value: '', desc: '' };

const MOCK_RECENT = [
  { id: 1, name: 'Auth Service',      method: 'POST', color: '#7c3aed' },
  { id: 2, name: 'Payment Gateway',   method: 'POST', color: '#0ea5e9' },
  { id: 3, name: 'User Profiles API', method: 'GET',  color: '#10b981' },
  { id: 4, name: 'Webhook Listeners', method: 'WS',   color: '#f59e0b' },
  { id: 5, name: 'Search Endpoints',  method: 'GET',  color: '#ec4899' },
];
const RECENT_SORT = ['Last Opened', 'Name A–Z', 'Most Used'];

const METHOD_STYLE = {
  GET:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  POST:   { bg: 'rgba(124,58,237,0.12)', text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.12)', text: '#0ea5e9' },
};
const STATUS_COLOR = { 2:'#10b981', 3:'#f59e0b', 4:'#ef4444', 5:'#ef4444' };
const MOCK_RESPONSE = `{\n  "id": "usr_01HX4K9B2M",\n  "name": "Shivansh Yadav",\n  "email": "shivansh@hitit.dev",\n  "role": "admin",\n  "created_at": "2026-01-15T08:32:11Z",\n  "metadata": {\n    "plan": "pro",\n    "requests_this_month": 4821\n  }\n}`;
const MOCK_COMMENTS = [
  { id:1, author:'Shivansh', avatar:'S', time:'2h ago',  text:'Auth header must be Bearer — session tokens 401.', resolved:false },
  { id:2, author:'Priya',    avatar:'P', time:'1d ago',  text:'Rate limit 100 req/min per IP. Add retry logic.',  resolved:true  },
  { id:3, author:'Dev',      avatar:'D', time:'3d ago',  text:'Response has deprecated `legacy_id` — ignore it.', resolved:false },
];

// ─── Method Badge ─────────────────────────────────────────────────────────────
function MethodBadge({ method, small }) {
  const s = METHOD_STYLE[method] || METHOD_STYLE.GET;
  return <span className={`cm-badge${small?' cm-badge--sm':''}`} style={{ background:s.bg, color:s.text }}>{method}</span>;
}

// ─── Shared Value Picker — dropdown that appears on empty field focus ─────────
function SharedPicker({ suggestions, onPick, anchor }) {
  if (!suggestions.length) return null;
  return (
    <div className="cm-shared-picker" style={anchor}>
      <div className="cm-shared-picker-label">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M5 1v8M1 5h8"/>
        </svg>
        Shared across collection
      </div>
      {suggestions.map((s,i) => (
        <button key={i} className="cm-shared-pick-item" onClick={() => onPick(s)}>
          <span className="cm-shared-pick-key">{s.k}</span>
          <span className="cm-shared-pick-val">{s.v}</span>
        </button>
      ))}
    </div>
  );
}

// ─── KV Row with shared picker ────────────────────────────────────────────────
function KVRow({ row, sharedSuggestions, onChange, onDelete, onPickShared }) {
  const [keyFocus, setKeyFocus] = useState(false);
  const [valFocus, setValFocus] = useState(false);
  const showPicker = (keyFocus || valFocus) && !row.k && sharedSuggestions.length > 0;

  return (
    <div className="cm-kv-row-wrap">
      <div className="cm-kv-row">
        <input
          className={`cm-kv-input${!row.k?' cm-kv-input--empty':''}`}
          placeholder="key"
          value={row.k}
          onChange={e => onChange({ ...row, k: e.target.value })}
          onFocus={() => setKeyFocus(true)}
          onBlur={() => setTimeout(()=>setKeyFocus(false), 150)}
        />
        <input
          className={`cm-kv-input${!row.v?' cm-kv-input--empty':''}`}
          placeholder="value"
          value={row.v}
          onChange={e => onChange({ ...row, v: e.target.value })}
          onFocus={() => setValFocus(true)}
          onBlur={() => setTimeout(()=>setValFocus(false), 150)}
        />
        <button className="cm-kv-del" onClick={onDelete}>×</button>
      </div>
      {showPicker && (
        <SharedPicker
          suggestions={sharedSuggestions}
          onPick={s => { onChange(s); setKeyFocus(false); setValFocus(false); }}
        />
      )}
    </div>
  );
}

// ─── Curl Panel (left sidebar in modal) ──────────────────────────────────────
// Globals are defined & edited in the dashboard sidebar — read-only reference here
function CurlPanel({ curls, activeCurl, onSelect, open, globals }) {
  const [globalsOpen, setGlobalsOpen] = useState(false);

  return (
    <div className={`cm-curl-panel${open?' cm-curl-panel--open':''}`}>

      {/* Request list */}
      <div className="cm-curl-panel-head">
        <span>Requests</span>
        <button className="cm-icon-btn" title="Add request">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        </button>
      </div>
      <div className="cm-curl-list">
        {curls.map((curl, i) => (
          <button
            key={curl.id}
            className={`cm-curl-item${activeCurl?.id===curl.id?' active':''}`}
            onClick={() => onSelect(curl)}
            style={{ animationDelay: open ? `${i*0.04}s` : '0s' }}
          >
            <MethodBadge method={curl.method} small />
            <span className="cm-curl-item-name">{curl.name}</span>
          </button>
        ))}
      </div>

      {/* Globals reference — read-only, defined in dashboard sidebar */}
      <div className="cm-globals-toggle-wrap">
        <button
          className={`cm-globals-toggle${globalsOpen?' active':''}`}
          onClick={() => setGlobalsOpen(!globalsOpen)}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="5.5"/><path d="M6.5 1a9 9 0 010 11M1 6.5h11"/>
          </svg>
          <span>Globals</span>
          <span className="cm-globals-count">{globals.length}</span>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d={globalsOpen ? "M1 6l3.5-3.5L8 6" : "M1 3l3.5 3.5L8 3"}/>
          </svg>
        </button>

        {globalsOpen && (
          <div className="cm-globals-readview">
            <p className="cm-globals-readview-note">
              Defined in sidebar · close modal to edit
            </p>
            {globals.length === 0 && (
              <div className="cm-globals-empty">No globals defined yet.</div>
            )}
            {globals.map(g => (
              <div key={g.id} className="cm-globals-chip-row">
                <span className="cm-global-key">{'{{'+g.key+'}}'}</span>
                <span className="cm-global-val">{g.value}</span>
              </div>
            ))}
          </div>
        )}
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
    setComments(p => [...p, { id:Date.now(), author:'You', avatar:'Y', time:'just now', text:draft.trim(), resolved:false }]);
    setDraft('');
  };
  return (
    <div className={`cm-comments-panel${open?' cm-comments-panel--open':''}`}>
      <div className="cm-comments-head">
        <span>Comments</span>
        <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
          <button className={`cm-resolve-toggle${showResolved?' active':''}`} onClick={()=>setShowResolved(!showResolved)}>Resolved</button>
          <button className="cm-icon-btn" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11"/></svg>
          </button>
        </div>
      </div>
      <div className="cm-comments-list">
        {visible.length===0 && <div className="cm-comments-empty">No comments yet.</div>}
        {visible.map(c => (
          <div key={c.id} className={`cm-comment${c.resolved?' cm-comment--resolved':''}`}>
            <div className="cm-comment-avatar">{c.avatar}</div>
            <div className="cm-comment-body">
              <div className="cm-comment-meta">
                <span className="cm-comment-author">{c.author}</span>
                <span className="cm-comment-time">{c.time}</span>
                {c.resolved && <span className="cm-resolved-badge">Resolved</span>}
              </div>
              <p className="cm-comment-text">{c.text}</p>
              {!c.resolved && <button className="cm-resolve-btn" onClick={()=>setComments(p=>p.map(x=>x.id===c.id?{...x,resolved:true}:x))}>Resolve</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="cm-comment-input-wrap">
        <textarea className="cm-comment-input" placeholder="Add a comment…" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))addComment();}} rows={2}/>
        <div className="cm-comment-actions">
          <span className="cm-comment-hint">⌘↵ to post</span>
          <button className="cm-post-btn" onClick={addComment} disabled={!draft.trim()}>Post</button>
        </div>
      </div>

    </div>
  );
}

// ─── Recent Tabs ──────────────────────────────────────────────────────────────
function RecentTabs() {
  const [sort, setSort] = useState('Last Opened');
  const [sortOpen, setSortOpen] = useState(false);
  return (
    <div className="cm-recent-strip">
      <div className="cm-recent-header">
        <span className="cm-recent-title">Recent</span>
        <div className="cm-recent-sort-wrap">
          <button className="cm-recent-sort-btn" onClick={()=>setSortOpen(!sortOpen)}>
            {sort}
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d={sortOpen?"M1 6l3.5-3.5L8 6":"M1 3l3.5 3.5L8 3"}/></svg>
          </button>
          {sortOpen && (
            <div className="cm-recent-dropdown">
              {RECENT_SORT.map(opt=>(
                <button key={opt} className={`cm-recent-opt${sort===opt?' active':''}`} onClick={()=>{setSort(opt);setSortOpen(false);}}>{opt}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="cm-recent-tabs">
        {MOCK_RECENT.map(r=>(
          <button key={r.id} className="cm-recent-tab" style={{'--col':r.color}}>
            <span className="cm-recent-dot" style={{background:r.color}}/>
            <span className="cm-recent-tab-name">{r.name}</span>
            <MethodBadge method={r.method} small/>
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CollectionModal({ collection, onClose, globals = [], setGlobals = () => {} }) {
  const [curlPanelOpen, setCurlPanelOpen]     = useState(false);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeCurl, setActiveCurl]           = useState(MOCK_CURLS[0]);
  const [activeTab, setActiveTab]             = useState('headers');
  const [url, setUrl]                         = useState(MOCK_CURLS[0].url);
  const [method, setMethod]                   = useState(MOCK_CURLS[0].method);
  const [methodOpen, setMethodOpen]           = useState(false);
  const [recentHover, setRecentHover]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [response, setResponse]               = useState(MOCK_RESPONSE);
  const [responseSaved, setResponseSaved]     = useState(false);
  const [collComment, setCollComment]         = useState('');
  const [globalStoreOpen, setGlobalStoreOpen]   = useState(false);
  const recentTimer = useRef(null);

  // Per-request KV state (headers + params)
  const initKV = useCallback((curlId) => ({
    headers: [...(CURL_DATA[curlId]?.headers || [])],
    params:  [...(CURL_DATA[curlId]?.params  || [])],
  }), []);

  const [kvState, setKvState] = useState(() => initKV(MOCK_CURLS[0].id));

  const sharedHeaders = getAllSharedHeaders().filter(s => !kvState.headers.find(h=>h.k===s.k));
  const sharedParams  = getAllSharedParams().filter(s  => !kvState.params.find(p=>p.k===s.k));

  const updateHeader = (i, val) => setKvState(prev => ({ ...prev, headers: prev.headers.map((h,j)=>j===i?val:h) }));
  const deleteHeader = (i)      => setKvState(prev => ({ ...prev, headers: prev.headers.filter((_,j)=>j!==i) }));
  const addHeader    = ()       => setKvState(prev => ({ ...prev, headers: [...prev.headers, { k:'', v:'' }] }));

  const updateParam  = (i, val) => setKvState(prev => ({ ...prev, params: prev.params.map((p,j)=>j===i?val:p) }));
  const deleteParam  = (i)      => setKvState(prev => ({ ...prev, params: prev.params.filter((_,j)=>j!==i) }));
  const addParam     = ()       => setKvState(prev => ({ ...prev, params: [...prev.params, { k:'', v:'' }] }));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSelectCurl = (curl) => {
    setActiveCurl(curl);
    setUrl(curl.url);
    setMethod(curl.method);
    setKvState(initKV(curl.id));
    setResponse('');
  };

  const handleSend = () => {
    setLoading(true); setResponse('');
    setTimeout(() => { setLoading(false); setResponse(MOCK_RESPONSE); }, 900);
  };
  const handleSaveResponse = () => { setResponseSaved(true); setTimeout(()=>setResponseSaved(false),2200); };

  const handleRecentEnter = () => { clearTimeout(recentTimer.current); setRecentHover(true); };
  const handleRecentLeave = () => { recentTimer.current = setTimeout(()=>setRecentHover(false),300); };

  const TABS = ['headers','params','body','auth'];
  const curData = CURL_DATA[activeCurl.id];

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-modal" onClick={e=>e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="cm-modal-header">
          <div className="cm-modal-header-left">
            <button className={`cm-panel-toggle${curlPanelOpen?' active':''}`} onClick={()=>setCurlPanelOpen(!curlPanelOpen)} title="Toggle request list">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <rect x="1.5" y="1.5" width="12" height="12" rx="2"/><path d="M5.5 1.5v12"/>
              </svg>
            </button>
            <div className="cm-modal-title-group">
              <span className="cm-modal-collection-name">{collection?.name||'Auth Service'}</span>
              <div className="cm-modal-breadcrumb"><span>{activeCurl?.name}</span></div>
            </div>
          </div>
          <div className="cm-modal-header-right">
            <button className="cm-icon-btn-label" onClick={()=>setGlobalStoreOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="5.5"/><path d="M6.5 1a9 9 0 010 11M1 6.5h11"/>
              </svg>
              Globals
            </button>
            <button className={`cm-icon-btn-label${commentsPanelOpen?' active':''}`} onClick={()=>setCommentsPanelOpen(!commentsPanelOpen)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2l3 3 3-3h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              Comments
              <span className="cm-comment-count">{MOCK_COMMENTS.filter(c=>!c.resolved).length}</span>
            </button>
            <button className="cm-close-btn" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="cm-modal-body">

          {/* Left curl + globals panel */}
          <CurlPanel
            curls={MOCK_CURLS}
            activeCurl={activeCurl}
            onSelect={handleSelectCurl}
            open={curlPanelOpen}
            globals={globals}
          />

          {/* Workspace */}
          <div className="cm-workspace">

            {/* URL bar */}
            <div className="cm-url-bar">
              <div className="cm-method-wrap">
                <button className="cm-method-btn" onClick={()=>setMethodOpen(!methodOpen)}>
                  <MethodBadge method={method}/>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 3l3.5 3.5L8 3"/></svg>
                </button>
                {methodOpen && (
                  <div className="cm-method-dropdown">
                    {Object.keys(METHOD_STYLE).map(m=>(
                      <button key={m} className={`cm-method-opt${method===m?' active':''}`} onClick={()=>{setMethod(m);setMethodOpen(false);}}>
                        <MethodBadge method={m} small/>{m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input className="cm-url-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"/>
              <button className="cm-send-btn" onClick={handleSend} disabled={loading}>
                {loading ? <span className="cm-spin"/> : <>Send <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 5.5h9M6.5 2l3.5 3.5L6.5 9"/></svg></>}
              </button>
            </div>

            {/* Tabs */}
            <div className="cm-tabs">
              {TABS.map(t=>(
                <button key={t} className={`cm-tab${activeTab===t?' active':''}`} onClick={()=>setActiveTab(t)}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                  {t==='headers' && kvState.headers.length>0 && <span className="cm-tab-count">{kvState.headers.length}</span>}
                  {t==='params'  && kvState.params.length>0  && <span className="cm-tab-count">{kvState.params.length}</span>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="cm-tab-content">

              {/* HEADERS */}
              {activeTab==='headers' && (
                <div className="cm-kv-table">
                  <div className="cm-kv-header"><span>Key</span><span>Value</span><span/></div>
                  {kvState.headers.map((row,i)=>(
                    <KVRow
                      key={i} row={row}
                      sharedSuggestions={sharedHeaders}
                      onChange={val=>updateHeader(i,val)}
                      onDelete={()=>deleteHeader(i)}
                    />
                  ))}
                  <button className="cm-kv-add" onClick={addHeader}>+ Add header</button>
                  {sharedHeaders.length>0 && (
                    <div className="cm-shared-banner">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="5.5" cy="5.5" r="4.5"/><path d="M5.5 4v2.5M5.5 8h.01"/>
                      </svg>
                      {sharedHeaders.length} header{sharedHeaders.length!==1?'s':''} available from other requests — focus an empty row to import
                    </div>
                  )}
                </div>
              )}

              {/* PARAMS */}
              {activeTab==='params' && (
                <div className="cm-kv-table">
                  <div className="cm-kv-header"><span>Key</span><span>Value</span><span/></div>
                  {kvState.params.map((row,i)=>(
                    <KVRow
                      key={i} row={row}
                      sharedSuggestions={sharedParams}
                      onChange={val=>updateParam(i,val)}
                      onDelete={()=>deleteParam(i)}
                    />
                  ))}
                  <button className="cm-kv-add" onClick={addParam}>+ Add param</button>
                  {sharedParams.length>0 && (
                    <div className="cm-shared-banner">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="5.5" cy="5.5" r="4.5"/><path d="M5.5 4v2.5M5.5 8h.01"/>
                      </svg>
                      {sharedParams.length} param{sharedParams.length!==1?'s':''} available from other requests — focus an empty row to import
                    </div>
                  )}
                </div>
              )}

              {/* BODY */}
              {activeTab==='body' && (
                <div className="cm-editor-wrap">
                  <div className="cm-editor-toolbar">
                    <span className="cm-editor-label">Request Body</span>
                    <span className="cm-editor-type">JSON</span>
                  </div>
                  <textarea className="cm-editor" defaultValue={curData?.body||''} spellCheck={false}/>
                </div>
              )}

              {/* AUTH */}
              {activeTab==='auth' && (
                <div className="cm-auth-panel">
                  <div className="cm-auth-type">
                    <span className="cm-auth-label">Type</span>
                    <select className="cm-auth-select" defaultValue={curData?.auth}>
                      <option>Bearer Token</option><option>Basic Auth</option><option>API Key</option><option>OAuth 2.0</option><option>No Auth</option>
                    </select>
                  </div>
                  <div className="cm-kv-row" style={{marginTop:'1rem'}}>
                    <span className="cm-auth-label" style={{width:60,flexShrink:0}}>Token</span>
                    <div style={{position:'relative',flex:1}}>
                      <input className="cm-kv-input" style={{width:'100%'}} defaultValue={curData?.token}/>
                      {globals.length>0 && (
                        <div className="cm-auth-globals-hint">
                          Available globals: {globals.map(g=>(
                            <button key={g.id} className="cm-auth-global-chip" onClick={e=>{e.currentTarget.closest('.cm-auth-panel').querySelector('input').value=`{{${g.key}}}`}}>
                              {'{{'+g.key+'}}'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Response */}
            <div className="cm-response-section">
              <div className="cm-response-header">
                <div className="cm-response-header-left">
                  <span className="cm-response-label">Response</span>
                  {response&&!loading&&(<>
                    <span className="cm-response-status" style={{color:STATUS_COLOR[2]}}>200 OK</span>
                    <span className="cm-response-time">142ms</span>
                    <span className="cm-response-size">0.8 KB</span>
                  </>)}
                </div>
                {response&&!loading&&(
                  <button className={`cm-save-btn${responseSaved?' saved':''}`} onClick={handleSaveResponse}>
                    {responseSaved
                      ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l2.5 2.5L10 3"/></svg>Saved!</>
                      : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 2h6l2 2v6a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M3 2v3h5V2M3 7h6"/></svg>Save Response</>
                    }
                  </button>
                )}
              </div>
              <div className="cm-response-body">
                {loading&&<div className="cm-response-loading"><div className="cm-loading-dots"><span/><span/><span/></div><span>Sending request…</span></div>}
                {!loading&&response&&<pre className="cm-response-pre">{response}</pre>}
                {!loading&&!response&&<div className="cm-response-empty">Hit Send to see the response</div>}
              </div>
            </div>

            {/* Collection note */}
            <div className="cm-coll-comment">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M11 1H2a1 1 0 00-1 1v6a1 1 0 001 1h2l2.5 2.5L9 9h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              <input className="cm-coll-comment-input" placeholder="Add a note to this collection…" value={collComment} onChange={e=>setCollComment(e.target.value)}/>
              {collComment&&<button className="cm-coll-comment-save" onClick={()=>setCollComment('')}>Save</button>}
            </div>
          </div>

          {/* Comments panel */}
          <CommentsPanel open={commentsPanelOpen} onClose={()=>setCommentsPanelOpen(false)}/>
        </div>

        {/* Recent hover strip */}
        <div className="cm-recent-trigger" onMouseEnter={handleRecentEnter} onMouseLeave={handleRecentLeave}>
          <div className={`cm-recent-peek${recentHover?' cm-recent-peek--open':''}`}><RecentTabs/></div>
          <div className="cm-recent-handle">
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d={recentHover?"M2 6l6-4 6 4":"M2 2l6 4 6-4"}/>
            </svg>
            <span>Recent collections</span>
          </div>
        </div>

      </div>

      {globalStoreOpen && (
        <GlobalStore
          collectionName={collection?.name}
          onClose={() => setGlobalStoreOpen(false)}
        />
      )}
    </div>
  );
}