import { useState, useEffect } from 'react';
import { signOut, getMe } from './api/auth.api';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AuthModal from './components/AuthModal';

import { TeamProvider, useTeam } from './context/TeamContext';
import { NotificationProvider } from './context/NotificationContext';
import './App.css';

// ─── Inner component that has access to TeamContext ───────────────────────────
// This must live inside <TeamProvider> so it can call clearTeam() on logout.
function AuthedApp({ user, onLogout }) {
  const { clearTeam, clearOrg } = useTeam();

  const handleLogout = () => {
    clearTeam();   // wipes team from localStorage
    clearOrg();    // wipes org from localStorage
    onLogout();
  };

  return <HomePage user={user} onLogout={handleLogout} />;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleModalClose = () => {
    setModalOpen(false);
  };

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const data = await getMe();
        if (data?.user) {
          setUser(data.user);
          setIsLoggedIn(true);
        } else {
          signOut();
        }
      } catch (err) {
        // Token invalid or network error
        signOut();
      } finally {
        setIsInitializing(false);
      }
    };

    initializeUser();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setModalOpen(false);
  };

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0b', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  return (
    <NotificationProvider>
      <TeamProvider>
        <div className="app">
          {isLoggedIn ? (
            <AuthedApp
              user={user}
              onLogout={() => { signOut(); setUser(null); setIsLoggedIn(false); }}
            />
          ) : (
            <LandingPage onOpenAuth={() => setModalOpen(true)} />
          )}

          {modalOpen && (
            <AuthModal
              onClose={handleModalClose}
              onSuccess={handleLoginSuccess}
            />
          )}
        </div>
      </TeamProvider>
    </NotificationProvider>
  );
}