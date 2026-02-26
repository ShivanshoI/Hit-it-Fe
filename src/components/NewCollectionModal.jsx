import { useState, useEffect, useRef, useCallback } from 'react';
import './NewCollectionModal.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = [
  { hex: '#7c3aed', label: 'Purple' },
  { hex: '#0ea5e9', label: 'Blue'   },
  { hex: '#10b981', label: 'Green'  },
  { hex: '#f59e0b', label: 'Amber'  },
  { hex: '#ec4899', label: 'Pink'   },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#ef4444', label: 'Red'    },
  { hex: '#14b8a6', label: 'Teal'   },
];

const PATTERNS = ['waves', 'grid', 'dots', 'lines', 'cross'];

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'WS'];

const METHOD_STYLE = {
  GET:    { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  POST:   { bg: 'rgba(124,58,237,0.15)', text: '#7c3aed' },
  PUT:    { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444' },
  WS:     { bg: 'rgba(14,165,233,0.15)', text: '#0ea5e9' },
};

// ─── Inline SVG pattern for card preview ────────────────────────────────────
function PatternSVG({ color, pattern, width = '100%', height = '100%', small = false }) {
  const op = small ? 0.35 : 0.2;
  const W = small ? 44 : 240;
  const H = small ? 28 : 90;

  return (
    <svg width={width} height={height} xmlns="http://www.w3.org/2000/svg"
      style={{ position: small ? 'static' : 'absolute', inset: 0, width, height }}
      viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
    >
      <rect width={W} height={H} fill={color} opacity={0.07} />
      {pattern === 'waves' && (
        <g stroke={color} strokeWidth={small ? 1 : 1.5} fill="none" opacity={op}>
          {(small ? [4,12,20] : [0,18,36,54,72]).map(y => (
            <path key={y} d={`M0 ${y} Q${W/4} ${y-10} ${W/2} ${y} Q${W*3/4} ${y+10} ${W} ${y}`} />
          ))}
        </g>
      )}
      {pattern === 'grid' && (
        <g stroke={color} strokeWidth={small ? 0.8 : 1} opacity={op}>
          {(small ? [11,22,33] : [0,30,60,90,120,150,180,210,240]).map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2={H} />)}
          {(small ? [7,14,21] : [0,18,36,54,72,90]).map(y => <line key={`h${y}`} x1="0" y1={y} x2={W} y2={y} />)}
        </g>
      )}
      {pattern === 'dots' && (
        <g fill={color} opacity={op}>
          {(small ? [8,22,36] : [16,48,80,112,144,176,208]).flatMap(x =>
            (small ? [7,14,21] : [14,42,70]).map(y =>
              <circle key={`${x}${y}`} cx={x} cy={y} r={small ? 2.5 : 3} />
            )
          )}
        </g>
      )}
      {pattern === 'lines' && (
        <g stroke={color} strokeWidth={small ? 1.2 : 1.5} opacity={op}>
          {(small ? [0,10,20,30,40] : [0,16,32,48,64,80,96,112]).map(i => (
            <line key={i} x1={i * (small ? 1 : 2)} y1="0" x2="0" y2={i * (small ? 1 : 2)} />
          ))}
        </g>
      )}
      {pattern === 'cross' && (
        <g stroke={color} strokeWidth={small ? 1.2 : 1.5} opacity={op}>
          {(small ? [11,33] : [24,72,120,168]).flatMap(x =>
            (small ? [9,19] : [18,54,90]).map(y => (
              <g key={`${x}${y}`}>
                <line x1={x - (small?5:6)} y1={y} x2={x + (small?5:6)} y2={y} />
                <line x1={x} y1={y - (small?5:6)} x2={x} y2={y + (small?5:6)} />
              </g>
            ))
          )}
        </g>
      )}
      {!small && <circle cx={W * 0.9} cy={H * 0.85} r="24" fill={color} opacity={0.1} />}
    </svg>
  );
}

// ─── Live card preview ────────────────────────────────────────────────────────
function CardPreview({ name, color, pattern, method, tags }) {
  const m = METHOD_STYLE[method] || METHOD_STYLE.GET;
  const displayName = name.trim() || 'Untitled Collection';
  return (
    <div className="nc-preview-card" style={{ borderBottom: `2px solid ${color}33` }}>
      <div className="nc-preview-thumb">
        <PatternSVG color={color} pattern={pattern} />
        <span className="nc-preview-method" style={{ background: m.bg, color: m.text }}>{method}</span>
      </div>
      <div className="nc-preview-body">
        <div className="nc-preview-name">{displayName}</div>
        <div className="nc-preview-tags">
          {tags.length > 0
            ? tags.map((t, i) => <span key={i} className="nc-preview-tag">{t}</span>)
            : <span className="nc-preview-tag-empty">No tags yet</span>
          }
        </div>
        <div className="nc-preview-meta">
          <span>Today</span>
          <span>0 requests</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewCollectionModal({ existing = null, onClose, onSave }) {
  const isEdit    = !!existing;
  const nameRef   = useRef(null);
  const [closing, setClosing]       = useState(false);
  const [expanded, setExpanded]     = useState(isEdit); // show more opts if editing
  const [name,    setName]          = useState(existing?.name    || '');
  const [color,   setColor]         = useState(existing?.color   || '#7c3aed');
  const [pattern, setPattern]       = useState(existing?.pattern || 'waves');
  const [method,  setMethod]        = useState(existing?.method  || 'GET');
  const [tags,    setTags]          = useState(existing?.tags    || []);
  const [tagDraft, setTagDraft]     = useState('');
  const [nameErr, setNameErr]       = useState('');

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 60); }, []);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { e.stopPropagation(); handleClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [handleClose]);

  const addTag = () => {
    const t = tagDraft.trim().replace(/,+$/, '');
    if (t && !tags.includes(t)) setTags(p => [...p, t]);
    setTagDraft('');
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameErr('Name is required');
      nameRef.current?.focus();
      return;
    }
    setNameErr('');
    onSave({
      id:       existing?.id || Date.now(),
      name:     name.trim(),
      color,
      pattern,
      method,
      tags,
      requests: existing?.requests || [],
      modified: new Date().toISOString().split('T')[0],
    }, isEdit);
    handleClose();
  };

  return (
    <div className={`nc-backdrop${closing ? ' nc-backdrop--out' : ''}`} onClick={handleClose}>
      <div className={`nc-modal${expanded ? ' nc-modal--expanded' : ''}${closing ? ' nc-modal--out' : ''}`}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="nc-header">
          <div className="nc-header-icon" style={{ background: `${color}20`, color }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M1 4h13v9a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM1 4l2-3h4l2 3"/>
            </svg>
          </div>
          <div>
            <h2 className="nc-title">{isEdit ? 'Customize Collection' : 'New Collection'}</h2>
            <p className="nc-subtitle">{isEdit ? 'Edit name, color, pattern and tags' : 'Name it and jump straight in'}</p>
          </div>
          <button className="nc-close" onClick={handleClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>

        {/* ── Name row ── */}
        <div className="nc-name-row">
          <div className="nc-name-field">
            <input
              ref={nameRef}
              className={`nc-name-input${nameErr ? ' nc-name-input--err' : ''}`}
              placeholder="Collection name…"
              value={name}
              onChange={e => { setName(e.target.value); if (nameErr) setNameErr(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
            {nameErr && <span className="nc-err">{nameErr}</span>}
          </div>
          {/* CTA */}
          <button className="nc-submit" onClick={handleSubmit} style={{ background: color }}>
            {isEdit ? 'Save' : 'Create & Open'}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 5.5h9M5.5 2l4.5 3.5L5.5 9"/>
            </svg>
          </button>
        </div>

        {/* ── Optional expand toggle ── */}
        <button className={`nc-expand-toggle${expanded ? ' nc-expand-toggle--open' : ''}`}
          onClick={() => setExpanded(v => !v)}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d={expanded ? 'M1 6l3.5-3.5L8 6' : 'M1 3l3.5 3.5L8 3'}/>
          </svg>
          {expanded ? 'Fewer options' : 'More options — color, pattern, tags'}
        </button>

        {/* ── Expanded customization + preview ── */}
        {expanded && (
          <div className="nc-expanded">
            <div className="nc-form">

              {/* Tags */}
              <div className="nc-field">
                <label>Tags <span className="nc-opt">optional</span></label>
                <div className="nc-tags-wrap">
                  {tags.map((t, i) => (
                    <span key={i} className="nc-tag">
                      {t}
                      <button className="nc-tag-x" onClick={() => setTags(tags.filter((_, j) => j !== i))}>×</button>
                    </span>
                  ))}
                  <input
                    className="nc-tag-input"
                    placeholder="REST, OAuth… Enter"
                    value={tagDraft}
                    onChange={e => setTagDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                      if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(tags.slice(0, -1));
                    }}
                    onBlur={addTag}
                  />
                </div>
              </div>

              {/* Method */}
              <div className="nc-field">
                <label>Default Method</label>
                <div className="nc-method-row">
                  {METHODS.map(m => {
                    const s = METHOD_STYLE[m];
                    return (
                      <button key={m}
                        className={`nc-method-btn${method === m ? ' active' : ''}`}
                        style={method === m ? { background: s.bg, color: s.text, borderColor: s.text } : {}}
                        onClick={() => setMethod(m)}
                      >{m}</button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div className="nc-field">
                <label>Accent Color</label>
                <div className="nc-color-row">
                  {COLORS.map(c => (
                    <button key={c.hex} className={`nc-color-swatch${color === c.hex ? ' active' : ''}`}
                      style={{ background: c.hex }} onClick={() => setColor(c.hex)} title={c.label}>
                      {color === c.hex && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M1.5 5l2.5 2.5 5-5"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pattern */}
              <div className="nc-field">
                <label>Card Pattern</label>
                <div className="nc-pattern-row">
                  {PATTERNS.map(p => (
                    <button key={p} className={`nc-pattern-btn${pattern === p ? ' active' : ''}`}
                      style={pattern === p ? { borderColor: color } : {}}
                      onClick={() => setPattern(p)}>
                      <svg width="44" height="28" viewBox="0 0 44 28">
                        <rect width="44" height="28" rx="3" fill={color} opacity="0.07"/>
                        <PatternSVG color={color} pattern={p} width="44" height="28" small />
                      </svg>
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="nc-preview-pane">
              <div className="nc-preview-label">Preview</div>
              <CardPreview name={name} color={color} pattern={pattern} method={method} tags={tags} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
