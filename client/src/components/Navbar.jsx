import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Navbar({ profileData, onProfileChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    api.health()
      .then((health) => setAiStatus(health.ai || null))
      .catch(() => setAiStatus({ available: false }));
  }, []);

  const handleSeedDemo = async () => {
    try {
      setIsDemoLoading(true);
      const res = await api.seedDemo();
      if (res && res.profile) {
        if (onProfileChange) {
          onProfileChange(res.profile);
        } else {
          localStorage.setItem('friendfit_profile_id', JSON.stringify(res.profile.id));
          localStorage.setItem('friendfit_profile', JSON.stringify(res.profile));
        }
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to seed demo:', err);
      alert('Failed to load demo data: ' + err.message);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <span className="logo-dot"></span>
        FRIEND<span>FIT</span>
      </Link>

      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/practice" className={location.pathname === '/practice' ? 'active' : ''}>Practice</Link>
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
        <Link to="/setup" className={location.pathname === '/setup' ? 'active' : ''}>
          {profileData ? 'Edit Profile' : 'New Profile'}
        </Link>
        
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleSeedDemo}
          disabled={isDemoLoading}
          title="Load clearly labeled sample history, mistakes, and next best action"
          style={{ marginLeft: '0.5rem' }}
        >
          {isDemoLoading ? 'Loading Demo...' : '⚡ Demo Mode'}
        </button>

        {profileData && (
          <span className="badge badge-yellow" style={{ fontSize: '0.75rem' }}>
            👤 {profileData.name || 'Friend'}
          </span>
        )}

        <div
          className="navbar-mode"
          title={
            aiStatus?.available
              ? (aiStatus.local ? `Local Gemma running (${aiStatus.model})` : `Google AI Studio (${aiStatus.model})`)
              : 'AI service is currently offline or model not installed.'
          }
        >
          <div className={`mode-dot ${aiStatus?.available ? '' : 'offline'}`}></div>
          <span className="mode-label">
            {aiStatus?.available
              ? (aiStatus.local ? 'LOCAL GEMMA' : `GOOGLE AI (${aiStatus.model || 'HOSTED'})`)
              : 'AI OFFLINE'}
          </span>
        </div>
      </div>
    </nav>
  );
}
