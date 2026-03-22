import GlobalStore from './GlobalStore';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { exportCollaborators, getCollaborators } from '../api/collaborators.api';
import { createCollectionRequest, updateCollectionRequest, getCollectionRequestsSummary, getRequestDetails, updateRequestNote, hitRequest, toggleRequestFavorite } from '../api/request.api';
import { useTeam } from '../context/TeamContext';
import { getActivities, sendActivity, resolveIssueApi, queryAiAssistant } from '../api/activity_feed.api';
import { tokenStore } from '../api';
import { getVariables } from '../api/variables.api';
import { getOverrides } from '../api/overrides.api';
import './CollectionModal.css';

// ─── Per-collection request shape (what the backend will return in future) ────
// { id, name, method, url, headers:[{k,v}], params:[{k,v}], body:'', auth:'No Auth', token:'' }
// ── Initial global vars for the collection — now managed at app level (HomePage)
// Kept here only as fallback shape reference
const GLOBALS_SHAPE = { id: 0, key: '', value: '', desc: '' };

const METHOD_STYLE = {
  GET:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  POST:   { bg: 'rgba(124,58,237,0.12)', text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.12)', text: '#0ea5e9' },
};
const STATUS_COLOR = { 2:'#10b981', 3:'#f59e0b', 4:'#ef4444', 5:'#ef4444' };

// ─── Utility: JSON format / validate ─────────────────────────────────────────
// Returns { formatted: string, error: string|null }
function tryFormatJson(text) {
  if (!text || !text.trim()) return { formatted: text, error: null };
  
  // 1. Strip null bytes and other control chars that survive curl copy-paste
  // 2. Replace non-breaking spaces (\u00A0) and other weird spaces with standard space
  //    This is extremely common when copy-pasting JSON from web pages or some tools
  const cleaned = text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/[\u00A0\u1680​\u180e\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .trim();

  try {
    return { formatted: JSON.stringify(JSON.parse(cleaned), null, 2), error: null };
  } catch (e) {
    // Even when invalid, collapse excess whitespace so the button does something visible
    const compacted = cleaned.replace(/[ \t]+/g, ' ');
    return { formatted: compacted, error: e.message };
  }
}

// ─── Utility: Parse curl Command ──────────────────────────────────────────────
const parseCurlCommand = (curlStr) => {
  const result = { method: 'GET', url: '', headers: [], auth: 'No Auth', token: '', body: '', isCurl: false };
  const trimmed = curlStr.trim();
  
  // More robust check for curl: starts with curl or contains it at the beginning of a line
  if (!trimmed.toLowerCase().startsWith('curl') && !trimmed.includes('\ncurl')) return result;

  // Strip any trailing backslash newline indicators and handle multi-line
  const cleanedStr = trimmed.replace(/\\\n/g, ' ').replace(/\n/g, ' ');

  // Matches arguments while respecting quotes (single and double)
  const regex = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\S+/g;
  let args = [];
  let match;
  while ((match = regex.exec(cleanedStr)) !== null) {
      args.push(match[0]);
  }

  if (args.length === 0 || args[0].toLowerCase() !== 'curl') return result;
  
  // Set isCurl to true once we are sure it's a curl command
  result.isCurl = true;

  let i = 1;
  while (i < args.length) {
    let arg = args[i];
    arg = arg.replace(/^['"]|['"]$/g, '');
    
    // Improved URL detection:
    // 1. Not a flag
    // 2. Not consumed by a previous flag
    // 3. Either starts with http/https, or contains a dot/colon that looks like a domain/localhost
    if (!arg.startsWith('-') && !result.url) {
      const isUrl = arg.startsWith('http') || 
                    arg.startsWith('localhost') || 
                    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(arg) ||
                    /^[a-zA-Z0-9.-]+:[0-9]+/.test(arg);
      
      if (isUrl) {
        result.url = arg;
        i++;
        continue;
      }
    }

    if (arg === '-X' || arg === '--request') {
      if (i + 1 < args.length) {
        result.method = args[i+1].replace(/^['"]|['"]$/g, '').toUpperCase();
        i++;
      }
    } else if (arg === '-H' || arg === '--header') {
      if (i + 1 < args.length) {
        const headerStr = args[i+1].replace(/^['"]|['"]$/g, '');
        const sep = headerStr.indexOf(':');
        if (sep > 0) {
          const key = headerStr.substring(0, sep).trim();
          const val = headerStr.substring(sep + 1).trim();
          
          if (key.toLowerCase() === 'authorization') {
            if (val.toLowerCase().startsWith('bearer ')) {
              result.auth = 'Bearer Token';
              result.token = val.substring(7);
            } else if (val.toLowerCase().startsWith('basic ')) {
              result.auth = 'Basic Auth';
              result.token = val.substring(6);
            } else {
               result.headers.push({ k: key, v: val });
            }
          } else {
            result.headers.push({ k: key, v: val });
          }
        }
        i++;
      }
    } else if (arg === '-d' || arg === '--data' || arg === '--data-raw' || arg === '--data-binary' || arg === '--data-ascii') {
      if (i + 1 < args.length) {
        result.body = args[i+1].replace(/^['"]|['"]$/g, '');
        if (result.method === 'GET') result.method = 'POST';
        i++;
      }
    } else if (arg === '-u' || arg === '--user') {
        if (i + 1 < args.length) {
            result.auth = 'Basic Auth';
            result.token = btoa(args[i+1].replace(/^['"]|['"]$/g, ''));
            i++;
        }
    }
    i++;
  }

  // UX Fix: If it's just "curl" or "curl -" and we haven't found a URL yet,
  // we might be typing. In that case, don't trigger the auto-fill yet
  // to avoid clearing the URL input while the user is mid-command.
  if (result.isCurl && !result.url && trimmed.length < 10) {
      result.isCurl = false;
  }

  return result;
};

// ─── Utility: Generate curl Command ───────────────────────────────────────────
const generateCurlCommand = (method, url, headers, auth, token, body, params) => {
  let finalUrl = url || '';
  
  if (params && params.length > 0) {
    const query = params.filter(p => p.k).map(p => `${encodeURIComponent(p.k)}=${encodeURIComponent(p.v || '')}`).join('&');
    if (query) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + query;
    }
  }

  let curl = `curl '${finalUrl}'`;
  
  if (method && method !== 'GET') {
    curl += ` \\\n  -X '${method}'`;
  }

  const validHeaders = (headers || []).filter(h => h.k && h.v);
  for (const h of validHeaders) {
    curl += ` \\\n  -H '${h.k}: ${h.v}'`;
  }

  if (auth === 'Bearer Token' && token) {
    curl += ` \\\n  -H 'Authorization: Bearer ${token}'`;
  } else if (auth === 'Basic Auth' && token) {
    curl += ` \\\n  -H 'Authorization: Basic ${token}'`;
  }

  if (body) {
    const safeBody = body.replace(/'/g, "'\\''");
    curl += ` \\\n  --data-raw '${safeBody}'`;
  }

  return curl;
};

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
        Shadow History
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

function GlobalPicker({ suggestions, onPick }) {
  if (!suggestions.length) return null;
  return (
    <div className="cm-global-picker">
      <div className="cm-global-picker-label">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="5" cy="5" r="3.5"/><path d="M5 1.5v7M1.5 5h7"/>
        </svg>
        From Globals
      </div>
      {suggestions.map((s,i) => (
        <button key={i} className="cm-global-pick-item" onClick={() => onPick(s)}>
          <span className="cm-global-pick-key">{s.k}</span>
          <span className="cm-global-pick-val">{'{{' + s.k + '}}'}</span>
        </button>
      ))}
    </div>
  );
}

// ─── KV Row with shared picker ────────────────────────────────────────────────
function KVRow({ row, sharedSuggestions, globalSuggestions, onChange, onDelete, onPickShared, isReadOnly }) {
  const [keyFocus, setKeyFocus] = useState(false);
  const [valFocus, setValFocus] = useState(false);
  const isFocused = keyFocus || valFocus;
  const showShadow = isFocused && !row.k && sharedSuggestions.length > 0;
  const showGlobal = isFocused && !row.k && globalSuggestions.length > 0;

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
          disabled={isReadOnly}
        />
        <input
          className={`cm-kv-input${!row.v?' cm-kv-input--empty':''}`}
          placeholder="value"
          value={row.v}
          onChange={e => onChange({ ...row, v: e.target.value })}
          onFocus={() => setValFocus(true)}
          onBlur={() => setTimeout(()=>setValFocus(false), 150)}
          disabled={isReadOnly}
        />
        {!isReadOnly && <button className="cm-kv-del" onClick={onDelete}>×</button>}
      </div>
      {showShadow && (
        <SharedPicker
          suggestions={sharedSuggestions}
          onPick={s => { onChange(s); setKeyFocus(false); setValFocus(false); }}
        />
      )}
      {showGlobal && (
        <GlobalPicker
          suggestions={globalSuggestions}
          onPick={s => { onChange({ k: s.k, v: '{{' + s.k + '}}' }); setKeyFocus(false); setValFocus(false); }}
        />
      )}
    </div>
  );
}

// ─── Curl Panel (left sidebar in modal) ──────────────────────────────────────
function CurlPanel({ curls, activeCurl, shadowHistory, onSelect, onAdd, onRename, open, favCurls, onToggleFav, fetchingSummaries, panelWidth }) {
  const [globalsOpen, setGlobalsOpen] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [draftName, setDraftName]     = useState('');
  const renameRef                     = useRef(null);

  const startRename = (curl, e) => {
    if (curl.write_permission === false) return;
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

  const favRequests = curls.filter(c => favCurls?.has(c.id));
  const otherRequests = curls.filter(c => !favCurls?.has(c.id));

  const renderCurl = (curl, i) => {
    const isFav = favCurls?.has(curl.id);
    const isShadow = shadowHistory?.find(s => s.id === curl.id);
    const shadowIdx = shadowHistory?.findIndex(s => s.id === curl.id);
    const shadowOpacities = [0.25, 0.12]; // Shadow 1 (recent), Shadow 2 (older)
    const shadowStyle = isShadow ? { backgroundColor: `rgba(59, 130, 246, ${shadowOpacities[shadowIdx] || 0.05})`, borderLeft: `2px solid rgba(59, 130, 246, ${shadowOpacities[shadowIdx] * 4})` } : {};

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
  };

  return (
    <div
      className={`cm-curl-panel${open?' cm-curl-panel--open':''}`}
      style={open && panelWidth ? { width: panelWidth } : undefined}
    >

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
        {!fetchingSummaries && favRequests.length > 0 && (
          <>
            <div className="cm-curl-group-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', margin: '4px 12px 6px', fontWeight: 600, letterSpacing: '0.5px' }}>Favorites</div>
            {favRequests.map((curl, i) => renderCurl(curl, i))}
          </>
        )}
        {!fetchingSummaries && otherRequests.length > 0 && (
          <>
            {favRequests.length > 0 && <div className="cm-curl-group-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', margin: '16px 12px 6px', fontWeight: 600, letterSpacing: '0.5px' }}>Other Requests</div>}
            {otherRequests.map((curl, i) => renderCurl(curl, favRequests.length + i))}
          </>
        )}
      </div>

    </div>
  );
}

// ─── Activity Feed Panel (Collection Mission Control) ─────────────────────────
function ActivityFeedPanel({ open, onClose, collectionId, currentUser, panelWidth }) {
  const { teamId, orgId } = useTeam();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('group'); // 'group' | 'personal'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const listRef = useRef(null);
  const wsRef   = useRef(null);
  
  // Track old scroll height for prepending items
  const lastScrollHeight = useRef(0);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // ── Load First Page (resets when mode/collection changes)
  useEffect(() => {
    if (!open || !collectionId) return;
    
    const loadInitial = async () => {
      setLoading(true);
      try {
        setPage(1);
        setHasMore(true);
        const data = await getActivities(collectionId, mode, 1, 20, teamId, orgId);
        const activities = Array.isArray(data) ? data : (data?.history || data?.activities || []);
        setItems(activities);
        if (activities.length < 20) setHasMore(false);
      } catch (err) {
        console.error("Failed to load activities:", err);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    };
    loadInitial();
  }, [collectionId, mode, open]);

  const fetchNextPage = async () => {
    if (loading || !hasMore) return;
    try {
      setLoading(true);
      if (listRef.current) lastScrollHeight.current = listRef.current.scrollHeight;
      
      const nextPage = page + 1;
      const data = await getActivities(collectionId, mode, nextPage, 20, teamId, orgId);
      const activities = Array.isArray(data) ? data : (data?.history || data?.activities || []);
      
      if (activities.length < 20) setHasMore(false);
      
      setItems(prev => [...activities, ...prev]); // Prepend older items
      setPage(nextPage);

      // Restore scroll position after prepending
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight - lastScrollHeight.current;
        }
      }, 50);
    } catch (err) {
      console.error("Failed to load more activities:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── WebSocket for real-time 
  useEffect(() => {
    if (!open || !collectionId) return;

    const token = tokenStore.get();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const wsBase = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/v1/ws/${collectionId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
         const activity = JSON.parse(event.data);
         // Only append if it matches our current scope 
         if (activity.scope === mode) {
            setItems(prev => {
              // De-duplicate in case we just sent it ourselves 
              if (prev.find(p => p.id === activity.id)) return prev;
              return [...prev, activity];
            });
            setTimeout(scrollToBottom, 50);
         }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    };

    ws.onclose = () => console.log("WS Closed");
    ws.onerror = (e) => console.error("WS Error:", e);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [collectionId, mode, open]);

  useEffect(() => {
    scrollToBottom();
  }, [items, mode]);

  const visible = items; // Backend already filters per mode/scope
  
  const handleSend = async () => {
    if (!draft.trim()) return;
    const isAiQuery = draft.trim().startsWith('@AI');
    const isIssue   = draft.trim().startsWith('/issue');
    const text      = isIssue ? draft.replace('/issue', '').trim() : draft.trim();
    
    const optimisticId = `opt-${Date.now()}`;
    
    // ── Optimistic Update for instant UI response 
    const optimisticItem = {
      id: optimisticId,
      user_id: currentUser?.id,
      content: text,
      type: isIssue ? 'issue' : 'user_chat',
      scope: mode,
      created_at: new Date().toISOString()
    };
    
    setItems(p => [...p, optimisticItem]);
    setDraft(''); // Clear input immediately for UX

    try {
      if (isAiQuery) {
        // AI query handles both prompt + response objects in one return 
        const { user_message, ai_response } = await queryAiAssistant(collectionId, {
          prompt: text,
          scope: mode,
          master_id: collectionId, // Use master_id to match backend expectations
          context: { url: window.location.href }
        }, teamId, orgId);
        
        // Replace optimistic with real user message + ai response 
        setItems(p => {
          let nextP = p;
          if (nextP.some(item => item.id === user_message.id)) {
            nextP = nextP.filter(item => item.id !== optimisticId);
          } else {
            nextP = nextP.map(item => item.id === optimisticId ? user_message : item);
          }
          if (!nextP.some(item => item.id === ai_response.id)) {
            nextP = nextP.concat(ai_response);
          }
          return nextP;
        });
      } else {
        const payload = {
          type: isIssue ? 'issue' : 'user_chat',
          content: text,
          text: text, // Send both for compatibility
          scope: mode
        };
        const newActivity = await sendActivity(collectionId, payload, teamId, orgId);
        
        // Merge real backend data but PROTECT the content if backend returns ""
        setItems(p => {
          if (p.some(item => item.id === newActivity.id)) {
            // WS already added it, just remove optimistic
            return p.filter(item => item.id !== optimisticId);
          }
          return p.map(item => {
            if (item.id === optimisticId) {
               return {
                 ...newActivity,
                 content: newActivity.content || item.content // Keep optimistic if backend is empty
               };
            }
            return item;
          });
        });
      }
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove the optimistic item if it failed 
      setItems(p => p.filter(item => item.id !== optimisticId));
    }
  };

  const formatActivity = (a) => ({
    ...a,
    text:     a.content || a.text || '',
    resolved: a.is_resolved !== undefined ? a.is_resolved : a.resolved,
    time:     a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.time || 'just now'),
    author:   a.author || (a.user_id === currentUser?.id ? 'You' : (a.user_id ? `User ${a.user_id.slice(-4)}` : 'System')),
    avatar:   a.avatar || (a.user_id === currentUser?.id ? (currentUser?.name?.[0].toUpperCase() || 'Y') : (a.user_id ? a.user_id[0].toUpperCase() : 'S')),
  });

  const resolveIssue = async (id) => {
    try {
      const updated = await resolveIssueApi(id, collectionId, teamId, orgId);
      setItems(p => p.map(x => x.id === id ? { ...x, is_resolved: true } : x));
    } catch (err) {
      console.error("Failed to resolve issue:", err);
    }
  };

  return (
    <div
      className={`cm-comments-panel${open?' cm-comments-panel--open':''}`}
      style={open && panelWidth ? { width: panelWidth } : undefined}
    >
      <div className="cm-comments-head">
        <span>Activity Feed</span>
        <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
          <div className="cm-feed-mode-toggle">
            <button className={`cm-mode-btn${mode==='group'?' active':''}`} onClick={()=>setMode('group')}>Group</button>
            <button className={`cm-mode-btn${mode==='personal'?' active':''}`} onClick={()=>setMode('personal')}>Personal</button>
          </div>
          <button className="cm-icon-btn" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11"/></svg>
          </button>
        </div>
      </div>

      <div className="cm-comments-list" ref={listRef}>
        {hasMore && items.length > 0 && (
          <button 
            className="cm-feed-load-more" 
            onClick={fetchNextPage}
            disabled={loading}
            style={{ 
              width: '100%', padding: '0.6rem', background: 'var(--bg-2)', 
              border: '1px solid var(--border)', borderRadius: '6px', 
              fontSize: '0.7rem', color: 'var(--purple)', fontWeight: 600,
              marginBottom: '1rem', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            {loading ? 'Loading older messages...' : 'Load older messages'}
          </button>
        )}
        {loading && page === 1 && (
          <div className="cm-comments-empty" style={{padding: '40px 0'}}>
            <div className="cm-spin" style={{width:'20px', height:'20px', margin:'0 auto 10px'}} />
            Loading conversations...
          </div>
        )}
        {!loading && visible.length===0 && <div className="cm-comments-empty">No activity yet.</div>}
        {visible.map(item => {
          const c = formatActivity(item);
          if (c.type === 'issue') {
            return (
              <div key={c.id} className={`cm-feed-issue${c.resolved?' cm-feed-issue--resolved':''}`}>
                <div className="cm-feed-issue-head">
                  <div className="cm-feed-issue-badge">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="5" r="4"/></svg>
                    Issue
                  </div>
                  <span className="cm-comment-author">{c.author}</span>
                  <span className="cm-comment-time">{c.time}</span>
                </div>
                <div className="cm-feed-issue-body">{c.text}</div>
                {!c.resolved && (
                  <button className="cm-feed-issue-resolve" onClick={() => resolveIssue(c.id)}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 5l2.5 2.5 5-5"/></svg>
                    Mark as Resolved
                  </button>
                )}
              </div>
            );
          }
          if (c.type === 'ai_assistant') {
            return (
               <div key={c.id} className="cm-feed-ai">
                <div className="cm-comment-avatar" style={{background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)', color: '#fff'}}>{c.avatar}</div>
                <div className="cm-comment-body">
                  <div className="cm-comment-meta">
                    <span className="cm-comment-author" style={{background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>{c.author}</span>
                    <span className="cm-comment-time">{c.time}</span>
                  </div>
                  <p className="cm-comment-text">{c.text}</p>
                </div>
              </div>
            );
          }
          return (
            <div key={c.id} className="cm-comment">
              <div className="cm-comment-avatar">{c.avatar}</div>
              <div className="cm-comment-body">
                <div className="cm-comment-meta">
                  <span className="cm-comment-author">{c.author}</span>
                  <span className="cm-comment-time">{c.time}</span>
                </div>
                <p className="cm-comment-text">{c.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cm-comment-input-wrap">
        <textarea 
          className="cm-comment-input" 
          placeholder={mode === 'personal' ? "Ask AI or leave a private note..." : "Type a message, @AI, or /issue..."} 
          value={draft} 
          onChange={e=>setDraft(e.target.value)} 
          onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); handleSend();}}} 
          rows={2}
        />
        <div className="cm-comment-actions">
          <span className="cm-comment-hint">
            <span style={{color: 'var(--purple)', fontWeight: 600}}>@AI</span> {mode === 'group' && <>| <span style={{color: '#f59e0b', fontWeight: 600}}>/issue</span></>}
          </span>
          <button className="cm-post-btn" onClick={handleSend} disabled={!draft.trim()}>Send (⌘↵)</button>
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
  const [scope, setScope]               = useState('collection'); // 'collection' | 'request'
  const [permission, setPermission]     = useState('read-only');  // 'read-only'  | 'read-write'
  const [shareAsNew, setShareAsNew]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [invitees, setInvitees]         = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [emailDraft, setEmailDraft]     = useState('');
  const [invPerm, setInvPerm]           = useState('read-only');
  const panelRef                        = useRef(null);

  const [shareLink, setShareLink] = useState('');
  const [linkGenerating, setLinkGenerating] = useState(false);
  
  const idValue = useMemo(() => {
    const target = scope === 'collection' ? collection : activeCurl;
    return (shareAsNew ? target?._id : (target?.master_id || target?.masterId)) || target?.id;
  }, [scope, collection, activeCurl, shareAsNew]);

  useEffect(() => {
    // Generate the share link locally now
    const baseLink = `https://hitit.dev/share/${scope === 'collection' ? 'c' : 'r'}-${permission === 'read-only' ? 'ro' : 'rw'}-${idValue}`;
    setShareLink(shareAsNew ? `${baseLink}?new=true` : baseLink);
  }, [scope, permission, idValue, shareAsNew]);

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
      const payload = {
        ID: idValue,
        type: scope,
        permission: invPerm === 'read-write',
        share_as_new: shareAsNew,
        email: email, // This marks it as a direct invite
        data: {
          name: scope === 'collection' ? collection?.name : activeCurl?.name,
          invite_time: new Date().toISOString()
        }
      };
      const res = await exportCollaborators(payload);
      
      const newInv = {
        id: res?.id || Date.now(), 
        name, 
        initial: name[0].toUpperCase(), 
        email, 
        permission: invPerm
      };
      
      setInvitees(p => [...p, newInv]);
      setEmailDraft('');
    } catch (err) {
      console.error('Error inviting collaborator:', err);
    }
  };

  const removeInvitee = async (id) => {
    try {
      setInvitees(p => p.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const changeInviteePerm = async (id, perm) => {
    try {
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

  useEffect(() => {
    // We only fetch for the collection level for now as per the masterID route
    const mid = collection?.id;
    if (!mid) return;
    
    const fetchCollabs = async () => {
      try {
        setLoadingCollabs(true);
        const data = await getCollaborators(mid);
        if (Array.isArray(data)) {
          // Map backend fields to UI fields
          const mapped = data.map(c => ({
            id:         c.user_id,
            name:       c.name || 'User',
            email:      c.email_address || '',
            permission: c.write_permission ? 'read-write' : 'read-only',
            initial:    (c.name?.[0] || 'U').toUpperCase()
          }));
          setInvitees(mapped);
        } else {
          setInvitees([]);
        }
      } catch (err) {
        console.error("Failed to fetch collaborators:", err);
        setInvitees([]);
      } finally {
        // Smooth transitionout
        setTimeout(() => setLoadingCollabs(false), 500);
      }
    };
    fetchCollabs();
  }, [collection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <button className={`cm-share-scope-btn${shareAsNew?' active':''}`} onClick={() => setShareAsNew(!shareAsNew)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m2.618 5.382A2.001 2.001 0 0 1 4 11V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2.236 1.988M4 11h.01M10 3h4v4m-4-4l5 5"/>
            </svg>
            <div>
              <span className="cm-share-scope-name">Share as New</span>
              <span className="cm-share-scope-sub">Create a copy</span>
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
      <div className="cm-share-collaborators-wrap">
        {loadingCollabs ? (
          <div className="cm-share-loading">
            <div className="cm-share-loader">
              <span className="cm-spin" style={{ width: '18px', height: '18px', borderTopColor: 'var(--purple)', borderWidth: '2.5px' }} />
              <div className="cm-loading-dots">
                <span /> <span /> <span />
              </div>
            </div>
            <span className="cm-share-loading-text">Fetching collaborators...</span>
          </div>
        ) : invitees.length > 0 ? (
          <div className="cm-share-collaborators">
            <div className="cm-share-collab-head">Shared with {invitees.length}</div>
            {invitees.map(inv => (
              <div key={inv.id} className="cm-share-collab">
                <div className="cm-share-collab-avatar">{inv.initial || (inv.name ? inv.name[0].toUpperCase() : 'U')}</div>
                <div className="cm-share-collab-info">
                  <span className="cm-share-collab-name">{inv.name || inv.email?.split('@')[0]}</span>
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
        ) : (
          <div className="cm-share-empty">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.3, marginBottom: '0.4rem'}}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
             </svg>
             <span>No direct collaborators yet.</span>
          </div>
        )}
      </div>
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

// ─── Curl Modal (View & Edit as cURL) ──────────────────────────────────────────
function CurlModal({ curl, onClose, onApply, isReadOnly }) {
  const [draft, setDraft] = useState(curl);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cm-backdrop" onClick={onClose} style={{ zIndex: 600 }}>
      <div className="cm-modal" style={{ maxWidth: '600px', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div className="cm-modal-header-left">
            <div className="cm-header-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11L2 8l3-3M11 11l3-3-3-3M9 2.5l-2 11"/>
              </svg>
            </div>
            <div>
              <h3 className="cm-modal-collection-name" style={{ fontSize: '1rem' }}>cURL Editor</h3>
              <p className="cm-modal-breadcrumb" style={{ margin: 0 }}>View or modify the raw request as a command</p>
            </div>
          </div>
          <button className="cm-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>
        <div className="cm-modal-body" style={{ padding: '1.2rem', flexDirection: 'column' }}>
          <div className="cm-editor-wrap" style={{ flex: 1, minHeight: '200px' }}>
            <div className="cm-editor-toolbar">
              <span className="cm-editor-label">Raw cURL Command</span>
              <button className={`cm-icon-btn-label ${copied ? 'active' : ''}`} onClick={handleCopy} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              className="cm-editor"
              style={{ height: '300px', fontSize: '0.85rem', lineHeight: '1.6', color: '#60a5fa' }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.2rem' }}>
            <button className="cm-icon-btn-label" onClick={onClose}>Cancel</button>
            {!isReadOnly && (
              <button 
                className="cm-save-btn" 
                style={{ background: 'var(--purple)', color: '#fff', border: 'none', padding: '0.5rem 1.2rem' }}
                onClick={() => { onApply(draft); onClose(); }}
              >
                Apply Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CollectionModal({ collection, onClose, recentCollections, onSelectCollection, user, initialCurlId }) {
  const { teamId, orgId, isTeamMode, isOrgMode } = useTeam();
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
    setRequestNote('');
    setActiveCurl(null);
    setShadowHistory([]);
    setResponse('');
    setCompareSelections([]);
    setSaveListOpen(false);

    const loadSummaries = async () => {
      if (collection.id === 'quicky' || collection.isQuicky) {
        // Skip fetching for Quicky mode
        if (collection.requests?.length > 0 && !activeCurl) {
          handleSelectCurl(collection.requests[0]);
        }
        return;
      }
      try {
        setFetchingSummaries(true);
        const data = await getCollectionRequestsSummary(collection.id, teamId, orgId);
        let fetchedRequests = [];
        if (Array.isArray(data)) {
          fetchedRequests = data;
        } else if (data && Array.isArray(data.data)) {
          fetchedRequests = data.data; // Backend returns { data: [...] }
        } else if (data && Array.isArray(data.requests)) {
          fetchedRequests = data.requests;
        }

        if (fetchedRequests.length > 0) {
          setCurls(fetchedRequests);
          // Sync favorite status from the summaries
          setFavCurls(prev => {
            const next = new Set(prev);
            fetchedRequests.forEach(r => {
              if (r.favorite) next.add(r.id);
              else next.delete(r.id);
            });
            return next;
          });
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

  const [curlPanelOpen, setCurlPanelOpen]     = useState(() => collection?.isQuicky ? false : true);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
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
  const [responseMeta, setResponseMeta]       = useState(null);
  const [responseSaved, setResponseSaved]     = useState(false);
  const [savedResponses, setSavedResponses]   = useState({});
  const [saveListOpen, setSaveListOpen]       = useState(false);
  const saveListRef                           = useRef(null);
  const [compareSelections, setCompareSelections] = useState([]);
  const [responseView, setResponseView]       = useState('response');
  const [shareOpen, setShareOpen]             = useState(false);
  const shareRef                              = useRef(null);
  const [requestNote, setRequestNote]         = useState('');
  const [globalStoreOpen, setGlobalStoreOpen] = useState(false);
  const [globalVars, setGlobalVars]           = useState([]);
  const [globalOverrides, setGlobalOverrides] = useState({});
  const globals = globalVars; // Keep backward compat for the auth hint section

  // ── Environment selector ──────────────────────────────────────────────────────
  const ENVS = [
    { id: 'dev',     label: 'Dev',     color: '#10b981' },
    { id: 'staging', label: 'Staging', color: '#f59e0b' },
    { id: 'prod',    label: 'Prod',    color: '#ef4444' },
  ];
  const ENV_STORAGE_KEY = `hitit_active_env_${collection?.id || 'global'}`;
  const [activeEnv, setActiveEnv] = useState(() => {
    try { return localStorage.getItem(ENV_STORAGE_KEY) || 'dev'; } catch { return 'dev'; }
  });
  const changeEnv = (envId) => {
    setActiveEnv(envId);
    try { localStorage.setItem(ENV_STORAGE_KEY, envId); } catch {}
  };
  const activeEnvData = ENVS.find(e => e.id === activeEnv) || ENVS[0];
  const [envMenuOpen, setEnvMenuOpen] = useState(false);
  // Close env menu on outside click
  useEffect(() => {
    if (!envMenuOpen) return;
    const h = (e) => setEnvMenuOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [envMenuOpen]);

  // Fetch global variables and collection overrides for suggestions
  useEffect(() => {
    const loadGlobals = async () => {
      try {
        const [vars, overrides] = await Promise.all([
          getVariables(collection?.team_id, collection?.org_id),
          collection?.id ? getOverrides(collection.id) : Promise.resolve({})
        ]);
        setGlobalVars(vars);
        setGlobalOverrides(overrides);
      } catch (err) { console.error('Failed to load globals for suggestions', err); }
    };
    loadGlobals();
  }, [collection?.id]);

  const recentTimer                           = useRef(null);
  const [editingName, setEditingName]         = useState(false);
  const [collName, setCollName]               = useState(collection?.name || 'Untitled Collection');
  const nameInputRef                          = useRef(null);
  const [favCurls, setFavCurls]               = useState(() => {
    const initial = new Set();
    (collection?.requests || []).forEach(r => {
      if (r.favorite) initial.add(r.id);
    });
    return initial;
  });
  const [showCurlModal, setShowCurlModal]     = useState(false);
  const [generatedCurl, setGeneratedCurl]     = useState('');
  const [showReadOnlyToast, setShowReadOnlyToast] = useState(false);
  const [curlBaseCopied, setCurlBaseCopied]   = useState(false);

  // ── Resizable panels (session-only) ──────────────────────────────────────────
  const CURL_MIN = 150; const CURL_MAX = 420;
  const ACT_MIN  = 180; const ACT_MAX  = 420;
  const TAB_MIN  = 60;  const TAB_MAX  = 380;
  const [curlWidth, setCurlWidth]           = useState(220);
  const [activityWidth, setActivityWidth]   = useState(260);
  const [tabContentHeight, setTabContentHeight] = useState(190);

  // Resize handler factory — creates a mousedown handler that tracks drag delta
  const onCurlResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    let startW = 0;
    // Capture initial width synchronously
    setCurlWidth(w => { startW = w; return w; });
    const el = e.currentTarget;
    el.classList.add('cm-resize-handle--dragging');
    const onMove = (mv) => {
      const newW = Math.min(CURL_MAX, Math.max(CURL_MIN, startW + (mv.clientX - startX)));
      setCurlWidth(newW);
    };
    const onUp = () => {
      el.classList.remove('cm-resize-handle--dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onActivityResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    let startW = 0;
    setActivityWidth(w => { startW = w; return w; });
    const el = e.currentTarget;
    el.classList.add('cm-resize-handle--dragging');
    const onMove = (mv) => {
      const newW = Math.min(ACT_MAX, Math.max(ACT_MIN, startW - (mv.clientX - startX)));
      setActivityWidth(newW);
    };
    const onUp = () => {
      el.classList.remove('cm-resize-handle--dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabResize = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    let startH = 0;
    setTabContentHeight(h => { startH = h; return h; });
    const el = e.currentTarget;
    el.classList.add('cm-resize-handle--dragging');
    const onMove = (mv) => {
      const newH = Math.min(TAB_MAX, Math.max(TAB_MIN, startH + (mv.clientY - startY)));
      setTabContentHeight(newH);
    };
    const onUp = () => {
      el.classList.remove('cm-resize-handle--dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeCurl && activeCurl.write_permission === false) {
      setShowReadOnlyToast(true);
      // Auto-hide after 10 seconds since it's a long message
      const timer = setTimeout(() => setShowReadOnlyToast(false), 10000);
      return () => clearTimeout(timer);
    } else {
      setShowReadOnlyToast(false);
    }
  }, [activeCurl?.id, activeCurl?.write_permission]);
  const toggleFavCurl = useCallback(async (id) => {
    const isFav = favCurls.has(id);
    try {
      await toggleRequestFavorite(id, !isFav, teamId, orgId);
      setFavCurls(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }, [favCurls]);

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
  const [bodyError, setBodyError] = useState(null);
  const canEdit = activeCurl ? activeCurl.write_permission !== false : true;

  const activeCurlIdRef = useRef(activeCurl?.id);
  useEffect(() => { activeCurlIdRef.current = activeCurl?.id; }, [activeCurl?.id]);

  const loadDraft = useCallback((reqId) => {
    try {
      const draft = localStorage.getItem(`hitit_req_draft_${reqId}`);
      return draft ? JSON.parse(draft) : null;
    } catch { return null; }
  }, []);

  // ── Auto-save draft ──
  useEffect(() => {
    if (activeCurl?.id && activeCurl.id !== 'quicky-req') {
      const draft = { url, method, kvState, requestNote };
      try { localStorage.setItem(`hitit_req_draft_${activeCurl.id}`, JSON.stringify(draft)); } catch (e) {}
    }
  }, [url, method, kvState, requestNote, activeCurl?.id]);

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

  // ── Global Variable Suggestions (golden picker) — env-aware ─────────────────
  const resolveGlobalVal = useCallback((v) => {
    // Overrides first, then global values, for the active environment
    const override = globalOverrides?.[v.key]?.[activeEnv];
    return override || v.values?.[activeEnv] || v.values?.dev || '';
  }, [globalOverrides, activeEnv]);

  const globalHeaderSuggestions = useMemo(() => {
    return globalVars
      .map(v => ({ k: v.key, v: resolveGlobalVal(v) }))
      .filter(s => !kvState.headers.some(h => h.k === s.k));
  }, [globalVars, kvState.headers, resolveGlobalVal]);

  const globalParamSuggestions = useMemo(() => {
    return globalVars
      .map(v => ({ k: v.key, v: resolveGlobalVal(v) }))
      .filter(s => !kvState.params.some(p => p.k === s.k));
  }, [globalVars, kvState.params, resolveGlobalVal]);

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
      // Create a snapshot with unsaved edits to properly share between requests
      const shadowCopy = {
        ...activeCurl,
        headers: kvState.headers.filter(h => h.k || h.v),
        params: kvState.params.filter(p => p.k || p.v),
        body: kvState.body,
        auth: kvState.auth,
        token: kvState.token
      };

      setShadowHistory(prev => {
        // Exclude the one we are moving TO just in case it was a shadow
        const filtered = prev.filter(c => c.id !== curl.id && c.id !== activeCurl.id);
        // Prepend current active memory, keep max 2
        return [shadowCopy, ...filtered].slice(0, 2);
      });
    }

    setActiveCurl(curl);
    setUrl(curl.url || '');
    setMethod(curl.method ?? 'GET');
    setRequestNote(curl.note || '');
    setResponse('');
    setResponseMeta(null);
    setSaveListOpen(false);
    setCompareSelections([]);
    setResponseView('response');
    setBodyError(null);

    // If we have cached details, restore them instantly!
    if (cachedDetails[curl.id]) {
      const full = cachedDetails[curl.id];
      setActiveCurl(full);
      const draft = loadDraft(curl.id);
      if (draft) {
        setUrl(draft.url);
        setMethod(draft.method || full.method || 'GET');
        setRequestNote(draft.requestNote || full.note || '');
        setKvState(draft.kvState);
      } else {
        setUrl(full.url || '');
        setRequestNote(full.note || '');
        setKvState(initKV(full));
      }
      return;
    }

    // Otherwise, fallback to initial dummy values while loading real ones
    const draft = loadDraft(curl.id);
    if (draft) {
      setUrl(draft.url);
      setMethod(draft.method || curl.method || 'GET');
      setRequestNote(draft.requestNote || curl.note || '');
      setKvState(draft.kvState);
    } else {
      setKvState(initKV(curl));
    }

    if (curl.id === 'quicky-req') return;

    // And make the API call lazily
    try {
      setFetchingDetails(true);
      const fullDetails = await getRequestDetails(curl.id, teamId, orgId);
      
      // Update Cache
      setCachedDetails(prev => ({ ...prev, [curl.id]: fullDetails }));
      
      // Keep UI in sync if the user didn't click away already
      setActiveCurl(prev => prev?.id === curl.id ? fullDetails : prev);
      
      // Determine if we are still on the same request using ref
      if (activeCurlIdRef.current === curl.id || !activeCurlIdRef.current) {
        // If there's an existing draft, do NOT override with the backend data
        const currentDraft = loadDraft(curl.id);
        if (!currentDraft) {
          setUrl(fullDetails.url || '');
          setRequestNote(fullDetails.note || '');
          setKvState(initKV(fullDetails));
        }
      }
    } catch (err) {
      console.error("Failed to load full request details", err);
    } finally {
      setFetchingDetails(false);
    }
  };

  // ── Variable substitution engine ── env-aware ─────────────────────────────────
  // Priority: Collection Override (active env) > Global Default (active env) > Global Default (dev)
  const resolveVariables = useCallback((text) => {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const overrideVal = globalOverrides?.[key]?.[activeEnv];
      if (overrideVal) return overrideVal;
      const globalVar = globalVars.find(v => v.key === key);
      if (globalVar) return globalVar.values?.[activeEnv] || globalVar.values?.dev || match;
      return match;
    });
  }, [globalVars, globalOverrides, activeEnv]);

  const handleSend = async () => {
    setLoading(true); setResponse('');
    
    // Resolve all {{variables}} before sending
    const resolvedUrl = resolveVariables(url);
    const resolvedHeaders = kvState.headers.map(h => ({ ...h, k: resolveVariables(h.k), v: resolveVariables(h.v) }));
    const resolvedParams = kvState.params.map(p => ({ ...p, k: resolveVariables(p.k), v: resolveVariables(p.v) }));
    const resolvedBody = resolveVariables(kvState.body);
    const resolvedToken = resolveVariables(kvState.token);

    // Auto-save request details to backend before sending
    try {
      let currentActiveId = activeCurl?.id;

      // Special handling for Quicky: persist it before hitting
      if (collection.isQuicky && currentActiveId === 'quicky-req') {
        // 1. Find or create a "Quick Requests" collection
        let quickyCol = recentCollections.find(c => c.name === 'Quick Requests' || c.isQuicky);
        if (!quickyCol) {
          // You might want to create it here or just use a default one
          // For now, let's assume we use the first available collection as fallback or create one
          // to keep it simple, let's try to create one if allowed by API
        }
        
        const payload = {
          collection_id: quickyCol?.id || recentCollections[0]?.id,
          name: activeCurl.name || 'Quick Request',
          url,
          method,
          headers: kvState.headers.filter(h => h.k || h.v).map(h => ({ key: h.k, value: h.v })),
          params: kvState.params.filter(p => p.k || p.v).map(p => ({ key: p.k, value: p.v })),
          body: kvState.body,
          auth: kvState.auth === 'Bearer Token' ? `Bearer ${kvState.token}` : 
                kvState.auth === 'Basic Auth' ? `Basic ${kvState.token}` : 
                kvState.auth === 'No Auth' ? '' : kvState.token
        };
        
        const newReq = await createCollectionRequest(payload, teamId, orgId);
        currentActiveId = newReq.id;
        setActiveCurl(newReq);
        setCurls([newReq]); // Replace the dummy list with the real one
        setCachedDetails(prev => ({ ...prev, [newReq.id]: newReq }));
      }

      if (currentActiveId && currentActiveId !== 'quicky-req') {
        let authString = kvState.auth === 'Bearer Token' ? `Bearer ${kvState.token}` : 
                         kvState.auth === 'Basic Auth' ? `Basic ${kvState.token}` :
                         kvState.token;
                         
        if (kvState.auth === 'No Auth' || !kvState.token) {
          authString = '';
        }

        const payload = {
          name: activeCurl?.name || 'Request',
          url,
          method,
          headers: kvState.headers.filter(h => h.k || h.v).map(h => ({ key: h.k, value: h.v })),
          params: kvState.params.filter(p => p.k || p.v).map(p => ({ key: p.k, value: p.v })),
          body: kvState.body,
          auth: authString
        };
        const updatedReq = await updateCollectionRequest(currentActiveId, payload, teamId, orgId);
        
        // Update local state
        setActiveCurl(updatedReq);
        setCurls(prev => prev.map(c => c.id === currentActiveId ? { ...c, ...updatedReq } : c));
        setCachedDetails(prev => ({ ...prev, [currentActiveId]: updatedReq }));
        
        // Clear draft since it is formally sent and synced
        try { localStorage.removeItem(`hitit_req_draft_${currentActiveId}`); } catch(e) {}
      }
    } catch (err) {
      console.error("Failed to sync request changes to backend before sending", err);
    }

    try {
      const targetId = activeCurl?.id;
      if (!targetId || targetId === 'quicky-req') {
        setResponse("Error: Could not persist request for execution.");
        setLoading(false);
        return;
      }
      const resData = await hitRequest(targetId, teamId, orgId);
      
      setResponseMeta({
        status_code: resData.status_code,
        status_text: resData.status_text,
        time: resData.response_time_ms,
        size: resData.response_size_bytes,
        headers: resData.headers || []
      });

      let bodyText = resData.body;
      if (typeof resData.body === 'string') {
        try {
          const parsed = JSON.parse(resData.body);
          bodyText = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // Keep as string if parsing fails
        }
      } else if (typeof resData.body === 'object') {
        bodyText = JSON.stringify(resData.body, null, 2);
      }
      
      setResponse(bodyText || '');
    } catch (err) {
      setResponseMeta(null);
      setResponse(`Error: ${err.message || 'Unknown Error'}`);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveResponse = async () => {
    if (!response) return;
    try {
      const newSave = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        response,
        reqName: activeCurl.name,
      };
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
      await updateCollectionRequest(id, { name: newName }, teamId, orgId);
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
      }, teamId, orgId);
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
      // Assuming there's an API call to update collection name
      // For now, just log and update local state
      console.log('Renamed collection to', collName.trim());
      setEditingName(false);
    } catch (err) {
      console.error(err);
      setCollName(collection.name);
      setEditingName(false);
    }
  };

  const saveRequestNote = async () => {
    try {
      if (!activeCurl) return;
      await updateRequestNote(activeCurl.id, requestNote, teamId, orgId);
      setActiveCurl(prev => prev ? ({ ...prev, note: requestNote }) : prev);
      setCachedDetails(prev => ({
        ...prev,
        [activeCurl.id]: prev[activeCurl.id] ? { ...prev[activeCurl.id], note: requestNote } : { note: requestNote }
      }));
      setCurls(prev => prev.map(c => c.id === activeCurl.id ? { ...c, note: requestNote } : c));
    } catch (err) {
      console.error('Failed to save request note:', err);
    }
  };

  return (
    <>
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-modal" onClick={e=>e.stopPropagation()}>
        {showReadOnlyToast && (
          <div className="cm-readonly-toast">
            <div className="cm-readonly-toast-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="cm-readonly-toast-content">
              <span className="cm-readonly-toast-title">Read-only Mode</span>
              <p className="cm-readonly-toast-text">
                Uneditable by the source user can not edit or write but can still see headers and body and stuff and execute api and stuff but ca not edit
              </p>
            </div>
            <button className="cm-readonly-toast-close" onClick={() => setShowReadOnlyToast(false)}>×</button>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="cm-modal-header">
          <div className="cm-modal-header-left">
            {!collection.isQuicky && (
              <button className={`cm-panel-toggle${curlPanelOpen?' active':''}`} onClick={()=>setCurlPanelOpen(!curlPanelOpen)} title="Toggle request list">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <rect x="1.5" y="1.5" width="12" height="12" rx="2"/><path d="M5.5 1.5v12"/>
                </svg>
              </button>
            )}
            <div className="cm-modal-title-group">
              {collection.isQuicky ? (
                <span className="cm-modal-collection-name">Quick Request</span>
              ) : (
                editingName ? (
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
                  >
                    {collName}
                  </span>
                )
              )}
              {!collection.isQuicky && (
                <div className="cm-modal-breadcrumb"><span>{activeCurl?.name}</span></div>
              )}
            </div>
          </div>
          <div className="cm-modal-header-right">

            <button className="cm-icon-btn-label" onClick={()=>setGlobalStoreOpen(true)} title={`Globals — ${activeEnvData.label} environment active`}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="5.5"/><path d="M6.5 1a9 9 0 010 11M1 6.5h11"/>
              </svg>
              Globals
              {/* Active env indicator dot */}
              <span
                className="cm-env-dot"
                style={{ background: activeEnvData.color, marginLeft: '1px' }}
                title={`Active env: ${activeEnvData.label}`}
              />
            </button>
            {!(isTeamMode || isOrgMode) && (
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
            )}
            <button className={`cm-icon-btn-label${activityPanelOpen?' active':''}`} onClick={()=>setActivityPanelOpen(!activityPanelOpen)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2l3 3 3-3h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              Activity
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
            panelWidth={curlPanelOpen ? curlWidth : 0}
            favCurls={favCurls}
            onToggleFav={toggleFavCurl}
            fetchingSummaries={fetchingSummaries}
          />
          {curlPanelOpen && (
            <div
              className="cm-resize-handle cm-resize-handle--v"
              onMouseDown={onCurlResize}
              title="Drag to resize"
            />
          )}

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
                <button className="cm-method-btn" onClick={()=> !canEdit ? null : setMethodOpen(!methodOpen)} disabled={!canEdit}>
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
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  className="cm-url-input" 
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  value={url} 
                  disabled={!canEdit}
                  onChange={e => {
                    const val = e.target.value;
                    const parsed = parseCurlCommand(val);
                    if (parsed.isCurl) {
                      setUrl(parsed.url);
                      setMethod(parsed.method);
                      setKvState(prev => ({
                        ...prev,
                        headers: parsed.headers,
                        auth: parsed.auth,
                        token: parsed.token,
                        body: (() => {
                          const { formatted, error } = tryFormatJson(parsed.body || '');
                          // Defer state update for error to avoid batching issues
                          setTimeout(() => setBodyError(error), 0);
                          return formatted;
                        })()
                      }));
                    } else {
                      setUrl(val);
                    }
                  }} 
                  placeholder="https://api.example.com/endpoint or paste 'curl ...'"
                />
                <button 
                  className={`cm-icon-btn ${curlBaseCopied ? 'active' : ''}`}
                  title={curlBaseCopied ? "Copied!" : "View & Edit as cURL (Double-click to copy)"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.curlClickTimeout) {
                      // It's a double click - clear timeout and run copy logic
                      clearTimeout(window.curlClickTimeout);
                      window.curlClickTimeout = null;
                      setShowCurlModal(false); // ensure modal is closed
                      const cmd = generateCurlCommand(method, url, kvState.headers, kvState.auth, kvState.token, kvState.body, kvState.params);
                      navigator.clipboard.writeText(cmd).catch(() => {});
                      setCurlBaseCopied(true);
                      setTimeout(() => setCurlBaseCopied(false), 450);
                    } else {
                      // First click - wait to see if it becomes a double click
                      window.curlClickTimeout = setTimeout(() => {
                        window.curlClickTimeout = null;
                        // Single click action (open modal)
                        setGeneratedCurl(generateCurlCommand(method, url, kvState.headers, kvState.auth, kvState.token, kvState.body, kvState.params));
                        setShowCurlModal(true);
                      }, 250);
                    }
                  }}
                  style={{ position: 'absolute', right: '0.4rem', width: 'auto', minWidth: '26px', height: '26px', padding: curlBaseCopied ? '0 8px' : '0', color: curlBaseCopied ? 'var(--purple)' : 'var(--text-dim)', fontSize: '11px', fontWeight: 600 }}
                >
                  {curlBaseCopied ? (
                     "Copied!"
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 11L2 8l3-3M11 11l3-3-3-3M9 2.5l-2 11"/>
                    </svg>
                  )}
                </button>
              </div>
              <button className="cm-send-btn" onClick={handleSend} disabled={loading} style={{ flexShrink: 0 }}>
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

            {/* Tab content — vertically resizable */}
            <div className="cm-tab-content" style={{ maxHeight: tabContentHeight }}>

              {/* HEADERS */}
              {activeTab==='headers' && (
                <div className="cm-kv-table">
                  <div className="cm-kv-header"><span>Key</span><span>Value</span><span/></div>
                  {kvState.headers.map((row,i)=>(
                    <KVRow
                      key={i} row={row}
                      sharedSuggestions={sharedHeaders}
                      globalSuggestions={globalHeaderSuggestions}
                      onChange={val=>updateHeader(i,val)}
                      onDelete={()=>deleteHeader(i)}
                      isReadOnly={!canEdit}
                    />
                  ))}
                  <button className="cm-kv-add" onClick={addHeader} disabled={!canEdit}>+ Add header</button>
                  {sharedHeaders.length>0 && (
                    <div className="cm-shared-banner" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M5.5 1v9M1 5.5l9 0z"/>
                      </svg>
                      {sharedHeaders.length} header{sharedHeaders.length!==1?'s':''} from Shadow History. Focus an empty row to use them.
                    </div>
                  )}
                  {globalHeaderSuggestions.length>0 && (
                    <div className="cm-global-banner">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="5.5" cy="5.5" r="4"/><path d="M5.5 1.5v8M1.5 5.5h8"/>
                      </svg>
                      {globalHeaderSuggestions.length} header{globalHeaderSuggestions.length!==1?'s':''} available from Globals. Focus an empty row to use them.
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
                      globalSuggestions={globalParamSuggestions}
                      onChange={val=>updateParam(i,val)}
                      onDelete={()=>deleteParam(i)}
                      isReadOnly={!canEdit}
                    />
                  ))}
                  <button className="cm-kv-add" onClick={addParam} disabled={!canEdit}>+ Add param</button>
                  {sharedParams.length>0 && (
                    <div className="cm-shared-banner" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M5.5 1v9M1 5.5l9 0z"/>
                      </svg>
                      {sharedParams.length} param{sharedParams.length!==1?'s':''} from Shadow History. Focus an empty row to use them.
                    </div>
                  )}
                  {globalParamSuggestions.length>0 && (
                    <div className="cm-global-banner">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="5.5" cy="5.5" r="4"/><path d="M5.5 1.5v8M1.5 5.5h8"/>
                      </svg>
                      {globalParamSuggestions.length} param{globalParamSuggestions.length!==1?'s':''} available from Globals. Focus an empty row to use them.
                    </div>
                  )}
                </div>
              )}

              {/* BODY */}
              {activeTab==='body' && (
                <div className="cm-editor-wrap">
                  <div className="cm-editor-toolbar">
                    <span className="cm-editor-label">Request Body</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {canEdit && (kvState.body || '').trim() && (
                        <button
                          type="button"
                          className="cm-body-format-btn"
                          title="Auto-format as JSON"
                          onClick={() => {
                            const { formatted, error } = tryFormatJson(kvState.body || '');
                            setKvState(prev => ({ ...prev, body: formatted }));
                            setBodyError(error);
                          }}
                        >
                          ⌥ Format
                        </button>
                      )}
                      <span className="cm-editor-type">JSON</span>
                    </div>
                  </div>
                  {bodyError && (
                    <div className="cm-body-error-bar" title={bodyError}>
                      <span className="cm-body-error-dot"/>
                      <span className="cm-body-error-msg">{bodyError}</span>
                    </div>
                  )}
                  <textarea 
                    className={`cm-editor${bodyError ? ' cm-editor--error' : ''}`}
                    value={kvState.body} 
                    onChange={e => {
                      const val = e.target.value;
                      setBodyError(val.trim() ? tryFormatJson(val).error : null);
                      setKvState(prev => ({ ...prev, body: val }));
                    }}
                    spellCheck={false}
                    disabled={!canEdit}
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
                      disabled={!canEdit}
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
                        disabled={!canEdit}
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

            {/* Vertical resize handle between tab content and response */}
            <div
              className="cm-resize-handle cm-resize-handle--h"
              onMouseDown={onTabResize}
              title="Drag to resize"
            />

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
                    {responseMeta ? (
                      <>
                        <span className="cm-response-status" style={{color: STATUS_COLOR[responseMeta.status_code?.toString()?.[0]] || '#a1a1aa'}}>
                          {responseMeta.status_code} {responseMeta.status_text}
                        </span>
                        <span className="cm-response-time">{responseMeta.time || 0}ms</span>
                        <span className="cm-response-size">{responseMeta.size ? (responseMeta.size / 1024).toFixed(2) : 0} KB</span>
                      </>
                    ) : (
                      <span className="cm-response-status" style={{color:'#a1a1aa'}}>Done</span>
                    )}
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

            {/* Request note */}
            <div className="cm-coll-comment">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M11 1H2a1 1 0 00-1 1v6a1 1 0 001 1h2l2.5 2.5L9 9h2a1 1 0 001-1V2a1 1 0 00-1-1z"/>
              </svg>
              <input className="cm-coll-comment-input" placeholder="Add a note to this request…" value={requestNote} onChange={e=>setRequestNote(e.target.value)} disabled={!canEdit}/>
              {canEdit && requestNote !== (activeCurl?.note || '') && <button className="cm-coll-comment-save" onClick={saveRequestNote}>Save</button>}
            </div>
            </> )}
          </div>

          {/* Activity Panel */}
          {activityPanelOpen && (
            <div
              className="cm-resize-handle cm-resize-handle--v"
              onMouseDown={onActivityResize}
              title="Drag to resize"
            />
          )}
          <ActivityFeedPanel open={activityPanelOpen} onClose={()=>setActivityPanelOpen(false)} collectionId={collection?.master_id || collection?.masterId || collection?._id || collection?.id} currentUser={user} panelWidth={activityPanelOpen ? activityWidth : 0} />
        </div>

        {/* Recent hover strip */}
        <div className="cm-recent-trigger" onMouseEnter={handleRecentEnter} onMouseLeave={handleRecentLeave}>
          <div className={`cm-recent-peek${recentHover?' cm-recent-peek--open':''}`}>
            <RecentTabs 
              recentCollections={recentCollections} 
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
        collectionId={collection?.id}
        collectionName={collection?.name}
        teamId={collection?.team_id}
        orgId={collection?.org_id}
        onClose={() => setGlobalStoreOpen(false)}
        activeEnv={activeEnv}
        onChangeEnv={changeEnv}
      />
    )}

    {showCurlModal && (
      <CurlModal
        curl={generatedCurl}
        onClose={() => setShowCurlModal(false)}
        onApply={(updatedCurl) => {
          const parsed = parseCurlCommand(updatedCurl);
          if (parsed.isCurl) {
            setUrl(parsed.url);
            setMethod(parsed.method);
            setKvState(prev => ({
              ...prev,
              headers: parsed.headers,
              auth: parsed.auth,
              token: parsed.token,
              body: parsed.body || ''
            }));
          }
        }}
        isReadOnly={!canEdit}
      />
    )}
    </>

  );
}