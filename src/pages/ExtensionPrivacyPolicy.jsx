import React from 'react';
import './PolicyPage.css';

export default function ExtensionPrivacyPolicy() {
  return (
    <div className="policy-container">
      <div className="policy-logo" onClick={() => window.location.href = '/'}>
        HIT<span>IT</span>
      </div>
      
      <h1>Hit-It Bridge Privacy Policy</h1>
      <span className="last-updated">Last Updated: March 2026</span>

      <p>
        Hit-It Bridge ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use the Hit-It Bridge browser extension (the "Extension"). By using our service, you agree to the terms outlined below.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        The Extension facilitates communication between the Hit-It web application (<code>hit-it.co.in</code>) and your local application interfaces (<code>localhost</code>). To perform its core functionalities, the Extension collects and processes the following:
      </p>
      <ul>
        <li><strong>Authentication Tokens:</strong> The Extension reads the <code>auth_token</code> stored in your browser's local storage for <code>hit-it.co.in</code> to securely authenticate your identity.</li>
        <li><strong>Request & Response Data:</strong> The Extension processes network request details (URLs, Methods, Headers) initiated from Hit-It, and reads the corresponding responses from your local APIs.</li>
      </ul>

      <h2>2. How We Use and Share Information</h2>
      <p>
        We prioritize data minimization and security. The information collected is used exclusively for establishing the local bridge, routing requests, and returning responses. It is not shared with any third-party services.
      </p>
      <p>
        <strong>No Telemetry or Tracking:</strong> We do not track your browsing habits, inject analytics into your pages, or log the requests you execute on our own remote storage. Data solely transits your connection stream. The extension strictly limits requests to <code>localhost</code> and <code>127.0.0.1</code> targets.
      </p>

      <h2>3. Storage and Retention</h2>
      <p>
        Your JWT <code>auth_token</code> and recent request logs (for the popup interface) are temporarily stored locally in your browser leveraging Chrome's local storage. This data remains on your device entirely and is completely wiped when you manually clear the logs, disconnect, or if your session expires.
      </p>

      <h2>4. Required Permissions</h2>
      <p>
        To deliver this service, the Extension requires the following permissions:
      </p>
      <ul>
        <li><strong><code>storage</code>:</strong> Used locally on your device to cache your active Token and keep a temporary log of recent network hits.</li>
        <li><strong><code>tabs</code> / <code>host_permissions</code>:</strong> Allows the extension to read the access token from the <code>hit-it.co.in</code> tab and communicate explicitly with your designated network environments.</li>
      </ul>

      <h2>5. Contact Us</h2>
      <p>
        If you have any questions or concerns regarding this Privacy Policy or how Hit-It Bridge handles your data, please contact the developer at <a href="mailto:support@hit-it.co.in">support@hit-it.co.in</a>.
      </p>
      
      <div style={{ marginTop: '4rem' }}>
        <button onClick={() => window.location.href = '/'} style={{ padding: '0.75rem 1.5rem', background: '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
