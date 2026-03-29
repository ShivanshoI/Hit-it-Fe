import React from 'react';
import './PolicyPage.css';

export default function PrivacyPolicy() {
  return (
    <div className="policy-container">
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
        If you have any questions about this Privacy Policy, please contact us at privacy@hit-it.app.
      </p>
      
      <div style={{ marginTop: '4rem' }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: '0.75rem 1.5rem', background: '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
