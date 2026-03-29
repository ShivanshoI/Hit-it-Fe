import React, { useState } from 'react';
import './PolicyPage.css';
import ContactUsModal from '../components/ContactUsModal';

export default function PrivacyPolicy() {
  const [showContact, setShowContact] = useState(false);
  return (
    <div className="policy-container">
      {showContact && <ContactUsModal onClose={() => setShowContact(false)} source="privacy" />}
      <div className="policy-logo" onClick={() => window.location.href = '/'}>
        HIT<span>IT</span>
      </div>
      
      <h1>Hit-It Privacy Policy</h1>
      <span className="last-updated">Last Updated: March 2026</span>

      <p>
        Welcome to Hit-It. Your privacy is critically important to us. This Privacy Policy outlines how we collect, use, and protect your data when you use our API testing and development suite.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        <strong>Account Information:</strong> When you register an account, we collect your name, email address, and authentication credentials (including OAuth tokens from Google).
      </p>
      <p>
        <strong>API Data and Testing:</strong> Hit-It processes the API requests you construct (including endpoints, headers, and request bodies). Depending on your workspace configuration, this data may be synced to our servers to provide cross-device access and team collaboration.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Hit-It application and features.</li>
        <li>To authenticate your identity and keep your session secure.</li>
        <li>To synchronize your API collections and test suites across devices.</li>
        <li>To communicate with you regarding service updates, security alerts, and support messages.</li>
      </ul>

      <h2>3. Data Sharing and Disclosure</h2>
      <p>
        We do not sell your personal information or your API request payloads. We may share information only in the following circumstances:
      </p>
      <ul>
        <li><strong>Service Providers:</strong> We use trusted third-party providers (like database and cloud hosting services) necessary to run our infrastructure.</li>
        <li><strong>Legal Compliance:</strong> If required by law, subpoena, or other legal processes.</li>
      </ul>

      <h2>4. Security</h2>
      <p>
        We implement industry standard physical, technical, and administrative security measures to safeguard your data. However, transmitting data over the internet is never 100% secure, and we cannot guarantee absolute security. We encourage users not to store sensitive production credentials or API keys in unsecured collections.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You have securely access, update, and delete your personal information and uploaded collections directly from your account settings. If you wish to permanently delete your account, please contact support.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        If you have any questions or feedback regarding our privacy practices, please get in touch with our team:
      </p>
      
      <button 
        onClick={() => setShowContact(true)} 
        style={{ 
          marginTop: '1.25rem', padding: '0.85rem 1.75rem', 
          background: 'var(--purple, #7c3aed)', color: '#fff', 
          border: 'none', borderRadius: '10px', 
          cursor: 'pointer', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          boxShadow: '0 8px 16px -4px rgba(124, 58, 237, 0.25)'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
        </svg>
        Contact Support Team
      </button>
      
      <div style={{ marginTop: '4rem' }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: '0.75rem 1.5rem', background: '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
