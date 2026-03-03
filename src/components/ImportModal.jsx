import { useState, useEffect, useRef, useCallback } from 'react';
import { importCollaborators } from '../api/collaborators.api';
import './ImportModal.css';

export default function ImportModal({ onClose, onSuccess }) {
  const inputRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const [importLinkId, setImportLinkId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);
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

  const handleImport = async () => {
    if (!importLinkId.trim() || importing) return;
    try {
      setImporting(true);
      setImportError('');
      const res = await importCollaborators({ id_string: importLinkId.trim() });
      
      if (res?.status === 'success') {
        handleClose();
        setTimeout(onSuccess, 220);
      } else {
        setImportError(res?.message || 'Failed to import. The backend did not return success.');
      }
    } catch (err) {
      console.error('Import failed', err);
      setImportError(err?.message || 'Failed to import. Please check the ID or link.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={`im-backdrop${closing ? ' im-backdrop--out' : ''}`} onClick={handleClose}>
      <div className={`im-modal${closing ? ' im-modal--out' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* ── Header ── */}
        <div className="im-header">
          <div className="im-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
               <polyline points="7 10 12 15 17 10"></polyline>
               <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div>
            <h2 className="im-title">Import Collaboration</h2>
            <p className="im-subtitle">Paste a shared link or collection ID</p>
          </div>
          <button className="im-close" onClick={handleClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="im-body">
          <div className="im-field">
             <label>Link or ID</label>
             <div className="im-input-wrap">
               <svg className="im-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                 <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
               </svg>
               <input
                 ref={inputRef}
                 className={`im-input${importError ? ' im-input--error' : ''}`}
                 placeholder="https://hitit.dev/share/..."
                 value={importLinkId}
                 onChange={e => {
                   setImportLinkId(e.target.value);
                   if (importError) setImportError('');
                 }}
                 onKeyDown={e => { if (e.key === 'Enter') handleImport(); }}
                 disabled={importing}
               />
             </div>
             {importError && (
               <div className="im-err-msg">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <circle cx="12" cy="12" r="10"></circle>
                   <line x1="12" y1="8" x2="12" y2="12"></line>
                   <line x1="12" y1="16" x2="12.01" y2="16"></line>
                 </svg>
                 {importError}
               </div>
             )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="im-footer">
          <button className="im-btn-cancel" onClick={handleClose} disabled={importing}>Cancel</button>
          <button className={`im-btn-submit${importing ? ' im-btn-submit--loading' : ''}`} onClick={handleImport} disabled={!importLinkId.trim() || importing}>
            {importing ? (
              <>
                <svg className="im-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Importing...
              </>
            ) : (
              'Import'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
