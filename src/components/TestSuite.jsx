import React from 'react';
import './TestSuite.css';

const TestSuite = () => {
  return (
    <div className="ts-container">
      <div className="ts-content">
        <div className="ts-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 className="ts-title">Test Suite</h1>
        <p className="ts-description">
          A powerful testing environment to verify your endpoints at once. 
          Compare actual outcomes against "Correct Data" and visualize differences instantly.
        </p>
        
        <div className="ts-placeholder-card">
          <div className="ts-badge">Under Construction</div>
          <h3>Future Capabilities</h3>
          <ul className="ts-feature-list">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Bulk Endpoint Execution
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              "Correct Data" (Expected Response) Management
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Visual Diff Analysis
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Automated Regression Testing
            </li>
          </ul>
          <p className="ts-footer-note">Starting discussion and documentation phase...</p>
        </div>
      </div>
    </div>
  );
};

export default TestSuite;
