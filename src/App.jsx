import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AuthModal from './components/AuthModal';
import DevPanel from './components/DevPanel';
import './App.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [forcedView, setForcedView] = useState(null);

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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setModalOpen(false);
    setForcedView(null);
  };

  return (
    <div className="app">
      {isLoggedIn ? (
        <HomePage user={user} onLogout={() => { setUser(null); setIsLoggedIn(false); }} />
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
  );
}