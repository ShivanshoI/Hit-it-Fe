import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './NotificationContext.css';

const NotificationContext = createContext(null);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, onCancel, resolve }
  const [alert, setAlert] = useState(null); // { title, message, resolve }

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showAlert = useCallback((message, title = 'Alert') => {
    return new Promise((resolve) => {
      setAlert({ title, message, resolve });
    });
  }, []);

  const showConfirm = useCallback((message, title = 'Confirm') => {
    return new Promise((resolve) => {
      setConfirm({ title, message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (confirm) {
      confirm.resolve(true);
      setConfirm(null);
    }
  };

  const handleCancelConfirm = () => {
    if (confirm) {
      confirm.resolve(false);
      setConfirm(null);
    }
  };

  const handleCloseAlert = () => {
    if (alert) {
      alert.resolve();
      setAlert(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}
      
      {/* Portals or absolute elements for notifications */}
      <div className="nt-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`nt-toast nt-toast--${t.type}`}>
            <span className="nt-toast-icon">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="nt-toast-message">{t.message}</span>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="nt-modal-overlay" onClick={handleCancelConfirm}>
          <div className="nt-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="nt-modal-header">
              <h3>{confirm.title}</h3>
            </div>
            <div className="nt-modal-body">
              <p>{confirm.message}</p>
            </div>
            <div className="nt-modal-footer">
              <button className="nt-btn nt-btn--cancel" onClick={handleCancelConfirm}>Cancel</button>
              <button className="nt-btn nt-btn--confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {alert && (
        <div className="nt-modal-overlay" onClick={handleCloseAlert}>
          <div className="nt-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="nt-modal-header">
              <h3>{alert.title}</h3>
            </div>
            <div className="nt-modal-body">
              <p>{alert.message}</p>
            </div>
            <div className="nt-modal-footer">
              <button className="nt-btn nt-btn--confirm" onClick={handleCloseAlert}>OK</button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
