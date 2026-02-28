import GlobalStore from './GlobalStore';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMockApi } from './MockApiProvider';
import { createCollectionRequest, updateCollectionRequest, getCollectionRequestsSummary, getRequestDetails } from '../api/request.api';
import './CollectionModal.css';

// ─── Per-collection request shape (what the backend will return in future) ────
// { id, name, method, url, headers:[{k,v}], params:[{k,v}], body:'', auth:'No Auth', token:'' }
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
const MOCK_INVITEES = [
  { id: 1, name: 'Priya Sharma', initial: 'P', email: 'priya@hitit.dev',  permission: 'read-only'  },
  { id: 2, name: 'Dev Kumar',    initial: 'D', email: 'dev@hitit.dev',    permission: 'read-write' },
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
function CurlPanel({ curls, activeCurl, shadowHistory, onSelect, onAdd, onRename, open, globals, favCurls, onToggleFav, fetchingSummaries }) {
  const [globalsOpen, setGlobalsOpen] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [draftName, setDraftName]     = useState('');
  const renameRef                     = useRef(null);

  const startRename = (curl, e) => {
    e.stopPropagation();
    setEditingId(curl.id);
    setDraftName(curl.name);
    setTimeout(() => { renameRef.current?.select(); }, 20);
  };

  const commitRename = (curl) => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== curl.name) onRename(curl.id, trimmed);
    setEditingId(null);
  };

  return (
    <div className={`cm-curl-panel${open?' cm-curl-panel--open':''}`}>

      {/* Request list */}
      <div className="cm-curl-panel-head">
        <span>Requests</span>
        <button className="cm-icon-btn" title="Add request" onClick={onAdd}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
        </button>
      </div>
      <div className="cm-curl-list">
        {fetchingSummaries && (
          <div className="cm-curl-loading" style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            <div className="cm-spin" style={{ margin: '0 auto 8px', width: '16px', height: '16px', border: '2px solid #3b82f633', borderTopColor: '#3b82f6' }} />
            Loading requests...
          </div>
        )}
        {!fetchingSummaries && curls.length === 0 && (
          <div className="cm-curl-empty">
            <span>No requests yet</span>
            <button className="cm-curl-empty-add" onClick={onAdd}>+ Add one</button>
          </div>
        )}
        {!fetchingSummaries && curls.map((curl, i) => {
          const isFav = favCurls?.has(curl.id);
          const isShadow = shadowHistory?.find(s => s.id === curl.id);
          const shadowIdx = shadowHistory?.findIndex(s => s.id === curl.id);
          const shadowOpacities = [0.15, 0.08]; // Shadow 1 (recent), Shadow 2 (older)
          const shadowStyle = isShadow ? { backgroundColor: `rgba(59, 130, 246, ${shadowOpacities[shadowIdx] || 0.05})`, borderLeft: `2px solid rgba(59, 130, 246, ${shadowOpacities[shadowIdx] * 3})` } : {};

          return (
            <div
              key={curl.id}
              className={`cm-curl-item${activeCurl?.id===curl.id?' active':''}${isFav?' cm-curl-item--fav':''}${isShadow?' cm-curl-item--shadow':''}`}
              style={{ animationDelay: open ? `${i*0.04}s` : '0s', ...shadowStyle }}
              onClick={() => editingId !== curl.id && onSelect(curl)}
              title={isShadow ? `Shadow memory #${shadowIdx+1}` : ''}
            >
              <MethodBadge method={curl.method} small />
              {editingId === curl.id ? (
                <input
                  ref={renameRef}
                  className="cm-curl-item-rename"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={() => commitRename(curl)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); commitRename(curl); }
                    if (e.key === 'Escape') { setEditingId(null); }
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="cm-curl-item-name"
                  onDoubleClick={e => startRename(curl, e)}
                  title="Double-click to rename"
                >{curl.name}</span>
              )}
              <button
                className={`cm-fav-btn${isFav ? ' cm-fav-btn--on' : ''}`}
                title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                onClick={e => { e.stopPropagation(); onToggleFav?.(curl.id); }}
                aria-label={isFav ? 'Unfavourite' : 'Favourite'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? '#f59e0b' : 'none'} stroke={isFav ? '#f59e0b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            </div>
          );
        })}
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
function CommentsPanel({ open, onClose, collectionId }) {
  const { mockApiHit } = useMockApi();
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [draft, setDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const visible = comments.filter(c => showResolved || !c.resolved);
  
  const addComment = async () => {
    if (!draft.trim()) return;
    try {
      const newComment = await mockApiHit('POST', `/api/collections/${collectionId}/comments`, { 
        id:Date.now(), author:'You', avatar:'Y', time:'just now', text:draft.trim(), resolved:false 
      });
      setComments(p => [...p, newComment]);
      setDraft('');
    } catch (err) {
      console.error(err);
    }
  };

  const resolveComment = async (id) => {
    try {
      await mockApiHit('PATCH', `/api/comments/${id}`, { resolved: true });
      setComments(p => p.map(x => x.id === id ? { ...x, resolved: true } : x));
    } catch (err) {
      console.error(err);
    }
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
              {!c.resolved && <button className="cm-resolve-btn" onClick={() => resolveComment(c.id)}>Resolve</button>}
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
function RecentTabs({ recentCollections = [], onSelectCollection }) {
  const [sort, setSort] = useState('Last Opened');
  const [sortOpen, setSortOpen] = useState(false);

  // Compute the recent collections list using the passed collections 
  const displayCollections = useMemo(() => {
    let list = [...recentCollections];
    
    // Sort logic 
    if (sort === 'Name A–Z') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Default / Last Opened - falling back to updated_at for now since we don't have true last_opened tracking via API yet
      list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }
    
    return list.slice(0, 5); // Only show top 5
  }, [recentCollections, sort]);

  return (
    <div className="cm-recent-strip">
      <div className="cm-recent-header">
        <span className="cm-recent-title">Recent Collections</span>
        <div className="cm-recent-sort-wrap">
          <button className="cm-recent-sort-btn" onClick={()=>setSortOpen(!sortOpen)}>
            {sort}
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d={sortOpen?"M1 6l3.5-3.5L8 6":"M1 3l3.5 3.5L8 3"}/></svg>
          </button>
          {sortOpen && (
            <div className="cm-recent-dropdown">
              {['Last Opened', 'Name A–Z'].map(opt=>(
                <button key={opt} className={`cm-recent-opt${sort===opt?' active':''}`} onClick={()=>{setSort(opt);setSortOpen(false);}}>{opt}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="cm-recent-tabs">
        {displayCollections.map(r=>(
          <button key={r.id} className="cm-recent-tab" style={{'--col':r.accent_color || '#7c3aed'}} onClick={() => onSelectCollection?.(r)}>
            <span className="cm-recent-dot" style={{background:r.accent_color || '#7c3aed'}}/>
            <span className="cm-recent-tab-name">{r.name || 'Untitled'}</span>
            <MethodBadge method={r.default_method || 'GET'} small/>
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Share Panel ───────────────────────────────────────────────────────────────
function SharePanel({ collection, activeCurl, onClose }) {
  const { mockApiHit } = useMockApi();
  const [scope, setScope]               = useState('collection'); // 'collection' | 'request'
  const [permission, setPermission]     = useState('read-only');  // 'read-only'  | 'read-write'
  const [copied, setCopied]             = useState(false);
  const [invitees, setInvitees]         = useState(MOCK_INVITEES);
  const [emailDraft, setEmailDraft]     = useState('');
  const [invPerm, setInvPerm]           = useState('read-only');
  const panelRef                        = useRef(null);

  // Stable suffix so the link doesn't change on every render
  const [linkSuffix]  = useState(() => Math.random().toString(36).slice(2, 9));
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    mockApiHit('POST', '/api/share/link', { scope, permission }).then(() => {
      setShareLink(`https://hitit.dev/share/${scope === 'collection' ? 'c' : 'r'}-${permission === 'read-only' ? 'ro' : 'rw'}-${linkSuffix}`);
    }).catch(console.error);
  }, [scope, permission, linkSuffix, mockApiHit]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addInvitee = async () => {
    const email = emailDraft.trim();
    if (!email) return;
    try {
      const name = email.split('@')[0];
      const newInv = await mockApiHit('POST', `/api/collections/${collection?.id || 0}/collaborators`, {
        id: Date.now(), name, initial: name[0].toUpperCase(), email, permission: invPerm
      });
      setInvitees(p => [...p, newInv]);
      setEmailDraft('');
    } catch (err) {
      console.error(err);
    }
  };

  const removeInvitee = async (id) => {
    try {
      await mockApiHit('DELETE', `/api/collaborators/${id}`);
      setInvitees(p => p.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const changeInviteePerm = async (id, perm) => {
    try {
      await mockApiHit('PATCH', `/api/collaborators/${id}`, { permission: perm });
      setInvitees(p => p.map(i => i.id === id ? { ...i, permission: perm } : i));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="cm-share-panel" ref={panelRef}>

      {/* Header */}
      <div className="cm-share-panel-head">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="10.5" cy="2.5" r="1.5"/><circle cx="2.5" cy="6.5" r="1.5"/><circle cx="10.5" cy="10.5" r="1.5"/>
          <path d="M4 5.8l5-2.6M4 7.2l5 2.6"/>
        </svg>
        <span>Share</span>
        <button className="cm-share-close" onClick={onClose}>×</button>
      </div>

      {/* Scope */}
      <div className="cm-share-section">
        <div className="cm-share-label">Share scope</div>
        <div className="cm-share-scope-row">
          <button className={`cm-share-scope-btn${scope==='collection'?' active':''}`} onClick={() => setScope('collection')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 4h12v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM1 4l2-3h4l2 3"/>
            </svg>
            <div>
              <span className="cm-share-scope-name">Collection</span>
              <span className="cm-share-scope-sub">{collection?.name || 'All requests'}</span>
            </div>
          </button>
          <button className={`cm-share-scope-btn${scope==='request'?' active':''}`} onClick={() => setScope('request')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="2" width="12" height="10" rx="1.5"/><path d="M4 5h6M4 7.5h4"/>
            </svg>
            <div>
              <span className="cm-share-scope-name">Request</span>
              <span className="cm-share-scope-sub">{activeCurl?.name || 'Current request'}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Permission */}
      <div className="cm-share-section">
        <div className="cm-share-label">Permission</div>
        <div className="cm-share-perm-row">
          <button className={`cm-share-perm-btn${permission==='read-only'?' active':''}`} onClick={() => setPermission('read-only')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 6s2-3.5 5-3.5S11 6 11 6s-2 3.5-5 3.5S1 6 1 6z"/><circle cx="6" cy="6" r="1.5"/>
            </svg>
            Read Only
          </button>
          <button className={`cm-share-perm-btn cm-share-perm-btn--rw${permission==='read-write'?' active':''}`} onClick={() => setPermission('read-write')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2l2 2-6 6H2V8l6-6z"/>
            </svg>
            Read / Write
          </button>
        </div>
        <p className="cm-share-perm-desc">
          {permission === 'read-only'
            ? 'Recipients can view and run requests but cannot modify them.'
            : 'Recipients can view, run, and edit requests, headers, and params.'}
        </p>
      </div>

      {/* Link */}
      <div className="cm-share-section">
        <div className="cm-share-label">Shareable link</div>
        <div className="cm-share-link-row">
          <span className="cm-share-link">{shareLink}</span>
          <button className={`cm-share-copy-btn${copied?' copied':''}`} onClick={handleCopy}>
            {copied
              ? <><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1.5 5.5l2.5 2.5 5-5"/></svg>Copied!</>
              : <><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><path d="M3 3V2a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1H8"/></svg>Copy</>
            }
          </button>
        </div>
      </div>

      {/* Invite */}
      <div className="cm-share-section">
        <div className="cm-share-label">Invite people</div>
        <div className="cm-share-invite-row">
          <input
            className="cm-share-email-input"
            placeholder="email@example.com"
            value={emailDraft}
            onChange={e => setEmailDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addInvitee(); }}
          />
          <select className="cm-share-inv-select" value={invPerm} onChange={e => setInvPerm(e.target.value)}>
            <option value="read-only">Read Only</option>
            <option value="read-write">Read / Write</option>
          </select>
          <button className="cm-share-invite-btn" onClick={addInvitee} disabled={!emailDraft.trim()}>Invite</button>
        </div>
      </div>

      {/* Collaborator list */}
      {invitees.length > 0 && (
        <div className="cm-share-collaborators">
          <div className="cm-share-collab-head">Shared with {invitees.length}</div>
          {invitees.map(inv => (
            <div key={inv.id} className="cm-share-collab">
              <div className="cm-share-collab-avatar">{inv.initial}</div>
              <div className="cm-share-collab-info">
                <span className="cm-share-collab-name">{inv.name}</span>
                <span className="cm-share-collab-email">{inv.email}</span>
              </div>
              <select
                className="cm-share-inv-select cm-share-inv-select--inline"
                value={inv.permission}
                onChange={e => changeInviteePerm(inv.id, e.target.value)}
              >
                <option value="read-only">Read Only</option>
                <option value="read-write">Read / Write</option>
              </select>
              <button className="cm-share-collab-remove" onClick={() => removeInvitee(inv.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Diff utilities ──────────────────────────────────────────────────────────
function computeLineDiff(textA, textB) {
  const a = textA.split('\n'), b = textB.split('\n');
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { ops.unshift({ type: 'equal',  content: a[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.unshift({ type: 'add',    content: b[j-1] }); j--; }
    else { ops.unshift({ type: 'remove', content: a[i-1] }); i--; }
  }
  return ops;
}

// ─── DiffView component ───────────────────────────────────────────────────────
function DiffView({ saveA, saveB, onClear }) {
  const diff = useMemo(() => computeLineDiff(saveA.response, saveB.response), [saveA, saveB]);

  const leftLines = [], rightLines = [];
  let lNum = 0, rNum = 0;
  diff.forEach(d => {
    if (d.type === 'equal') {
      lNum++; rNum++;
      leftLines.push({ type: 'equal',  content: d.content, num: lNum });
      rightLines.push({ type: 'equal', content: d.content, num: rNum });
    } else if (d.type === 'remove') {
      lNum++;
      leftLines.push({ type: 'remove', content: d.content, num: lNum });
      rightLines.push({ type: 'empty', content: '',         num: null });
    } else {
      rNum++;
      leftLines.push({ type: 'empty', content: '',         num: null });
      rightLines.push({ type: 'add',  content: d.content, num: rNum });
    }
  });

  const removed = diff.filter(d => d.type === 'remove').length;
  const added   = diff.filter(d => d.type === 'add').length;

  return (
    <div className="cm-diff-view">
      <div className="cm-diff-toolbar">
        <div className="cm-diff-stats">
          <span className="cm-diff-stat cm-diff-stat--rm">−{removed}</span>
          <span className="cm-diff-stat cm-diff-stat--add">+{added}</span>
          <span className="cm-diff-stat cm-diff-stat--info">{leftLines.length} lines · {removed + added} changed</span>
        </div>
        <div className="cm-diff-toolbar-labels">
          <span className="cm-diff-label cm-diff-label--a">
            <span className="cm-diff-lbadge cm-diff-lbadge--a">A</span>
            {saveA.date} · {saveA.timestamp}
          </span>
          <span className="cm-diff-vs">vs</span>
          <span className="cm-diff-label cm-diff-label--b">
            <span className="cm-diff-lbadge cm-diff-lbadge--b">B</span>
            {saveB.date} · {saveB.timestamp}
          </span>
        </div>
        <button className="cm-diff-clear-btn" onClick={onClear}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
          Clear
        </button>
      </div>
      <div className="cm-diff-panels">
        {/* ── Left / A panel ─ */}
        <div className="cm-diff-panel">
          <div className="cm-diff-panel-head cm-diff-panel-head--a">
            <span className="cm-diff-panel-ind">−</span>
            <span>Save #{saveA.idx} — removed</span>
          </div>
          <div className="cm-diff-panel-body">
            {leftLines.map((l, idx) => (
              <div key={idx} className={`cm-diff-line cm-diff-line--${l.type}`}>
                <span className="cm-diff-ln">{l.num ?? ''}</span>
                <span className="cm-diff-ind">{l.type === 'remove' ? '−' : ' '}</span>
                <span className="cm-diff-text">{l.content}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cm-diff-gutter" />
        {/* ── Right / B panel ─ */}
        <div className="cm-diff-panel">
          <div className="cm-diff-panel-head cm-diff-panel-head--b">
            <span className="cm-diff-panel-ind">+</span>
            <span>Save #{saveB.idx} — added</span>
          </div>
          <div className="cm-diff-panel-body">
            {rightLines.map((l, idx) => (
              <div key={idx} className={`cm-diff-line cm-diff-line--${l.type}`}>
                <span className="cm-diff-ln">{l.num ?? ''}</span>
                <span className="cm-diff-ind">{l.type === 'add' ? '+' : ' '}</span>
                <span className="cm-diff-text">{l.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CollectionModal({ collection, user, onClose, globals = [], setGlobals = () => {}, onCustomize, collections = [], onSelectCollection }) {
  const { mockApiHit } = useMockApi();
  // Each collection owns its own requests — seed from collection.requests (future: from API)
  const [curls, setCurls] = useState(() => collection?.requests || []);
  const [cachedDetails, setCachedDetails] = useState({}); // Stores full details for previously clicked requests
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [fetchingSummaries, setFetchingSummaries] = useState(false);
  const [shadowHistory, setShadowHistory] = useState([]); // Array of previous 2 activeCurls for ghosting

  // Fetch summaries dynamically when modal opens or collection changes
  useEffect(() => {
    if (!collection?.id) return;
    
    // Reset state for new collection before fetching
    setCurls(collection.requests || []);
    setCollName(collection.name || 'Untitled Collection');
    setCollComment('');
    setActiveCurl(null);
    setShadowHistory([]);
    setResponse('');
    setCompareSelections([]);
    setSaveListOpen(false);

    const loadSummaries = async () => {
      try {
        setFetchingSummaries(true);
        const data = await getCollectionRequestsSummary(collection.id);
        if (Array.isArray(data)) {
          setCurls(data);
        } else if (data && Array.isArray(data.data)) {
          setCurls(data.data); // Backend returns { data: [...] }
        } else if (data && Array.isArray(data.requests)) {
          setCurls(data.requests);
        }
      } catch (err) {
        console.error("Failed to fetch request summaries:", err);
      } finally {
        setFetchingSummaries(false);
      }
    };
    
    loadSummaries();
  }, [collection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstCurl = curls[0] || null;

  const [curlPanelOpen, setCurlPanelOpen]     = useState(true);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeCurl, setActiveCurl]           = useState(firstCurl);
  const [activeTab, setActiveTab]             = useState('headers');
  const [url, setUrl]                         = useState(firstCurl?.url    || '');
  const [method, setMethod]                   = useState(firstCurl?.method ?? 'GET');
  const [methodOpen, setMethodOpen]           = useState(false);

  // When curls are loaded lazily, automatically select the first one if we don't have one active
  useEffect(() => {
    if (curls.length > 0 && !activeCurl) {
      const initial = curls[0];
      handleSelectCurl(initial);
      setCurlPanelOpen(true);
    }
  }, [curls, activeCurl]); // eslint-disable-line react-hooks/exhaustive-deps

  const [recentHover, setRecentHover]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [response, setResponse]               = useState('');
  const [responseSaved, setResponseSaved]     = useState(false);
  const [savedResponses, setSavedResponses]   = useState({});
  const [saveListOpen, setSaveListOpen]       = useState(false);
  const saveListRef                           = useRef(null);
  const [compareSelections, setCompareSelections] = useState([]);
  const [responseView, setResponseView]       = useState('response');
  const [shareOpen, setShareOpen]             = useState(false);
  const shareRef                              = useRef(null);
  const [collComment, setCollComment]         = useState('');
  const [globalStoreOpen, setGlobalStoreOpen] = useState(false);
  const recentTimer                           = useRef(null);
  const [editingName, setEditingName]         = useState(false);
  const [collName, setCollName]               = useState(collection?.name || 'Untitled Collection');
  const nameInputRef                          = useRef(null);
  const [favCurls, setFavCurls]               = useState(() => new Set());

  const toggleFavCurl = useCallback(async (id) => {
    const isFav = favCurls.has(id);
    try {
      await mockApiHit('PATCH', `/api/requests/${id}/favorite`, { favorite: !isFav });
      setFavCurls(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }, [favCurls, mockApiHit]);

  // ── KV state for the active request — seeded from the request's own data
  const initKV = useCallback((curl) => {
    // Backend sends {key, value} or 'Bearer auth_string'
    // UI expects {k, v} and sepearate auth type and token
    let authType = 'No Auth';
    let tokenStr = curl?.token || '';
    
    if (curl?.auth) {
      if (curl.auth.startsWith('Bearer ')) {
        authType = 'Bearer Token';
        tokenStr = curl.auth.slice(7);
      } else if (curl.auth.startsWith('Basic ')) {
        authType = 'Basic Auth';
        tokenStr = curl.auth.slice(6);
      } else if (curl.auth !== 'No Auth' && curl.auth !== '') {
        authType = 'API Key';
        tokenStr = curl.auth;
      }
    } else {
      authType = curl?.auth || 'No Auth';
    }

    return {
      headers: (curl?.headers || []).map(h => ({ k: h.key !== undefined ? h.key : h.k, v: h.value !== undefined ? h.value : h.v })),
      params:  (curl?.params  || []).map(p => ({ k: p.key !== undefined ? p.key : p.k, v: p.value !== undefined ? p.value : p.v })),
      body:    curl?.body || '',
      auth:    authType,
      token:   tokenStr,
    };
  }, []);

  const [kvState, setKvState] = useState(() => initKV(firstCurl));

  // Extract ghost configuration parameters directly out of shadowHistory instead of across all collection queries
  const sharedHeaders = useMemo(() => {
    const seen = new Map();
    [...shadowHistory].reverse().forEach(c => (c.headers || []).forEach(h => { 
      const hk = h.key !== undefined ? h.key : h.k;
      const hv = h.value !== undefined ? h.value : h.v;
      if (hk && !seen.has(hk)) seen.set(hk, hv); 
    }));
    return [...seen.entries()].map(([k, v]) => ({ k, v })).filter(s => !kvState.headers.some(h => h.k === s.k));
  }, [shadowHistory, kvState.headers]);

  const sharedParams = useMemo(() => {
    const seen = new Map();
    [...shadowHistory].reverse().forEach(c => (c.params || []).forEach(p => { 
      const pk = p.key !== undefined ? p.key : p.k;
      const pv = p.value !== undefined ? p.value : p.v;
      if (pk && !seen.has(pk)) seen.set(pk, pv); 
    }));
    return [...seen.entries()].map(([k, v]) => ({ k, v })).filter(s => !kvState.params.some(p => p.k === s.k));
  }, [shadowHistory, kvState.params]);

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

  const handleSelectCurl = async (curl) => {
    // Check if clicking same
    if (activeCurl?.id === curl.id) return;

    // Track shadow history
    if (activeCurl) {
      setShadowHistory(prev => {
        // Exclude the one we are moving TO just in case it was a shadow
        const filtered = prev.filter(c => c.id !== curl.id && c.id !== activeCurl.id);
        // Prepend current active memory, keep max 2
        return [activeCurl, ...filtered].slice(0, 2);
      });
    }

    // Optimistically set active so UI reacts
    setActiveCurl(curl);
    setUrl(curl.url || '');
    setMethod(curl.method ?? 'GET');
    setResponse('');
    setSaveListOpen(false);
    setCompareSelections([]);
    setResponseView('response');

    // If we have cached details, restore them instantly!
    if (cachedDetails[curl.id]) {
      const full = cachedDetails[curl.id];
      setActiveCurl(full);
      setUrl(full.url || '');
      setKvState(initKV(full));
      return;
    }

    // Otherwise, fallback to initial dummy values while loading real ones
    setKvState(initKV(curl));

    // And make the API call lazily
    try {
      setFetchingDetails(true);
      const fullDetails = await getRequestDetails(curl.id);
      
      // Update Cache
      setCachedDetails(prev => ({ ...prev, [curl.id]: fullDetails }));
      
      // Keep UI in sync if the user didn't click away already
      setActiveCurl(prev => prev.id === curl.id ? fullDetails : prev);
      if (activeCurl?.id === curl.id || !activeCurl) {
        setUrl(fullDetails.url || '');
        setKvState(initKV(fullDetails));
      }
    } catch (err) {
      console.error("Failed to load full request details", err);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleSend = async () => {
    setLoading(true); setResponse('');
    
    // Auto-save request details to backend before sending
    try {
      if (activeCurl?.id) {
        let authString = kvState.auth === 'Bearer Token' ? `Bearer ${kvState.token}` : 
                         kvState.auth === 'Basic Auth' ? `Basic ${kvState.token}` :
                         kvState.token;
                         
        if (kvState.auth === 'No Auth' || !kvState.token) {
          authString = '';
        }

        const payload = {
          name: activeCurl.name,
          url,
          method,
          headers: kvState.headers.filter(h => h.k || h.v).map(h => ({ key: h.k, value: h.v })),
          params: kvState.params.filter(p => p.k || p.v).map(p => ({ key: p.k, value: p.v })),
          body: kvState.body,
          auth: authString
        };
        const updatedReq = await updateCollectionRequest(activeCurl.id, payload);
        
        // Update local state
        setActiveCurl(updatedReq);
        setCurls(prev => prev.map(c => c.id === activeCurl.id ? { ...c, ...updatedReq } : c));
        setCachedDetails(prev => ({ ...prev, [activeCurl.id]: updatedReq }));
      }
    } catch (err) {
      console.error("Failed to sync request changes to backend before sending", err);
    }

    try {
      const resData = await mockApiHit('POST', '/api/proxy', MOCK_RESPONSE);
      setResponse(resData);
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveResponse = async () => {
    if (!response) return;
    try {
      const newSave = await mockApiHit('POST', `/api/requests/${activeCurl.id}/saves`, {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        response,
        reqName: activeCurl.name,
      });
      setSavedResponses(prev => ({
        ...prev,
        [activeCurl.id]: [newSave, ...(prev[activeCurl.id] || [])].slice(0, 20),
      }));
      setResponseSaved(true);
      setSaveListOpen(true);
      setTimeout(() => setResponseSaved(false), 2200);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSave = async (saveId) => {
    try {
      await mockApiHit('DELETE', `/api/requests/${activeCurl.id}/saves/${saveId}`);
      setSavedResponses(prev => ({
        ...prev,
        [activeCurl.id]: (prev[activeCurl.id] || []).filter(s => s.id !== saveId),
      }));
      setCompareSelections(prev => prev.filter(s => s.id !== saveId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecentEnter = () => { clearTimeout(recentTimer.current); setRecentHover(true); };
  const handleRecentLeave = () => { recentTimer.current = setTimeout(()=>setRecentHover(false),300); };

  // Close save list when clicking outside
  useEffect(() => {
    if (!saveListOpen) return;
    const handler = (e) => {
      if (saveListRef.current && !saveListRef.current.contains(e.target)) setSaveListOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [saveListOpen]);

  const curSaves = activeCurl ? (savedResponses[activeCurl.id] || []) : [];

  const toggleCompare = (save) => {
    setCompareSelections(prev => {
      if (prev.find(s => s.id === save.id)) return prev.filter(s => s.id !== save.id);
      if (prev.length >= 2) return [prev[1], save]; // replace oldest
      return [...prev, save];
    });
  };

  // Auto-switch to diff tab when 2 are selected
  useEffect(() => {
    if (compareSelections.length === 2) setResponseView('diff');
    if (compareSelections.length < 2 && responseView === 'diff') setResponseView('response');
  }, [compareSelections.length]); // eslint-disable-line

  const TABS = ['headers','params','body','auth','info'];
  // curData reads directly from the activeCurl object (each request owns its data)
  const curData = activeCurl || {};

  // ── Add new blank request ──
  const handleRenameRequest = async (id, newName) => {
    try {
      await updateCollectionRequest(id, { name: newName });
      setCurls(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
      if (activeCurl?.id === id) setActiveCurl(prev => ({ ...prev, name: newName }));
    } catch (err) {
      console.error(err);
    }
  };

  const addNewRequest = async () => {
    try {
      const newReq = await createCollectionRequest({
        collection_id: collection.id,
        name: `Request ${curls.length + 1}`,
        method: '', url: '',
        headers: [], params: [], body: '', auth: 'No Auth',
      });
      setCurls(prev => [...prev, newReq]);
      setCurlPanelOpen(true);
      setActiveCurl(newReq);
      setUrl(''); setMethod('');
      setKvState({ headers: [], params: [] });
      setResponse(''); setResponseView('response');
      setCompareSelections([]); setSaveListOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const saveCollectionName = async () => {
    if (collName.trim() === collection.name) {
      setEditingName(false); return;
    }
    try {
      await mockApiHit('PATCH', `/api/collections/${collection.id}`, { name: collName.trim() });
      setEditingName(false);
    } catch (err) {
      console.error(err);
      setCollName(collection.name);
      setEditingName(false);
    }
  };

  const saveCollectionNote = async () => {
    try {
      await mockApiHit('PATCH', `/api/collections/${collection.id}/note`, { note: collComment });
      setCollComment('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
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
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="cm-modal-collection-name-input"
                  value={collName}
                  onChange={e => setCollName(e.target.value)}
                  onBlur={saveCollectionName}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveCollectionName(); }}
                />
              ) : (
                <span
                  className="cm-modal-collection-name cm-modal-collection-name--editable"
                  onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.select(), 20); }}
                  title="Click to rename"
                >{collName}</span>
              )}
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
            {/* ── Share ── */}
            <div className="cm-share-anchor">
              <button className={`cm-icon-btn-label${shareOpen?' active':''}`} onClick={()=>setShareOpen(o=>!o)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="10.5" cy="2.5" r="1.5"/><circle cx="2.5" cy="6.5" r="1.5"/><circle cx="10.5" cy="10.5" r="1.5"/>
                  <path d="M4 5.8l5-2.6M4 7.2l5 2.6"/>
                </svg>
                Share
              </button>
              {shareOpen && (
                <SharePanel
                  collection={collection}
                  activeCurl={activeCurl}
                  onClose={() => setShareOpen(false)}
                />
              )}
            </div>
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
            curls={curls}
            activeCurl={activeCurl}
            shadowHistory={shadowHistory}
            onSelect={handleSelectCurl}
            onAdd={addNewRequest}
            onRename={handleRenameRequest}
            open={curlPanelOpen}
            globals={globals}
            favCurls={favCurls}
            onToggleFav={toggleFavCurl}
            fetchingSummaries={fetchingSummaries}
          />

          {/* Workspace */}
          <div className="cm-workspace">

            {/* ── Empty state when no requests yet ── */}
            {!activeCurl && (
              <div className="cm-empty-state">
                <div className="cm-empty-icon">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <rect x="4" y="8" width="28" height="22" rx="3"/>
                    <path d="M4 13h28M11 8V4M25 8V4M13 21h10M18 18v6"/>
                  </svg>
                </div>
                <h3 className="cm-empty-title">No requests yet</h3>
                <p className="cm-empty-sub">This is your blank playground. Add your first request to get started.</p>
                <button className="cm-empty-add" onClick={addNewRequest}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6.5 1v11M1 6.5h11"/>
                  </svg>
                  Add Request
                </button>
              </div>
            )}

            {/* ── Full editor (only when a request is selected) ── */}
            {activeCurl && (<>
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
                    <div className="cm-shared-banner" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M5.5 1v9M1 5.5l9 0z"/>
                      </svg>
                      {sharedHeaders.length} header{sharedHeaders.length!==1?'s':''} inherited from Shadow History. Focus an empty row to use them.
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
                    <div className="cm-shared-banner" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M5.5 1v9M1 5.5l9 0z"/>
                      </svg>
                      {sharedParams.length} param{sharedParams.length!==1?'s':''} inherited from Shadow History. Focus an empty row to use them.
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
                  <textarea 
                    className="cm-editor" 
                    value={kvState.body} 
                    onChange={e => setKvState(prev => ({ ...prev, body: e.target.value }))}
                    spellCheck={false}
                  />
                </div>
              )}

              {/* AUTH */}
              {activeTab==='auth' && (
                <div className="cm-auth-panel">
                  <div className="cm-auth-type">
                    <span className="cm-auth-label">Type</span>
                    <select 
                      className="cm-auth-select" 
                      value={kvState.auth}
                      onChange={e => setKvState(prev => ({ ...prev, auth: e.target.value }))}
                    >
                      <option>Bearer Token</option><option>Basic Auth</option><option>API Key</option><option>OAuth 2.0</option><option>No Auth</option>
                    </select>
                  </div>
                  <div className="cm-kv-row" style={{marginTop:'1rem'}}>
                    <span className="cm-auth-label" style={{width:60,flexShrink:0}}>Token</span>
                    <div style={{position:'relative',flex:1}}>
                      <input 
                        className="cm-kv-input" 
                        style={{width:'100%'}} 
                        value={kvState.token}
                        onChange={e => setKvState(prev => ({ ...prev, token: e.target.value }))}
                      />
                      {globals.length>0 && (
                        <div className="cm-auth-globals-hint">
                          Available globals: {globals.map(g=>(
                            <button 
                              key={g.id} 
                              className="cm-auth-global-chip" 
                              onClick={e => setKvState(prev => ({ ...prev, token: `{{${g.key}}}` }))}
                            >
                              {'{{'+g.key+'}}'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INFO */}
              {activeTab==='info' && (
                <div className="cm-info-panel">
                  <div className="cm-info-head">Request Metadata</div>
                  <div className="cm-info-grid">
                    <div className="cm-info-row"><span className="cm-info-k">ID</span><code className="cm-info-v">{curData?.id}</code></div>
                    <div className="cm-info-row"><span className="cm-info-k">Collection ID</span><code className="cm-info-v">{curData?.collection_id}</code></div>
                    <div className="cm-info-row"><span className="cm-info-k">Created At</span><span className="cm-info-v">{curData?.created_at ? new Date(curData.created_at).toLocaleString() : '—'}</span></div>
                    <div className="cm-info-row"><span className="cm-info-k">Updated At</span><span className="cm-info-v">{curData?.updated_at ? new Date(curData.updated_at).toLocaleString() : '—'}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Response */}
            {fetchingDetails && (
              <div className="cm-loading-overlay-bar" style={{ padding: '4px 16px', background: '#3b82f615', color: '#3b82f6', fontSize: '12px', textAlign: 'center' }}>
                Fetching request details...
              </div>
            )}
            <div className="cm-response-section">
              <div className="cm-response-header">
                <div className="cm-response-header-left">
                  <div className="cm-resp-view-tabs">
                    <button className={`cm-resp-view-tab${responseView==='response'?' active':''}`} onClick={() => setResponseView('response')}>Response</button>
                    {compareSelections.length === 2 && (
                      <button className={`cm-resp-view-tab cm-resp-view-tab--diff${responseView==='diff'?' active':''}`} onClick={() => setResponseView('diff')}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 6h8M1 3h3M1 9h3M8 3h3M8 9h3"/></svg>
                        Diff
                        <span className="cm-resp-diff-badge">2</span>
                      </button>
                    )}
                    {compareSelections.length === 1 && (
                      <span className="cm-resp-compare-hint">Select 1 more to compare</span>
                    )}
                  </div>
                  {response&&!loading&&responseView==='response'&&(<>
                    <span className="cm-response-status" style={{color:STATUS_COLOR[2]}}>200 OK</span>
                    <span className="cm-response-time">142ms</span>
                    <span className="cm-response-size">0.8 KB</span>
                  </>)}
                </div>
                {response&&!loading&&responseView==='response'&&(
                  <div className="cm-save-wrap" ref={saveListRef}>
                    <div className="cm-save-btn-row">
                      <button className={`cm-save-btn${responseSaved?' saved':''}`} onClick={handleSaveResponse}>
                        {responseSaved
                          ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l2.5 2.5L10 3"/></svg>Saved!</>
                          : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 2h6l2 2v6a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M3 2v3h5V2M3 7h6"/></svg>Save Response</>
                        }
                      </button>
                      {curSaves.length > 0 && (
                        <button
                          className={`cm-save-history-toggle${saveListOpen?' active':''}`}
                          onClick={() => setSaveListOpen(o => !o)}
                          title="View save history"
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                            <path d={saveListOpen ? "M1 7.5l4.5-4 4.5 4" : "M1 3.5l4.5 4 4.5-4"}/>
                          </svg>
                          {curSaves.length}
                        </button>
                      )}
                    </div>

                    {saveListOpen && curSaves.length > 0 && (
                      <div className="cm-save-list">
                        <div className="cm-save-list-head">
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="5.5" cy="5.5" r="4.5"/><path d="M5.5 3v2.5l1.8 1.8"/>
                          </svg>
                          Save history · <em>{activeCurl.name}</em>
                          <button className="cm-save-list-close" onClick={() => setSaveListOpen(false)}>×</button>
                        </div>
                        <div className="cm-save-list-items">
                          {curSaves.map((save, idx) => (
                            <div key={save.id} className="cm-save-item">
                              <div className="cm-save-item-meta">
                                <span className="cm-save-item-idx">#{curSaves.length - idx}</span>
                                <span className="cm-save-item-time">{save.date} · {save.timestamp}</span>
                                {idx === 0 && <span className="cm-save-item-latest">latest</span>}
                              </div>
                              <pre className="cm-save-item-preview">{save.response.slice(0, 160)}{save.response.length > 160 ? '…' : ''}</pre>
                              <div className="cm-save-item-actions">
                                <button
                                  className="cm-save-item-load"
                                  onClick={() => { setResponse(save.response); setSaveListOpen(false); }}
                                >
                                  Load
                                </button>
                                <button
                                  className={`cm-save-item-compare${compareSelections.find(s => s.id === save.id) ? ' active' : ''}`}
                                  onClick={() => toggleCompare({ ...save, idx: curSaves.length - idx })}
                                  title={compareSelections.find(s => s.id === save.id) ? 'Remove from compare' : compareSelections.length >= 2 ? 'Replaces oldest selection' : 'Add to compare'}
                                >
                                  {compareSelections.find(s => s.id === save.id)
                                    ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1.5 5l2.5 2.5 5-5"/></svg>Selected</>
                                    : <><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 5h8M2.5 1.5l-1.5 3.5 1.5 3.5M7.5 1.5l1.5 3.5-1.5 3.5"/></svg>Compare</>
                                  }
                                </button>
                                <button
                                  className="cm-save-item-delete"
                                  onClick={() => handleDeleteSave(save.id)}
                                  title="Delete this save"
                                >
                                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5M7.5 3v6.5M3 3l.5 7h5l.5-7"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="cm-response-body">
                {responseView === 'diff' && compareSelections.length === 2 ? (
                  <DiffView
                    saveA={compareSelections[0]}
                    saveB={compareSelections[1]}
                    onClear={() => { setCompareSelections([]); setResponseView('response'); }}
                  />
                ) : (
                  <>
                    {loading&&<div className="cm-response-loading"><div className="cm-loading-dots"><span/><span/><span/></div><span>Sending request…</span></div>}
                    {!loading&&response&&<pre className="cm-response-pre">{response}</pre>}
                    {!loading&&!response&&<div className="cm-response-empty">Hit Send to see the response</div>}
                  </>
                )}
              </div>
            </div>

            {/* Collection note */}
            <div className="cm-coll-comment">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M11 1H2a1 1 0 00-1 1v6a1 1 0 001 1h2l2.5 2.5L9 9h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              <input className="cm-coll-comment-input" placeholder="Add a note to this collection…" value={collComment} onChange={e=>setCollComment(e.target.value)}/>
              {collComment&&<button className="cm-coll-comment-save" onClick={saveCollectionNote}>Save</button>}
            </div>
            </> )}
          </div>

          {/* Comments panel */}
          <CommentsPanel open={commentsPanelOpen} onClose={()=>setCommentsPanelOpen(false)} collectionId={collection?.id} />
        </div>

        {/* Recent hover strip */}
        <div className="cm-recent-trigger" onMouseEnter={handleRecentEnter} onMouseLeave={handleRecentLeave}>
          <div className={`cm-recent-peek${recentHover?' cm-recent-peek--open':''}`}>
            <RecentTabs 
              recentCollections={collections} 
              onSelectCollection={(c) => { 
                if (onSelectCollection) {
                   onSelectCollection(c);
                } else {
                   // Fallback if not provided
                   onClose(); 
                   setTimeout(() => document.querySelector(`.hc-card[style*="${c.id}"]`)?.click(), 100); 
                }
              }} 
            />
          </div>
          <div className="cm-recent-handle">
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d={recentHover?"M2 6l6-4 6 4":"M2 2l6 4 6-4"}/>
            </svg>
            <span>Recent collections</span>
          </div>
        </div>

      </div>

    </div>

    {globalStoreOpen && (
      <GlobalStore
        collectionName={collection?.name}
        onClose={() => setGlobalStoreOpen(false)}
      />
    )}
    </>
  );
}