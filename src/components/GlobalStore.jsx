import { useState, useRef, useEffect } from 'react';
import './GlobalStore.css';

// ─── Initial Data ─────────────────────────────────────────────────────────────
const INITIAL_ENVS = [
  { id: 'dev',     label: 'Development', color: '#10b981' },
  { id: 'staging', label: 'Staging',     color: '#f59e0b' },
  { id: 'prod',    label: 'Production',  color: '#ef4444' },
];

const INITIAL_CATEGORIES = [
  { id: 'auth',    label: 'Auth',       color: '#7c3aed' },
  { id: 'api',     label: 'API',        color: '#0ea5e9' },
  { id: 'infra',   label: 'Infra',      color: '#10b981' },
  { id: 'secrets', label: 'Secrets',    color: '#ef4444' },
];

const INITIAL_VARS = [
  {
    id: 1, key: 'auth_token', category: 'auth', secret: true, description: 'JWT bearer for all requests', tags: ['auth', 'jwt'],
    values: { dev: 'eyJhbGciOiJIUzI1NiJ9.dev_token', staging: 'eyJhbGciOiJIUzI1NiJ9.staging_token', prod: 'eyJhbGciOiJIUzI1NiJ9.prod_token' },
  },
  {
    id: 2, key: 'base_url', category: 'api', secret: false, description: 'Root API endpoint', tags: ['url'],
    values: { dev: 'https://dev.api.hitit.io', staging: 'https://staging.api.hitit.io', prod: 'https://api.hitit.io' },
  },
  {
    id: 3, key: 'client_secret', category: 'secrets', secret: true, description: 'OAuth2 client secret', tags: ['auth', 'oauth'],
    values: { dev: 'sk_dev_abc123xyz', staging: 'sk_stg_def456uvw', prod: 'sk_live_ghi789rst' },
  },
  {
    id: 4, key: 'timeout_ms', category: 'infra', secret: false, description: 'Request timeout in milliseconds', tags: ['config'],
    values: { dev: '5000', staging: '3000', prod: '2000' },
  },
  {
    id: 5, key: 'rate_limit', category: 'infra', secret: false, description: 'Max requests per minute', tags: ['config', 'limits'],
    values: { dev: '1000', staging: '500', prod: '100' },
  },
  {
    id: 6, key: 'stripe_key', category: 'secrets', secret: true, description: 'Stripe publishable API key', tags: ['payments'],
    values: { dev: 'pk_test_abc123', staging: 'pk_test_def456', prod: 'pk_live_ghi789' },
  },
];

const COLLECTION_OVERRIDES = {
  'Auth Service': {
    auth_token: { dev: 'eyJhbGciOiJIUzI1NiJ9.auth_service_override', staging: '', prod: '' },
  },
  'Payment Gateway': {
    stripe_key: { dev: 'pk_test_payment_specific', staging: '', prod: '' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function maskSecret(val) {
  if (!val) return '';
  return val.slice(0, 4) + '•'.repeat(Math.min(val.length - 4, 16));
}

function EnvDot({ color, size = 8 }) {
  return <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:color, flexShrink:0 }} />;
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────
function Tag({ label, onRemove }) {
  return (
    <span className="gs-tag">
      {label}
      {onRemove && <button className="gs-tag-x" onClick={onRemove}>×</button>}
    </span>
  );
}

// ─── Variable row ─────────────────────────────────────────────────────────────
function VarRow({ variable, envs, categories, activeEnv, collectionName, onUpdate, onDelete, revealed, onToggleReveal }) {
  const [expanded, setExpanded] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const cat = categories.find(c => c.id === variable.category);
  const override = collectionName && COLLECTION_OVERRIDES[collectionName]?.[variable.key];
  const effectiveVal = (override?.[activeEnv] || variable.values[activeEnv] || '');
  const isOverridden = override && !!override[activeEnv];

  const updateValue = (env, val) => onUpdate({ ...variable, values: { ...variable.values, [env]: val } });
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g,'-');
    if (t && !variable.tags.includes(t)) onUpdate({ ...variable, tags: [...variable.tags, t] });
    setTagDraft('');
  };
  const removeTag = (t) => onUpdate({ ...variable, tags: variable.tags.filter(x => x !== t) });

  return (
    <div className={`gs-var-row ${expanded ? 'gs-var-row--expanded' : ''}`}>
      {/* Summary line */}
      <div className="gs-var-summary" onClick={() => setExpanded(!expanded)}>
        <div className="gs-var-left">
          <span className="gs-chevron">{expanded ? '▾' : '▸'}</span>
          {cat && <EnvDot color={cat.color} size={7} />}
          <span className="gs-var-key">{'{{' + variable.key + '}}'}</span>
          {variable.secret && <span className="gs-secret-badge">secret</span>}
          {isOverridden && <span className="gs-override-badge" title={`Overridden for ${collectionName}`}>override</span>}
        </div>
        <div className="gs-var-right">
          <span className="gs-var-preview">
            {variable.secret && !revealed
              ? maskSecret(effectiveVal)
              : (effectiveVal || <em className="gs-no-val">— not set —</em>)
            }
          </span>
          {variable.secret && (
            <button className="gs-reveal-btn" onClick={e => { e.stopPropagation(); onToggleReveal(); }} title={revealed ? 'Hide' : 'Reveal'}>
              {revealed
                ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z"/><circle cx="6" cy="6" r="1.5"/><path d="M1 1l10 10"/></svg>
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z"/><circle cx="6" cy="6" r="1.5"/></svg>
              }
            </button>
          )}
          <button className="gs-var-del" onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l9 9M10 1L1 10"/></svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="gs-var-detail">
          {/* Description */}
          <div className="gs-detail-row">
            <span className="gs-detail-label">Description</span>
            <input
              className="gs-detail-input"
              value={variable.description}
              onChange={e => onUpdate({ ...variable, description: e.target.value })}
              placeholder="What does this variable do?"
            />
          </div>

          {/* Category */}
          <div className="gs-detail-row">
            <span className="gs-detail-label">Category</span>
            <div className="gs-cat-pills">
              {categories.map(c => (
                <button
                  key={c.id}
                  className={`gs-cat-pill ${variable.category === c.id ? 'active' : ''}`}
                  style={{ '--cat-color': c.color }}
                  onClick={() => onUpdate({ ...variable, category: c.id })}
                >
                  <EnvDot color={c.color} size={6} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secret toggle */}
          <div className="gs-detail-row">
            <span className="gs-detail-label">Secret</span>
            <button
              className={`gs-toggle ${variable.secret ? 'on' : ''}`}
              onClick={() => onUpdate({ ...variable, secret: !variable.secret })}
            >
              <span className="gs-toggle-knob" />
            </button>
            <span className="gs-toggle-hint">{variable.secret ? 'Value masked in UI' : 'Value visible in UI'}</span>
          </div>

          {/* Tags */}
          <div className="gs-detail-row gs-detail-row--wrap">
            <span className="gs-detail-label">Tags</span>
            <div className="gs-tags-row">
              {variable.tags.map(t => <Tag key={t} label={t} onRemove={() => removeTag(t)} />)}
              <input
                className="gs-tag-input"
                placeholder="+ add tag"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
              />
            </div>
          </div>

          {/* Per-environment values */}
          <div className="gs-env-grid-label">Values per environment</div>
          <div className="gs-env-grid">
            {envs.map(env => {
              const ovVal = COLLECTION_OVERRIDES[collectionName]?.[variable.key]?.[env.id];
              return (
                <div key={env.id} className={`gs-env-cell ${activeEnv === env.id ? 'active' : ''}`}>
                  <div className="gs-env-cell-head">
                    <EnvDot color={env.color} />
                    <span className="gs-env-cell-label">{env.label}</span>
                    {ovVal && <span className="gs-env-overridden-badge" title="Collection override active">↩ override</span>}
                  </div>
                  <div className="gs-env-cell-input-wrap">
                    <input
                      className={`gs-env-input ${variable.secret && !revealed ? 'masked' : ''}`}
                      type={variable.secret && !revealed ? 'password' : 'text'}
                      value={variable.values[env.id] || ''}
                      onChange={e => updateValue(env.id, e.target.value)}
                      placeholder="— not set —"
                    />
                    {ovVal && (
                      <div className="gs-env-override-val">
                        <span className="gs-override-badge">override</span>
                        <span className="gs-override-val-text">{variable.secret && !revealed ? maskSecret(ovVal) : ovVal}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Variable Form ────────────────────────────────────────────────────────
function AddVarForm({ envs, categories, onAdd, onClose }) {
  const [form, setForm] = useState({
    key: '', description: '', category: categories[0]?.id || '', secret: false, tags: [],
    values: Object.fromEntries(envs.map(e => [e.id, ''])),
  });
  const [tagDraft, setTagDraft] = useState('');

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g,'-');
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagDraft('');
  };

  const submit = () => {
    if (!form.key.trim()) return;
    onAdd({ ...form, id: Date.now(), key: form.key.trim().replace(/\s+/g,'_') });
    onClose();
  };

  return (
    <div className="gs-add-form">
      <div className="gs-add-form-head">
        <span>New Variable</span>
        <button className="gs-icon-btn" onClick={onClose}>×</button>
      </div>

      <div className="gs-add-grid">
        <div className="gs-add-field">
          <label>Key <span className="gs-req">*</span></label>
          <input className="gs-add-input gs-mono" placeholder="variable_name" value={form.key}
            onChange={e => setForm(f => ({ ...f, key: e.target.value.replace(/\s+/g,'_') }))} autoFocus />
        </div>
        <div className="gs-add-field">
          <label>Description</label>
          <input className="gs-add-input" placeholder="What does this do?" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>

      <div className="gs-add-field">
        <label>Category</label>
        <div className="gs-cat-pills">
          {categories.map(c => (
            <button key={c.id} className={`gs-cat-pill ${form.category===c.id?'active':''}`}
              style={{ '--cat-color': c.color }} onClick={() => setForm(f => ({ ...f, category: c.id }))}>
              <EnvDot color={c.color} size={6} />{c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gs-add-field gs-add-row">
        <label>Secret</label>
        <button className={`gs-toggle ${form.secret?'on':''}`} onClick={() => setForm(f => ({ ...f, secret: !f.secret }))}>
          <span className="gs-toggle-knob" />
        </button>
        <span className="gs-toggle-hint" style={{fontSize:'0.7rem',color:'var(--text-dim)'}}>
          {form.secret ? 'Masked in UI' : 'Visible in UI'}
        </span>
      </div>

      <div className="gs-add-field">
        <label>Tags</label>
        <div className="gs-tags-row">
          {form.tags.map(t => <Tag key={t} label={t} onRemove={() => setForm(f=>({...f,tags:f.tags.filter(x=>x!==t)}))} />)}
          <input className="gs-tag-input" placeholder="+ tag" value={tagDraft} onChange={e=>setTagDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTag();}}} onBlur={addTag}/>
        </div>
      </div>

      <div className="gs-env-grid-label">Values per environment</div>
      <div className="gs-env-grid">
        {envs.map(env => (
          <div key={env.id} className="gs-env-cell">
            <div className="gs-env-cell-head"><EnvDot color={env.color}/><span className="gs-env-cell-label">{env.label}</span></div>
            <input className={`gs-env-input ${form.secret?'masked':''}`} type={form.secret?'password':'text'}
              placeholder="— not set —" value={form.values[env.id]||''}
              onChange={e => setForm(f => ({ ...f, values: { ...f.values, [env.id]: e.target.value } }))} />
          </div>
        ))}
      </div>

      <div className="gs-add-actions">
        <button className="gs-add-cancel" onClick={onClose}>Cancel</button>
        <button className="gs-add-submit" onClick={submit} disabled={!form.key.trim()}>Add Variable</button>
      </div>
    </div>
  );
}

// ─── Main GlobalStore Panel ───────────────────────────────────────────────────
export default function GlobalStore({ collectionName, onClose }) {
  const [vars, setVars]               = useState(INITIAL_VARS);
  const [envs]                        = useState(INITIAL_ENVS);
  const [categories, setCategories]   = useState(INITIAL_CATEGORIES);
  const [activeEnv, setActiveEnv]     = useState('dev');
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('all');
  const [filterTag, setFilterTag]     = useState('');
  const [revealed, setRevealed]       = useState({});
  const [showAdd, setShowAdd]         = useState(false);
  const [newCatDraft, setNewCatDraft] = useState('');
  const [showCatEdit, setShowCatEdit] = useState(false);
  const panelRef = useRef(null);

  // Drag to resize
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);
  useEffect(() => {
    const onMove = e => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const newW  = Math.min(780, Math.max(380, startW.current + delta));
      if (panelRef.current) panelRef.current.style.width = newW + 'px';
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const allTags = [...new Set(vars.flatMap(v => v.tags))];

  const filtered = vars.filter(v => {
    const matchSearch = !search || v.key.includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === 'all' || v.category === filterCat;
    const matchTag    = !filterTag || v.tags.includes(filterTag);
    return matchSearch && matchCat && matchTag;
  });

  const grouped = categories.reduce((acc, cat) => {
    const items = filtered.filter(v => v.category === cat.id);
    if (items.length) acc.push({ cat, items });
    return acc;
  }, []);
  const uncategorized = filtered.filter(v => !categories.find(c => c.id === v.category));
  if (uncategorized.length) grouped.push({ cat: { id:'_', label:'Uncategorized', color:'#8b80a8' }, items: uncategorized });

  const updateVar = (id, updated) => setVars(p => p.map(v => v.id===id ? updated : v));
  const deleteVar = (id)          => setVars(p => p.filter(v => v.id!==id));
  const addVar    = (v)           => setVars(p => [...p, v]);
  const toggleReveal = (id)       => setRevealed(r => ({ ...r, [id]: !r[id] }));

  const addCategory = () => {
    const label = newCatDraft.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g,'-');
    const colors = ['#6366f1','#ec4899','#14b8a6','#f97316','#84cc16'];
    setCategories(c => [...c, { id, label, color: colors[c.length % colors.length] }]);
    setNewCatDraft('');
  };

  const activeEnvData = envs.find(e => e.id === activeEnv);

  return (
    <div className="gs-overlay" onClick={onClose}>
      <div
        className="gs-panel"
        ref={panelRef}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="gs-drag-handle" onMouseDown={e => { dragging.current=true; startX.current=e.clientX; startW.current=panelRef.current?.offsetWidth||520; }} />

        {/* Header */}
        <div className="gs-header">
          <div className="gs-header-left">
            <div className="gs-header-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5"/><path d="M8 1.5a10 10 0 010 13M1.5 8h13"/>
              </svg>
            </div>
            <div>
              <h2 className="gs-title">Global Variables</h2>
              {collectionName && (
                <p className="gs-subtitle">Viewing overrides for <strong>{collectionName}</strong></p>
              )}
            </div>
          </div>
          <div className="gs-header-right">
            <button className="gs-add-btn" onClick={() => setShowAdd(true)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1v10M1 6h10"/></svg>
              New Variable
            </button>
            <button className="gs-close-btn" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
            </button>
          </div>
        </div>

        {/* Env switcher */}
        <div className="gs-env-bar">
          <span className="gs-env-bar-label">Active environment</span>
          <div className="gs-env-tabs">
            {envs.map(env => (
              <button key={env.id} className={`gs-env-tab ${activeEnv===env.id?'active':''}`}
                style={{ '--env-color': env.color }} onClick={() => setActiveEnv(env.id)}>
                <EnvDot color={env.color} />
                {env.label}
              </button>
            ))}
          </div>
          <span className="gs-var-count">{vars.length} vars · {filtered.length} shown</span>
        </div>

        {/* Toolbar */}
        <div className="gs-toolbar">
          <div className="gs-search-wrap">
            <svg className="gs-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="5.5" cy="5.5" r="4"/><path d="M9 9l3 3"/>
            </svg>
            <input className="gs-search" placeholder="Search variables…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button className="gs-search-clear" onClick={()=>setSearch('')}>×</button>}
          </div>

          <div className="gs-filter-row">
            <button className={`gs-filter-cat ${filterCat==='all'?'active':''}`} onClick={()=>setFilterCat('all')}>All</button>
            {categories.map(c => (
              <button key={c.id} className={`gs-filter-cat ${filterCat===c.id?'active':''}`}
                style={{ '--cat-color': c.color }} onClick={()=>setFilterCat(filterCat===c.id?'all':c.id)}>
                <EnvDot color={c.color} size={6}/>{c.label}
              </button>
            ))}
            <button className="gs-cat-manage-btn" onClick={()=>setShowCatEdit(!showCatEdit)} title="Manage categories">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="6" r="1.5"/><path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11"/>
              </svg>
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="gs-tag-filter-row">
              <span className="gs-tag-filter-label">Tags:</span>
              {allTags.map(t => (
                <button key={t} className={`gs-tag-filter ${filterTag===t?'active':''}`}
                  onClick={()=>setFilterTag(filterTag===t?'':t)}>{t}</button>
              ))}
            </div>
          )}

          {showCatEdit && (
            <div className="gs-cat-editor">
              <span className="gs-cat-editor-title">Manage Categories</span>
              <div className="gs-cat-editor-list">
                {categories.map(c => (
                  <div key={c.id} className="gs-cat-editor-row">
                    <EnvDot color={c.color}/>
                    <span className="gs-cat-editor-label">{c.label}</span>
                    <button className="gs-cat-del" onClick={()=>setCategories(cats=>cats.filter(x=>x.id!==c.id))}>×</button>
                  </div>
                ))}
              </div>
              <div className="gs-cat-add-row">
                <input className="gs-cat-input" placeholder="New category name" value={newCatDraft}
                  onChange={e=>setNewCatDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')addCategory();}}/>
                <button className="gs-cat-add-submit" onClick={addCategory}>Add</button>
              </div>
            </div>
          )}
        </div>

        {/* Add variable form */}
        {showAdd && (
          <div className="gs-add-wrap">
            <AddVarForm envs={envs} categories={categories} onAdd={addVar} onClose={()=>setShowAdd(false)}/>
          </div>
        )}

        {/* Variable list */}
        <div className="gs-list">
          {grouped.length === 0 && (
            <div className="gs-empty">
              <div className="gs-empty-icon">◎</div>
              <p>No variables match your filters</p>
              <button className="gs-empty-reset" onClick={()=>{ setSearch(''); setFilterCat('all'); setFilterTag(''); }}>Clear filters</button>
            </div>
          )}
          {grouped.map(({ cat, items }) => (
            <div key={cat.id} className="gs-group">
              <div className="gs-group-label">
                <EnvDot color={cat.color}/>
                <span>{cat.label}</span>
                <span className="gs-group-count">{items.length}</span>
              </div>
              {items.map(v => (
                <VarRow
                  key={v.id}
                  variable={v}
                  envs={envs}
                  categories={categories}
                  activeEnv={activeEnv}
                  collectionName={collectionName}
                  onUpdate={updated => updateVar(v.id, updated)}
                  onDelete={() => deleteVar(v.id)}
                  revealed={!!revealed[v.id]}
                  onToggleReveal={() => toggleReveal(v.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="gs-footer">
          <div className="gs-footer-env">
            <EnvDot color={activeEnvData?.color || '#888'}/>
            <span>Active: <strong>{activeEnvData?.label}</strong></span>
          </div>
          <span className="gs-footer-hint">
            Use <code>{'{{key}}'}</code> in any request field to inject the active environment value
          </span>
        </div>
      </div>
    </div>
  );
}
