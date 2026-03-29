import React, { useState } from 'react';
import './ContactUsModal.css';
import { sendFeedback } from '../api/feedback.api';

/**
 * A modal to handle the "Contact Us" feedback submission.
 */
export default function ContactUsModal({ onClose, source = 'website' }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    company: '',
    subject: '',
    message: '',
    category: 'general'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      type: 'contact_us',
      contact_us_data: {
        ...formData,
        source: source
      }
    };

    try {
      await sendFeedback(payload);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Something went wrong while sending your message.');
    } finally {
      setLoading(false);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="contact-modal-overlay" onClick={handleBackdropClick}>
      <div className="contact-modal">
        <div className="contact-modal-header">
          <h2 className="contact-modal-title">Get in Touch</h2>
          <button className="contact-modal-close" onClick={onClose} aria-label="Close modal">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        </div>

        <div className="contact-modal-body">
          {!success ? (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    required
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Jane Cooper"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Email</label>
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone (Optional)</label>
                  <input
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company (Optional)</label>
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Acme Inc."
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="general">General Inquiry</option>
                  <option value="technical">Technical Support</option>
                  <option value="billing">Billing & Pricing</option>
                  <option value="security">Security & Privacy</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">How can we help?</label>
                <textarea
                  required
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="form-textarea"
                  placeholder="Tell us a bit more about your inquiry..."
                />
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

              <button className="contact-submit-btn" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Message'}
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                )}
              </button>
            </form>
          ) : (
            <div className="success-area">
              <div className="success-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3 className="success-title">Message Sent</h3>
              <p className="success-desc">
                Thanks for reaching out! Our team will get back to you shortly at <strong>{formData.email}</strong>.
              </p>
              <button 
                onClick={onClose} 
                style={{ 
                  marginTop: '1.5rem', padding: '0.75rem 1.5rem', 
                  background: 'none', border: '1.5px solid #d1d5db', 
                  borderRadius: '10px', color: '#4b5563', 
                  fontWeight: 600, cursor: 'pointer' 
                }}
              >
                Close Window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
