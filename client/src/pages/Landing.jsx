import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api';

export default function Landing({ profileId }) {
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleStartDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await api.seedDemo();
      if (res && res.profile) {
        localStorage.setItem('friendfit_profile_id', JSON.stringify(res.profile.id));
        localStorage.setItem('friendfit_profile', JSON.stringify(res.profile));
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to initialize demo: ' + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleStartPractice = () => {
    if (profileId) {
      navigate('/practice');
    } else {
      navigate('/setup');
    }
  };

  return (
    <div className="landing">
      <Navbar profileId={profileId} />
      
      <main className="landing-hero">
        <div className="landing-brand">
          <span className="badge badge-yellow" style={{ marginBottom: '1rem' }}>
            ⚡ Hackathon Build • AI Practice Coach for One Real Friend
          </span>
          <h1 className="landing-logo">
            FRIEND<span>FIT</span>
          </h1>
        </div>

        <p className="landing-tagline">
          Stop practicing blindly. FriendFit <em>remembers your recurring mistakes</em>, 
          spots conceptual gaps, and serves your exact <em>Next Best Action</em> to ace technical interviews.
        </p>

        <div className="landing-cta">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              className="btn btn-primary" 
              style={{ fontSize: '1.1rem', padding: '0.85rem 1.75rem' }}
              onClick={handleStartPractice}
            >
              {profileId ? '🚀 Resume Practice Room' : '🔥 Create Profile & Start'}
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ fontSize: '1.1rem', padding: '0.85rem 1.75rem' }}
              onClick={handleStartDemo}
              disabled={loadingDemo}
            >
              {loadingDemo ? 'Initializing Demo...' : '⚡ Try Demo with Ayush’s Data'}
            </button>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <button 
              className="btn btn-sm" 
              style={{ background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </button>
          </div>
        </div>

        <div className="landing-features">
          <div className="landing-feature">
            <span className="feat-icon">🧠</span>
            <span>Recurring Mistake Memory</span>
          </div>
          <div className="landing-feature">
            <span className="feat-icon">🎯</span>
            <span>Next Best Action Engine</span>
          </div>
          <div className="landing-feature">
            <span className="feat-icon">🎙️</span>
            <span>Voice & Text Responses</span>
          </div>
          <div className="landing-feature">
            <span className="feat-icon">📈</span>
            <span>Granular Rubric Scoring</span>
          </div>
          <div className="landing-feature">
            <span className="feat-icon">⚡</span>
            <span>Zero-Cloud Offline Fallback</span>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>FRIEND FIT • Built with Neo-Pop Brutalism • High-Performance Personal Practice System</p>
      </footer>
    </div>
  );
}
