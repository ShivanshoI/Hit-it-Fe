import React, { useEffect, useState } from 'react';
import './PreAlphaModal.css';

const PreAlphaModal = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure smooth entrance
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  return (
    <div className={`prealpha-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
      <div className={`prealpha-modal ${isVisible ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="prealpha-header">
          <div className="prealpha-badge">Pre-Alpha</div>
          <button className="prealpha-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="prealpha-content">
          <div className="prealpha-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          
          <h1>Welcome to HIT-IT!</h1>
          <p className="prealpha-text">
            We're thrilled to have you here. Please note that HIT-IT is currently in <strong>Pre-Alpha testing</strong>. 
            You might encounter a few bugs or rough edges as we continue to build the ultimate developer platform.
          </p>
          
          <div className="prealpha-gift">
            <div className="gift-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
            </div>
            <div className="gift-text">
              <h3>Pro Plan Activated!</h3>
              <p>As a thank you for joining our early testing phase, we've granted you a <strong>Pro Plan</strong> for free during this period. Enjoy all premium features!</p>
            </div>
          </div>
        </div>
        
        <div className="prealpha-footer">
          <button className="prealpha-btn" onClick={handleClose}>
            Let's HIT IT!
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreAlphaModal;
