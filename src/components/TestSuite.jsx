import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTeam } from '../context/TeamContext';
import './TestSuite.css';
import { parseCurlCommand } from './CollectionModal';
import {
  fetchTestSuiteCollections,
  createTestSuiteCollection,
  renameTestSuiteCollection,
  deleteTestSuiteCollection,
  createTestSuiteRequest,
  updateTestSuiteRequest,
  deleteTestSuiteRequest,
  runTestSuite,
  pollTestSuiteJob,
  getTestSuiteJobLogs,
  saveExpectedResponse,
  fetchExpectedResponse,
  fetchTestSuiteRequests
} from '../api/testSuite.api';

// ─── JSON auto-formatter (mirrors CollectionModal.tryFormatJson) ─────────────
const tryFormatJson = (text) => {
  if (!text || !text.trim()) return text;
  const cleaned = text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .trim();
  try { return JSON.stringify(JSON.parse(cleaned), null, 2); } catch { return cleaned; }
};

// ─── tiny helpers ───────────────────────────────────────────────
const emptyKV = () => [{ k: '', v: '' }];

const buildCurl = (req, headers, params) => {
  const hParts = headers.filter(h => h.k).map(h => `  -H '${h.k}: ${h.v}'`).join(' \\\n');
  const paramStr = params.filter(p => p.k).map(p => `${p.k}=${encodeURIComponent(p.v)}`).join('&');
  const url = paramStr ? `${req.url || ''}?${paramStr}` : (req.url || '');
  const bodyPart = req.body ? ` \\\n  -d '${req.body.replace(/\n/g, '')}'` : '';
  return `curl -X ${(req.method || 'GET').toUpperCase()} '${url}' \\\n${hParts}${bodyPart}`;
};

const parseJsonFields = str => {
  try {
    return Object.entries(JSON.parse(str)).map(([key, val]) => ({ key, val: String(val) }));
  } catch {
    return [];
  }
};

// ─── Parse backend auth string → AuthPanel object ─────────────────────────
const parseAuthString = (raw) => {
  if (!raw || raw === 'No Auth') return { type: 'none' };
  if (raw.startsWith('Bearer ')) return { type: 'bearer', token: raw.slice(7) };
  if (raw.startsWith('Basic '))  return { type: 'basic',  token: raw.slice(6) };
  // API-key: just a raw value — store as apikey
  return { type: 'apikey', keyValue: raw };
};

// ─── sub-components ─────────────────────────────────────────────

const KVTable = ({ rows, onChange }) => {
  const update = (i, field, value) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    onChange(next);
  };
  const add    = () => onChange([...rows, { k: '', v: '' }]);
  const remove = i  => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="ts-kv-wrap">
      <table className="ts-kv-table">
        <thead>
          <tr><th>Key</th><th>Value</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input id={`kv-k-${i}`} name={`kv-k-${i}`} className="ts-kv-input key" value={row.k || ''} placeholder="key" onChange={e => update(i, 'k', e.target.value)} />
              </td>
              <td>
                <input id={`kv-v-${i}`} name={`kv-v-${i}`} className="ts-kv-input val" value={row.v || ''} placeholder="value" onChange={e => update(i, 'v', e.target.value)} />
              </td>
              <td>
                <button className="ts-kv-del" onClick={() => remove(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="ts-kv-add" onClick={add}>+ Add row</button>
    </div>
  );
};

const AuthPanel = ({ auth, onChange }) => (
  <div className="ts-auth-wrap">
    <div className="ts-auth-field">
      <label className="ts-auth-label">Auth type</label>
      <select className="ts-auth-select" value={auth.type || 'none'} onChange={e => onChange({ ...auth, type: e.target.value })}>
        <option value="none">No auth</option>
        <option value="bearer">Bearer token</option>
        <option value="basic">Basic auth</option>
        <option value="apikey">API key</option>
      </select>
    </div>
    {auth.type === 'bearer' && (
      <div className="ts-auth-field">
        <label className="ts-auth-label">Token</label>
        <input className="ts-auth-input" type="text" value={auth.token || ''} placeholder="Bearer token" onChange={e => onChange({ ...auth, token: e.target.value })} />
      </div>
    )}
    {auth.type === 'basic' && (
      <>
        <div className="ts-auth-field"><label className="ts-auth-label">Username</label><input className="ts-auth-input" type="text" value={auth.username || ''} onChange={e => onChange({ ...auth, username: e.target.value })} /></div>
        <div className="ts-auth-field"><label className="ts-auth-label">Password</label><input className="ts-auth-input" type="password" value={auth.password || ''} onChange={e => onChange({ ...auth, password: e.target.value })} /></div>
      </>
    )}
    {auth.type === 'apikey' && (
      <>
        <div className="ts-auth-field"><label className="ts-auth-label">Header name</label><input className="ts-auth-input" type="text" value={auth.keyName || ''} onChange={e => onChange({ ...auth, keyName: e.target.value })} /></div>
        <div className="ts-auth-field"><label className="ts-auth-label">Value</label><input className="ts-auth-input" type="text" value={auth.keyValue || ''} onChange={e => onChange({ ...auth, keyValue: e.target.value })} /></div>
      </>
    )}
    {auth.type === 'none' && <p className="ts-auth-none">This request does not use authentication.</p>}
  </div>
);

const GitDiffView = ({ expected, actual }) => {
  const tryParse = (val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  };

  const normalize = (val) => {
    const parsed = tryParse(val);
    // If it's the backend's Key/Value array, flatten it to an object for better diffing
    if (Array.isArray(parsed) && parsed.every(i => i && typeof i === 'object' && 'Key' in i)) {
      const obj = {};
      parsed.forEach(item => { obj[item.Key] = item.Value; });
      return obj;
    }
    return parsed;
  };

  const eObj = normalize(expected);
  const aObj = normalize(actual);

  const eStr = JSON.stringify(eObj, null, 2) || '';
  const aStr = JSON.stringify(aObj, null, 2) || '';

  const eLines = eStr.split('\n');
  const aLines = aStr.split('\n');

  const lines = [];
  const max = Math.max(eLines.length, aLines.length);

  for (let i = 0; i < max; i++) {
    const el = eLines[i];
    const al = aLines[i];
    if (el === al) {
      lines.push({ type: 'equal', text: el });
    } else {
      if (el !== undefined) lines.push({ type: 'del', text: el });
      if (al !== undefined) lines.push({ type: 'add', text: al });
    }
  }

  return (
    <div className="ts-git-diff">
      {lines.map((line, i) => (
        <div key={i} className={`ts-git-line ${line.type}`}>
          <span className="ts-git-sign">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</span>
          <pre className="ts-git-text">{line.text}</pre>
        </div>
      ))}
    </div>
  );
};

const Banner = ({ runState }) => {
  if (!runState) return null;
  if (runState === 'running') return <div className="ts-banner running"><span className="ts-pulse" /> Running test, hang tight…</div>;
  const pass = runState.filter(r => r.match).length;
  const fail = runState.filter(r => !r.match).length;
  if (fail === 0) return <div className="ts-banner pass">✓ All {pass} field{pass !== 1 ? 's' : ''} matched — test passed</div>;
  return <div className="ts-banner fail">✗ {fail} mismatch{fail !== 1 ? 'es' : ''} — review the diff below</div>;
};

const Steps = ({ activeReq, hasRun }) => {
  const cls = n => n === 1 ? (activeReq ? 'active' : '') : (n === 2 ? (hasRun ? 'done' : 'active') : (hasRun ? 'active' : ''));
  const ico = n => n === 2 && hasRun ? '✓' : n;

  return (
    <div className="ts-steps-row">
      {[1, 2, 3].map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && <div className="ts-step-line" />}
          <div className={`ts-step ${cls(n)}`}>
            <span className="ts-step-n">{ico(n)}</span>
            {n === 1 ? 'Set expected' : n === 2 ? 'Run' : 'Review'}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};


// ─── Main Component ─────────────────────────────────────────────
const TestSuite = () => {
  const { teamId } = useTeam();
  const [collections, setCollections] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedColls, setExpandedColls] = useState(new Set());

  // Separate state for requests per collection (to keep payload small)
  const [collectionRequests, setCollectionRequests] = useState({}); // { collectionId: requests[] }
  const [collectionLoading, setCollectionLoading] = useState({});  // { collectionId: boolean }
  const [collectionErrors, setCollectionErrors] = useState({});   // { collectionId: errorMessage }

  const [selectedColls, setSelectedColls] = useState(new Set());
  const [selectedReqs, setSelectedReqs] = useState(new Set());

  const [activeReq, setActiveReq] = useState(null);
  const [expectedData, setExpectedData] = useState({});
  const [actualResponseData, setActualResponseData] = useState({}); // { reqId: actual_response }
  const [draftExp, setDraftExp] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // local missing expected flags
  const [missingExpectations, setMissingExpectations] = useState(new Set());

  // collection / request name editing
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const renameRef = useRef(null);

  // per-request form state
  const [kvHeaders, setKvHeaders] = useState({});
  const [kvParams, setKvParams] = useState({});
  const [kvBody, setKvBody] = useState({});
  const [kvAuth, setKvAuth] = useState({});

  const [activeTab, setActiveTab] = useState('headers');

  // Job Run Tracking
  const [currentJob, setCurrentJob] = useState(null); // { id, status, total, success, failed, errorMsg }
  const [jobLogs, setJobLogs] = useState([]);

  const [loading, setLoading] = useState(false);

  // Debounced save ref — fires 600 ms after the last field change
  const saveTimerRef = useRef(null);

  // ── Helper: build a full payload from current KV state and save to backend ──
  const saveRequestFields = useCallback((reqId, collectionId, overrides = {}) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const hdrs  = overrides.headers ?? kvHeaders[reqId] ?? [];
        const prams = overrides.params  ?? kvParams[reqId]  ?? [];
        const bd    = overrides.body    ?? kvBody[reqId]    ?? '';
        const at    = overrides.auth    ?? kvAuth[reqId]    ?? { type: 'none' };
        const name   = overrides.name   ?? activeReq?.name;
        const url    = overrides.url;
        const method = overrides.method;

        // Backend DTO: KeyValuePair = { key, value } — not { k, v }
        const toKV = (arr) => arr.filter(x => x.k).map(x => ({ key: x.k, value: x.v }));

        // Backend Auth field is a string, not an object.
        // Serialize: "Bearer <token>", "Basic <token>", or "No Auth"
        const serializeAuth = (a) => {
          if (!a || a.type === 'none') return 'No Auth';
          if (a.type === 'bearer') return a.token ? `Bearer ${a.token}` : 'No Auth';
          if (a.type === 'basic')  return a.token ? `Basic ${a.token}`  : 'No Auth';
          if (a.type === 'apikey') return a.keyValue || 'No Auth';
          return 'No Auth';
        };

        const payload = {
          ...(name   !== undefined && { name }),
          ...(url    !== undefined && { url }),
          ...(method !== undefined && { method }),
          headers: toKV(hdrs),
          params:  toKV(prams),
          body:    bd,
          auth:    serializeAuth(at),
        };

        const updated = await updateTestSuiteRequest(reqId, payload, teamId);
        const merged = { ...updated };

        setActiveReq(prev => (prev?.id === reqId ? { ...prev, ...merged } : prev));
        setCollectionRequests(prev => ({
          ...prev,
          [collectionId]: (prev[collectionId] || []).map(r => r.id === reqId ? { ...r, ...merged } : r)
        }));
      } catch (e) {
        console.error('Failed to auto-save request fields:', e);
      }
    }, 600);
  }, [kvHeaders, kvParams, kvBody, kvAuth, teamId]);

  // Refresh Collections
  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTestSuiteCollections(teamId);
      setCollections(data || []);
      // auto-expand first
      if (data?.length > 0) {
        setExpandedColls(new Set([data[0].id]));
      }
    } catch (e) {
      console.error('Failed to load test suite collections:', e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Fetch requests for a specific collection (separate payload)
  const loadRequestsForCollection = useCallback(async (collectionId) => {
    if (collectionRequests[collectionId] || collectionLoading[collectionId]) return; // already loaded or loading

    setCollectionLoading(prev => ({ ...prev, [collectionId]: true }));
    setCollectionErrors(prev => ({ ...prev, [collectionId]: null }));

    try {
      const requests = await fetchTestSuiteRequests(collectionId, teamId);
      setCollectionRequests(prev => ({ ...prev, [collectionId]: requests }));
    } catch (e) {
      console.error(`Failed to load requests for collection ${collectionId}:`, e);
      setCollectionErrors(prev => ({ ...prev, [collectionId]: e.message || 'Failed to load requests' }));
    } finally {
      setCollectionLoading(prev => ({ ...prev, [collectionId]: false }));
    }
  }, [teamId, collectionRequests, collectionLoading]);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  // Load requests automatically when a collection is expanded
  useEffect(() => {
    expandedColls.forEach(collId => {
      loadRequestsForCollection(collId);
    });
  }, [expandedColls, loadRequestsForCollection]);

  // Handle active req selection -> Load Expected Response
  const lastIdRef = useRef(null);
  useEffect(() => {
    if (!activeReq) return;
    const reqId = activeReq.id;
    
    // Only reset tab if we actually switched to a DIFFERENT request
    if (lastIdRef.current !== reqId) {
      setActiveTab('headers');
      lastIdRef.current = reqId;
    }
    
    // Load local editable state
    setKvHeaders(prev => prev[reqId] ? prev : { ...prev, [reqId]: (activeReq.headers || []).map(h => ({ k: h.key ?? h.k, v: h.value ?? h.v })) });
    setKvParams( prev => prev[reqId] ? prev : { ...prev, [reqId]: (activeReq.params  || []).map(p => ({ k: p.key ?? p.k, v: p.value ?? p.v })) });
    setKvBody(   prev => prev[reqId] ? prev : { ...prev, [reqId]: activeReq.body || '' });
    // Backend stores auth as a string ("Bearer ..."), parse it back to an object
    setKvAuth(   prev => prev[reqId] ? prev : {
      ...prev,
      [reqId]: typeof activeReq.auth === 'string'
        ? parseAuthString(activeReq.auth)
        : (activeReq.auth || { type: 'none' })
    });
    
    // Fetch expected (and actual_response if backend returned it)
    fetchExpectedResponse(reqId, teamId).then(res => {
      const savedDoc = res && Array.isArray(res) ? res.find(r => r.type === 'saved') : null;
      
      if (savedDoc) {
        // 1. Sync Expected Response string
        let expectedStr = savedDoc.expected_response || savedDoc.data || '';
        if (expectedStr && typeof expectedStr === 'object') {
          expectedStr = JSON.stringify(expectedStr, null, 2);
        }
        setExpectedData(prev => ({ ...prev, [reqId]: expectedStr }));
        setDraftExp(expectedStr);
        setIsDirty(false);

        // 2. Sync Request Metadata (URL, Method, Headers, etc.) from the saved document
        if (savedDoc.request) {
          const sReq = savedDoc.request;
          
          // Update activeReq if fields are missing or different
          setActiveReq(prev => {
            if (prev?.id !== reqId) return prev;
            // Prevent redundant state updates if data matches
            if (prev.url === sReq.url && prev.method === sReq.method) return prev;
            return {
              ...prev,
              url: prev.url || sReq.url || '',
              method: prev.method || sReq.method || 'GET',
            };
          });

          // Sync local KV states from the saved request (only if not already set or manually edited)
          setKvHeaders(prev => ({
            ...prev,
            [reqId]: prev[reqId]?.some(h => h.k) ? prev[reqId] : (sReq.headers || []).map(h => ({ k: h.key ?? h.k, v: h.value ?? h.v }))
          }));
          setKvParams(prev => ({
            ...prev,
            [reqId]: prev[reqId]?.some(p => p.k) ? prev[reqId] : (sReq.params || []).map(p => ({ k: p.key ?? p.k, v: p.value ?? p.v }))
          }));
          setKvBody(prev => ({
            ...prev,
            [reqId]: prev[reqId] ? prev[reqId] : (sReq.body || '')
          }));
          setKvAuth(prev => ({
            ...prev,
            [reqId]: prev[reqId]?.type !== 'none' ? prev[reqId] : (typeof sReq.auth === 'string' ? parseAuthString(sReq.auth) : (sReq.auth || { type: 'none' }))
          }));
        }

        // 3. Store the actual_response if present
        if (savedDoc.actual_response) {
          setActualResponseData(prev => ({ ...prev, [reqId]: savedDoc.actual_response }));
        }

        // 4. Clear the missing-expectation badge
        setMissingExpectations(prev => {
          const next = new Set(prev);
          next.delete(reqId);
          return next;
        });
      } else {
        setDraftExp('');
        setIsDirty(false);
      }
    }).catch(err => {
      console.error('Failed to fetch expected response:', err);
      setDraftExp('');
      setIsDirty(false);
    });

  }, [activeReq, teamId]);


  // ── Modifiers ───────────────────────────────────────────────────

  const startRename = (e, id, name) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(name);
    setTimeout(() => renameRef.current?.select(), 20);
  };
  
  const commitRename = async (isColl, collId, reqId) => {
    const freshName = editingName.trim();
    if (!freshName) { setEditingId(null); return; }
    try {
      if (isColl) {
        await renameTestSuiteCollection(collId, freshName, teamId);
        setCollections(prev => prev.map(c => c.id === collId ? { ...c, name: freshName } : c));
      } else {
        await updateTestSuiteRequest(reqId, { name: freshName }, teamId);
        // Update in collectionRequests state
        setCollectionRequests(prev => ({
          ...prev,
          [collId]: (prev[collId] || []).map(r => r.id === reqId ? { ...r, name: freshName } : r)
        }));
        if (activeReq?.id === reqId) setActiveReq(prev => ({ ...prev, name: freshName }));
      }
    } catch (e) {
      console.error(e);
    }
    setEditingId(null);
  };

  const addColl = async () => {
    const defaultName = 'New Collection';
    try {
      const payload = {
        name: defaultName,
        default_method: 'GET',
        accent_color: '#7c3aed',
        pattern: 'waves',
        is_private: false
      };
      const newColl = await createTestSuiteCollection(payload, teamId);
      setCollections(prev => [newColl, ...prev]);
      setExpandedColls(prev => new Set(prev).add(newColl.id));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteColl = async (e, collId) => {
    e.stopPropagation();
    try {
      await deleteTestSuiteCollection(collId, teamId);
      setCollections(prev => prev.filter(c => c.id !== collId));
      setSelectedColls(prev => { const n = new Set(prev); n.delete(collId); return n; });
    } catch(e) { console.error(e); }
  };

  const addReq = async (e, collId) => {
    e.stopPropagation();
    const defaultName = 'New Request';
    try {
      const newReq = await createTestSuiteRequest(collId, { name: defaultName, method: 'GET', url: '' }, teamId);
      // Update requests for this collection
      setCollectionRequests(prev => ({
        ...prev,
        [collId]: [...(prev[collId] || []), newReq]
      }));
      setActiveReq(newReq);
      setExpandedColls(prev => new Set(prev).add(collId));
    } catch(e) { console.error(e); }
  };

  const deleteReq = async (e, collId, reqId) => {
    e.stopPropagation();
    try {
      await deleteTestSuiteRequest(reqId, teamId);
      // Remove from collectionRequests state
      setCollectionRequests(prev => ({
        ...prev,
        [collId]: (prev[collId] || []).filter(r => r.id !== reqId)
      }));
      if (activeReq?.id === reqId) setActiveReq(null);
      setSelectedReqs(prev => { const n = new Set(prev); n.delete(reqId); return n; });
    } catch(e) { console.error(e); }
  };

  const updateActiveReqUrl = (val) => {
    const parsed = parseCurlCommand(val);
    const currentReq = activeReq;
    if (!currentReq) return;
    const collId = currentReq.collection_id;

    if (parsed.isCurl) {
      // ── cURL paste: update all local state immediately, then debounce-save ──
      const formattedBody = tryFormatJson(parsed.body || '');
      const newHeaders = parsed.headers.map(h => ({ k: h.k, v: h.v }));
      const newAuth =
        parsed.auth === 'Bearer Token' ? { type: 'bearer', token: parsed.token }
        : parsed.auth === 'Basic Auth' ? { type: 'basic',  token: parsed.token }
        : kvAuth[currentReq.id] || { type: 'none' };

      // Update local UI state
      setActiveReq(prev => ({ ...prev, url: parsed.url, method: parsed.method }));
      setKvHeaders(prev => ({ ...prev, [currentReq.id]: newHeaders }));
      setKvBody(prev   => ({ ...prev, [currentReq.id]: formattedBody }));
      setKvAuth(prev   => ({ ...prev, [currentReq.id]: newAuth }));

      // Debounce-save full payload (override with freshly parsed values)
      saveRequestFields(currentReq.id, collId, {
        url:     parsed.url,
        method:  parsed.method,
        headers: newHeaders,
        params:  kvParams[currentReq.id] || [],
        body:    formattedBody,
        auth:    newAuth,
      });
    } else {
      // ── Plain URL typing: just update URL locally + debounce-save ──
      setActiveReq(prev => ({ ...prev, url: val }));
      saveRequestFields(currentReq.id, collId, { url: val });
    }
  };

  const doSaveExpected = async () => {
    if (!isDirty || !activeReq) return;
    try {
      await saveExpectedResponse(activeReq.id, draftExp, teamId);
      setExpectedData(prev => ({ ...prev, [activeReq.id]: draftExp }));
      setIsDirty(false);
      setMissingExpectations(prev => { const n = new Set(prev); n.delete(activeReq.id); return n; });
    } catch (e) {
      console.error('Failed to save expectation', e);
    }
  };

  // ── Run Workflow ────────────────────────────────────────────────

  const startRun = async () => {
    if (selectedReqs.size === 0 && selectedColls.size === 0) return;
    
    setCurrentJob({ status: 'initiating' });
    setJobLogs([]);

    try {
      const res = await runTestSuite({
        collection_ids: Array.from(selectedColls),
        request_ids: Array.from(selectedReqs)
      }, teamId);

      setCurrentJob({
        id: res.job_id || res.id || res.data?.job_id,
        status: res.status || 'pending',
        total: res.total_tasks || res.data?.total_tasks || 0,
        success: 0,
        failed: 0,
        errorMsg: null
      });

    } catch (e) {
      const errMsg = e.data?.error?.message || e.message;
      let missingList = [];
      if (errMsg && errMsg.toLowerCase().includes('expected response')) {
        // Backend says requests are missing expectations. Parse them!
        // Format: "the following requests have no saved expected response: <id1>, <id2>"
        const parts = errMsg.split(':');
        if (parts.length > 1) {
          missingList = parts[1].split(',').map(s => s.trim()).filter(Boolean);
          setMissingExpectations(new Set(missingList));
        }
      }
      setCurrentJob({ status: 'aborted', errorMsg: errMsg || 'Workflow initialization failed.' });
    }
  };

  useEffect(() => {
    if (!currentJob?.id) return;
    if (currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'aborted') return;

    const pid = setInterval(async () => {
      try {
        const res = await pollTestSuiteJob(currentJob.id, teamId);
        const st = res.data || res;
        
        const isDone = st.status === 'completed' || st.status === 'failed';
        setCurrentJob(prev => ({
          ...prev,
          status: st.status,
          success: st.success_tasks || 0,
          failed: st.failed_tasks || 0,
          total: st.total_tasks || prev.total
        }));

        if (isDone) {
          // fetch logs
          const logsRes = await getTestSuiteJobLogs(currentJob.id, teamId);
          setJobLogs(logsRes?.data?.entries || logsRes?.entries || []);
        }

      } catch (e) {
        console.error('Polling error', e);
        // Do not instantly abort on a single failed poll, just log it.
      }
    }, 1500);

    return () => clearInterval(pid);
  }, [currentJob, teamId]);


  // ── Selection helpers ──────────────────────────────────────────

  const recomputeColls = useCallback((reqs) => {
    const next = new Set();
    collections.forEach(c => {
      const reqsForColl = collectionRequests[c.id] || [];
      // Only add collection if it has requests AND all of them are selected
      if (reqsForColl.length > 0 && reqsForColl.every(r => reqs.has(r.id))) {
        next.add(c.id);
      }
    });
    setSelectedColls(next);
  }, [collections, collectionRequests]);

  const toggleColl = (coll) => {
    const reqs = collectionRequests[coll.id] || [];
    const allSel = reqs.every(r => selectedReqs.has(r.id));
    const next = new Set(selectedReqs);
    reqs.forEach(r => allSel ? next.delete(r.id) : next.add(r.id));
    setSelectedReqs(next);
    recomputeColls(next);
  };

  const toggleReq = (e, coll, reqId) => {
    e.stopPropagation();
    const next = new Set(selectedReqs);
    next.has(reqId) ? next.delete(reqId) : next.add(reqId);
    setSelectedReqs(next);
    recomputeColls(next);
  };

  const toggleExpand = (collId) => {
    setExpandedColls(prev => {
      const n = new Set(prev);
      if (n.has(collId)) {
        n.delete(collId);
      } else {
        n.add(collId);
        // Will trigger useEffect to load requests
      }
      return n;
    });
  };

  // ── Derived State ──────────────────────────────────────────────
  
  const selCount  = { colls: selectedColls.size, reqs: selectedReqs.size };
  const reqId     = activeReq?.id;
  const headers   = kvHeaders[reqId] || [];
  const params    = kvParams[reqId]  || [];
  const body      = kvBody[reqId]    ?? '';
  const auth      = kvAuth[reqId]    || { type: 'none' };
  
  const tabDefs = [
    { id: 'headers', label: 'Headers', count: headers.filter(h => h.k).length },
    { id: 'params',  label: 'Params',  count: params.filter(p => p.k).length  },
    { id: 'body',    label: 'Body',    count: body ? 1 : 0                     },
    { id: 'auth',    label: 'Auth',    count: auth.type !== 'none' ? 1 : 0     },
  ];

  // Prefer job-log entry for this request; fall back to actual_response from the saved-doc fetch
  const activeReqLog = jobLogs.find(l => l.request_id === reqId);
  // Normalise both shapes to { data: { status_code, response_time_ms, body }, match_result: { matched } }
  const activeActual = activeReqLog
    ? { data: activeReqLog.response?.data, match_result: activeReqLog.response?.match_result }
    : (actualResponseData[reqId] ?? null);


  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="ts-wrapper">
      <div className="hp-toolbar" style={{ justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <span className="hp-count">
          {selCount.colls} collection{selCount.colls !== 1 ? 's' : ''} · {selCount.reqs} request{selCount.reqs !== 1 ? 's' : ''}
        </span>
        <button className="hp-btn-new" disabled={selCount.reqs === 0 && selCount.colls === 0} onClick={startRun}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Run selected
        </button>
      </div>

      <div className="ts-main">
        {/* Sidebar */}
        <div className={`ts-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="ts-sb-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ts-sb-title">Test Suites</span>
            <button className="ts-action-btn" style={{ opacity: 0.8 }} onClick={addColl} title="New Collection">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            </button>
          </div>
          <div className="ts-sb-list">
            {collections.map(coll => {
              const reqs = collectionRequests[coll.id] || [];
              const isExp  = expandedColls.has(coll.id);
              const loading = collectionLoading[coll.id];
              const error = collectionErrors[coll.id];
              const allSel = reqs.length > 0 && reqs.every(r => selectedReqs.has(r.id));
              const someSel = reqs.some(r => selectedReqs.has(r.id));
              return (
                <div key={coll.id} className="ts-coll-group">
                  <div className="ts-coll-hdr" onClick={() => toggleExpand(coll.id)}>
                    <input type="checkbox" className="ts-ck" checked={allSel} ref={el => { if (el) el.indeterminate = someSel && !allSel; }} onChange={e => { e.stopPropagation(); toggleColl(coll); }} onClick={e => e.stopPropagation()} />
                    {editingId === coll.id ? (
                      <input ref={renameRef} className="ts-coll-name-edit" value={editingName} onChange={e => setEditingName(e.target.value)} onBlur={() => commitRename(true, coll.id)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(true, coll.id); } if (e.key === 'Escape') setEditingId(null); }} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600, padding: '2px 4px', background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }} />
                    ) : (
                      <span className="ts-coll-name" onDoubleClick={(e) => startRename(e, coll.id, coll.name)}>{coll.name}</span>
                    )}
                    <button className="ts-action-btn" onClick={e => addReq(e, coll.id)} title="Add Request"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg></button>
                    <button className="ts-action-btn ts-delete-btn" onClick={e => deleteColl(e, coll.id)} title="Delete Collection"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h8M4.5 3V2h3v1M4 3v6M8 3v6M3 3l.5 6h5l.5-6" /></svg></button>
                    <span className="ts-coll-cnt">{reqs.length}</span>
                    <span className={`ts-chev ${isExp ? 'open' : ''}`}>▶</span>
                  </div>

                  {isExp && (
                    <div className="ts-req-list">
                      {loading && (
                        <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          Loading requests...
                        </div>
                      )}
                      {error && (
                        <div style={{ padding: '10px', color: 'var(--danger)', fontSize: '0.8rem' }}>
                          {error}
                        </div>
                      )}
                      {!loading && !error && reqs.map(req => {
                        const isMissingExp = missingExpectations.has(req.id);
                        return (
                          <div key={req.id} className={`ts-req-item ${activeReq?.id === req.id ? 'active' : ''}`} onClick={() => setActiveReq(req)}>
                            <span className={`ts-mb ${req.method?.toLowerCase() || 'get'}`}>{req.method || 'GET'}</span>
                            {editingId === req.id ? (
                              <input ref={renameRef} className="ts-req-name-edit" value={editingName} onChange={e => setEditingName(e.target.value)} onBlur={() => commitRename(false, coll.id, req.id)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(false, coll.id, req.id); } if (e.key === 'Escape') setEditingId(null); }} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', padding: '2px 4px', background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }} />
                            ) : (
                              <span className="ts-req-name" onDoubleClick={(e) => startRename(e, req.id, req.name)}>{req.name}</span>
                            )}
                            {isMissingExp && <span style={{color: '#f59e0b', fontSize:'0.75rem', fontWeight:'bold', marginRight:'6px'}} title="Missing saved expectation">⚠️</span>}
                            <button className="ts-action-btn ts-delete-btn" onClick={e => deleteReq(e, coll.id, req.id)} title="Delete Request"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h8M4.5 3V2h3v1M4 3v6M8 3v6M3 3l.5 6h5l.5-6" /></svg></button>
                            <input type="checkbox" className="ts-ck small" checked={selectedReqs.has(req.id)} onChange={e => toggleReq(e, coll, req.id)} onClick={e => e.stopPropagation()} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rail */}
        <div className="ts-rail">
          <button className="ts-rail-btn" onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>{sidebarOpen ? '◀' : '▶'}</button>
        </div>

        {/* Canvas */}
        <div className="ts-canvas">
          {/* Job Overview if running or just finished */}
          {currentJob && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>
                  Job Status: {currentJob.status.toUpperCase()}
                  {currentJob.status === 'processing' && <span className="ts-pulse" style={{marginLeft: '10px', display: 'inline-block'}} />}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  {currentJob.success + currentJob.failed} / {currentJob.total} Completed
                </span>
              </div>
              
              {currentJob.errorMsg && (
                <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '10px' }}>
                  {currentJob.errorMsg}
                </div>
              )}

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--surface)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  background: currentJob.status === 'failed' || currentJob.status === 'aborted' ? 'var(--danger)' : 'var(--success)', 
                  width: currentJob.total > 0 ? `${((currentJob.success + currentJob.failed) / currentJob.total) * 100}%` : '0%',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Job Results Table (Shows when logs are available) */}
              {jobLogs.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Test Results:</h4>
                  <div style={{ borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {jobLogs.map((log, i) => {
                      const matched = log.response?.match_result?.matched;
                      return (
                        <div
                           key={i}
                           onClick={() => {
                              // find the request in collectionRequests to display diff
                              let rTarget;
                              collections.forEach(c => {
                                const reqs = collectionRequests[c.id] || [];
                                const match = reqs.find(r => r.id === log.request_id);
                                if (match) rTarget = match;
                              });
                              if (rTarget) setActiveReq(rTarget);
                           }}
                           style={{ 
                             display: 'flex', padding: '8px 12px', borderBottom: '1px solid var(--border)', 
                             background: 'var(--surface)', fontSize: '0.8rem', cursor: 'pointer',
                             alignItems: 'center', gap: '15px'
                           }}>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: matched ? 'var(--success)' : 'var(--danger)' }} />
                           <div style={{ flex: 1, fontWeight: 'bold' }}>{log.request_id}</div>
                           <div style={{ color: 'var(--text-dim)' }}>{log.response?.data?.status_code}</div>
                           <div style={{ color: 'var(--text-dim)' }}>{log.response?.data?.response_time_ms}ms</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!activeReq ? (
            <div className="ts-empty">
              <div className="ts-empty-icon">◧</div>
              <h3>Select a request</h3>
              <p>Pick any request from the sidebar to inspect its details and set expected output.</p>
            </div>
          ) : (
            <div className="ts-inspector">
              {/* URL bar */}
              <div className="ts-url-bar">
                <span className={`ts-url-method ${activeReq.method?.toLowerCase() || 'get'}`}>{activeReq.method?.toUpperCase() || 'GET'}</span>
                <input id="ts-url-input" name="ts-url-input" className="ts-url-input" value={activeReq.url || ''} onChange={e => updateActiveReqUrl(e.target.value)} placeholder="Paste URL or cURL here..." spellCheck={false} />
                {isDirty && <span className="ts-dirty-pill">Unsaved</span>}
              </div>

              {/* Tabs */}
              <div className="ts-req-tabs">
                {tabDefs.map(t => (
                  <button key={t.id} className={`ts-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                    {t.label}
                    {t.count > 0 && <span className="ts-tab-cnt">{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="ts-tab-body">
                {activeTab === 'headers' && <KVTable rows={headers} onChange={r => {
                  setKvHeaders(p => ({ ...p, [reqId]: r }));
                  saveRequestFields(reqId, activeReq.collection_id, { headers: r });
                }} />}
                {activeTab === 'params' && <KVTable rows={params} onChange={r => {
                  setKvParams(p => ({ ...p, [reqId]: r }));
                  saveRequestFields(reqId, activeReq.collection_id, { params: r });
                }} />}
                {activeTab === 'body' && (
                  <div className="ts-body-editor">
                    <div className="ts-body-head">
                      <span className="ts-body-fmt">JSON</span>
                      <button className="ts-ibtn" onClick={() => navigator.clipboard.writeText(body)}>Copy</button>
                    </div>
                    <textarea id="ts-body-editor" name="ts-body-editor" className="ts-body-ta" value={body} onChange={e => {
                      const v = e.target.value;
                      setKvBody(p => ({ ...p, [reqId]: v }));
                      saveRequestFields(reqId, activeReq.collection_id, { body: v });
                    }} spellCheck={false} />
                  </div>
                )}
                {activeTab === 'auth' && <AuthPanel auth={auth} onChange={a => {
                  setKvAuth(p => ({ ...p, [reqId]: a }));
                  saveRequestFields(reqId, activeReq.collection_id, { auth: a });
                }} />}
              </div>

              {/* Steps (If we have a test log result, mark it done) */}
              <Steps activeReq={activeReq} hasRun={!!activeReqLog} />

              {/* Response panels */}
              <div className="ts-resp-area">
                {/* Expected */}
                <div className="ts-resp-panel accent-exp">
                  <div className="ts-rp-head">
                    <div className="ts-rp-title">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg>
                      Expected output
                    </div>
                    <div className="ts-rp-actions">
                      <button className="ts-ibtn ai" onClick={doSaveExpected}>✦ Save</button>
                    </div>
                  </div>
                  <textarea
                    id="ts-expected-output"
                    name="ts-expected-output"
                    className="ts-rp-ta"
                    value={draftExp}
                    onChange={e => { setDraftExp(e.target.value); setIsDirty(true); }}
                    placeholder={'{\n  "key": "value"\n}'}
                    spellCheck={false}
                  />
                </div>

                {/* Actual Diff View */}
                <div className="ts-resp-panel accent-act">
                  <div className="ts-rp-head">
                    <div className="ts-rp-title">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      Actual response (Last run)
                    </div>
                  </div>
                  {activeActual ? (
                    <div className="ts-rp-ta diff-mode" style={{overflowY: 'auto', padding: 0}}>
                       <div style={{padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <strong>Status:</strong> <span style={{color: activeActual.data?.status_code < 400 ? 'var(--success)' : 'var(--danger)'}}>{activeActual.data?.status_code}</span>
                            {activeActual.match_result != null && (
                              <> | <strong>Match:</strong> {activeActual.match_result?.matched ? '✅ Yes' : '❌ No'}</>
                            )}
                          </div>
                          <span style={{opacity: 0.6, fontSize: '0.7rem'}}>Diff View</span>
                       </div>
                       <GitDiffView 
                         expected={expectedData[activeReq.id]} 
                         actual={activeActual.data?.body} 
                       />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '0.8rem' }}>
                      Run this request in a test suite to view diffs.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestSuite;