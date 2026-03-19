import { useState, useEffect } from 'react';
import { signOut, getMe } from './api/auth.api';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AuthModal from './components/AuthModal';
import { getGoogleRedirectResult } from './api/auth.google.api';
import BirdLoader from './components/BirdLoader';

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
  const [pendingRedirectAuth, setPendingRedirectAuth] = useState(null);

  const handleModalClose = () => {
    setModalOpen(false);
  };

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 1. Check if we just returned from a Google Redirect
        const redirectResponse = await getGoogleRedirectResult();
        if (redirectResponse) {
          if (redirectResponse.isNewUser) {
            setPendingRedirectAuth(redirectResponse);
            setModalOpen(true);
            setIsInitializing(false);
            return;
          } else {
            handleLoginSuccess(redirectResponse.user);
            setIsInitializing(false);
            return;
          }
        }

        // 2. Otherwise try local token session
        const data = await getMe();
        if (data?.user) {
          setUser(data.user);
          setIsLoggedIn(true);
        } else {
          signOut();
        }
      } catch (err) {
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
    setPendingRedirectAuth(null);
  };

  if (isInitializing) {
    return <BirdLoader />;
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
              initialRedirectData={pendingRedirectAuth}
            />
          )}
        </div>
      </TeamProvider>
    </NotificationProvider>
  );
}