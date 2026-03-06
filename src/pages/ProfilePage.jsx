import React, { useState, useEffect } from 'react';
import './ProfilePage.css';
import { getProfileStats, getRecentActivity, updateProfile, updatePassword, signOutAllDevices } from '../api/profile.api';

export default function ProfilePage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);

  // States for API data
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  // States for forms
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [theme, setTheme] = useState(user?.theme || 'System Default');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ text: '', type: '' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    // trigger entry animations
    setIsLoaded(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoadingStats(true);
      const statsData = await getProfileStats();
      setStats([
        { label: 'Total Collections', value: statsData?.totalCollections || 0, icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ), color: '#a07ee8' },
        { label: 'Requests Sent', value: (statsData?.requestsSent || 0) >= 1000 ? ((statsData.requestsSent || 0)/1000).toFixed(1) + 'k' : (statsData?.requestsSent || 0), icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        ), color: '#10b981' },
        { label: 'Teams Joined', value: statsData?.teamsJoined || 0, icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        ), color: '#3b82f6' },
      ]);
      setIsLoadingStats(false);

      setIsLoadingActivity(true);
      const activityData = await getRecentActivity();
      setActivity(activityData);
      setIsLoadingActivity(false);
    } catch (error) {
      console.error('Failed to fetch profile data', error);
      setIsLoadingStats(false);
      setIsLoadingActivity(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage({ text: '', type: '' });
    try {
      await updateProfile({ name: displayName, email, theme });
      setProfileMessage({ text: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => setProfileMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setProfileMessage({ text: error.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ text: 'Please fill in all fields.', type: 'error' });
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordMessage({ text: '', type: '' });
    try {
      await updatePassword({ currentPassword, newPassword });
      setPasswordMessage({ text: 'Password updated successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setPasswordMessage({ text: error.message || 'Failed to update password.', type: 'error' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOutAll = async () => {
    if (!window.confirm('This will sign you out of all active sessions on other devices. Continue?')) return;
    try {
      await signOutAllDevices();
      onLogout(); // Final locally clear too
    } catch (error) {
      console.error('Sign out all failed', error);
      onLogout(); // Still log out locally
    }
  };

  return (
    <div className={`pp-root ${isLoaded ? 'pp-loaded' : ''}`}>
      {/* Ambient background glows */}
      <div className="pp-glow pp-glow-1"></div>
      <div className="pp-glow pp-glow-2"></div>
      
      <div className="pp-container">
        
        {/* Banner Section */}
        <div className="pp-banner glass-panel" style={{ animationDelay: '0.1s' }}>
          <div className="pp-banner-bg pattern-dots"></div>
          <div className="pp-banner-content">
            <div className="pp-avatar-wrapper">
              <div className="pp-avatar-ring"></div>
              <div className="pp-avatar">
                {((displayName || user?.name || 'U')[0]).toUpperCase()}
              </div>
              <div className="pp-status-dot"></div>
            </div>
            
            <div className="pp-user-info">
              <h1 className="pp-name">{displayName || user?.name || 'Super User'}</h1>
              <p className="pp-email">{email || user?.email || 'super@hitit.app'}</p>
              
              <div className="pp-badges">
                <span className="pp-badge pp-badge-pro">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  Pro Plan
                </span>
                <span className="pp-badge pp-badge-active">Online</span>
              </div>
            </div>
            
            <div className="pp-header-actions">
              <button className="pp-btn-edit" onClick={() => setActiveTab('settings')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="pp-tabs" style={{ animationDelay: '0.2s' }}>
          {['overview', 'settings', 'security'].map(tab => (
            <button 
              key={tab}
              className={`pp-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <div className="pp-tab-glow"></div>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pp-content-area" style={{ animationDelay: '0.3s' }}>
          {activeTab === 'overview' && (
            <div className="pp-tab-pane pp-fade-in">
              <h2 className="pp-section-title">At a Glance</h2>
              
              <div className="pp-stats-grid">
                {isLoadingStats ? (
                  Array(3).fill(0).map((_, i) => (
                    <div className="pp-stat-card glass-panel group" key={i} style={{ animationDelay: `${0.4 + i*0.1}s` }}>
                      <div className="pp-stat-skeleton"></div>
                    </div>
                  ))
                ) : (
                  stats?.map((s, i) => (
                    <div className="pp-stat-card glass-panel group" key={i} style={{ animationDelay: `${0.4 + i*0.1}s` }}>
                      <div className="pp-stat-glow-hover" style={{ background: s.color }}></div>
                      <div className="pp-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>
                        {s.icon}
                      </div>
                      <div className="pp-stat-details">
                        <span className="pp-stat-value">{s.value}</span>
                        <span className="pp-stat-label">{s.label}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pp-recent-activity glass-panel" style={{ animationDelay: '0.7s', marginTop: '2rem' }}>
                <div className="pp-recent-header">
                  <h3>Recent Activity</h3>
                  <button className="pp-btn-ghost">View All</button>
                </div>
                <div className="pp-activity-list">
                  {isLoadingActivity ? (
                    <div className="pp-activity-loading pp-fade-in">Loading recent activity...</div>
                  ) : activity?.length > 0 ? (
                    activity.map((act, i) => (
                      <div className="pp-activity-item pp-fade-in" key={act.id || i} style={{ animationDelay: `${0.2 + i*0.1}s` }}>
                        <div className="pp-activity-icon">{act.icon}</div>
                        <div className="pp-activity-text">
                          <p>{act.title}</p>
                          <span>{act.time}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="pp-activity-empty">No recent activity.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="pp-tab-pane pp-fade-in">
              <h2 className="pp-section-title">Account Preferences</h2>
              <form className="pp-settings-form glass-panel" onSubmit={handleProfileUpdate}>
                {profileMessage.text && (
                  <div className={`pp-message pp-message-${profileMessage.type}`}>
                    {profileMessage.type === 'success' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    )}
                    {profileMessage.text}
                  </div>
                )}
                <div className="pp-form-group">
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    className="pp-input" 
                    required
                  />
                </div>
                <div className="pp-form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="pp-input" 
                    required
                  />
                </div>
                <div className="pp-form-group">
                  <label>Theme Preference</label>
                  <select 
                    className="pp-input" 
                    value={theme}
                    onChange={e => setTheme(e.target.value)}
                  >
                    <option>System Default</option>
                    <option>Dark Mode</option>
                    <option>Light Mode</option>
                  </select>
                </div>
                <div className="pp-form-actions">
                  <button type="submit" className="pp-btn-primary" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="pp-tab-pane pp-fade-in">
              <h2 className="pp-section-title">Security Settings</h2>
              <form className="pp-settings-form glass-panel" onSubmit={handlePasswordUpdate}>
                {passwordMessage.text && (
                  <div className={`pp-message pp-message-${passwordMessage.type}`}>
                    {passwordMessage.type === 'success' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    )}
                    {passwordMessage.text}
                  </div>
                )}
                <div className="pp-form-group">
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="pp-input" 
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    Enter your current password to confirm the change
                  </small>
                </div>
                <div className="pp-form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="Enter new password" 
                    className="pp-input" 
                  />
                </div>
                <div className="pp-form-actions">
                  <button type="button" className="pp-btn-danger" onClick={handleSignOutAll}>Sign Out on All Devices</button>
                  <button type="submit" className="pp-btn-primary" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
