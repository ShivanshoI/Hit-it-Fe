import { useState, useEffect } from 'react';
import { signOut, getMe } from './api/auth.api';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AuthModal from './components/AuthModal';
import DevPanel from './components/DevPanel';
import { MockApiProvider } from './components/MockApiProvider';
import './App.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [forcedView, setForcedView] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [devConfig, setDevConfig] = useState({
    loginResult: 'success',
    registerResult: 'success',
  });

  // When dev panel jumps to a view, open the modal and force the view
  const handleForceView = (view) => {
    setForcedView(view);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setForcedView(null);
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
    setForcedView(null);
  };

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0b', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  return (
    <MockApiProvider>
      <div className="app">
        {isLoggedIn ? (
          <HomePage user={user} onLogout={() => { signOut(); setUser(null); setIsLoggedIn(false); }} />
        ) : (
          <LandingPage onOpenAuth={() => setModalOpen(true)} />
        )}

        {modalOpen && (
          <AuthModal
            onClose={handleModalClose}
            onSuccess={handleLoginSuccess}
            devConfig={devConfig}
            forcedView={forcedView}
          />
        )}

        {import.meta.env.DEV && (
          <DevPanel
            config={devConfig}
            onChange={setDevConfig}
            onForceView={handleForceView}
          />
        )}
      </div>
    </MockApiProvider>
  );
}