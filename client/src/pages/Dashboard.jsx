import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';

export default function Dashboard({ profileId, profileData, setProfileId, setProfileData }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      if (!profileId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [recRes, predRes, mistRes, statsRes, sessRes] = await Promise.allSettled([
          api.getRecommendation(profileId),
          api.getPredictions(profileId),
          api.getMistakes(profileId),
          api.getMistakeStats(profileId),
          api.getSessionsByProfile(profileId),
        ]);

        if (!mounted) return;

        if (recRes.status === 'fulfilled') setRecommendation(recRes.value);
        if (predRes.status === 'fulfilled') setPredictions(predRes.value || []);
        if (mistRes.status === 'fulfilled') setMistakes(mistRes.value || []);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (sessRes.status === 'fulfilled') setSessions(sessRes.value || []);
      } catch (err) {
        if (!mounted) return;
        console.error('Dashboard load error:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => { mounted = false; };
  }, [profileId]);

  const handleSeedDemo = async () => {
    try {
      setLoading(true);
      const res = await api.seedDemo();
      if (res && res.profile) {
        setProfileId(res.profile.id);
        setProfileData(res.profile);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load demo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profileId) {
    return (
      <div className="dashboard-page">
        <Navbar profileId={profileId} profileData={profileData} />
        <main className="container" style={{ padding: 'var(--space-3xl) var(--space-lg)' }}>
          <div className="card empty-state" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="empty-icon">🎯</div>
            <h2 className="empty-title">No Practice Profile Found</h2>
            <p className="empty-text">
              FriendFit needs a friend profile to track recurring mistakes and compute your Next Best Action.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/setup')}>
                Create Friend Profile
              </button>
              <button className="btn btn-secondary" onClick={handleSeedDemo}>
                ⚡ Load Sample Demo Data
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Navbar 
        profileId={profileId} 
        profileData={profileData}
        onProfileChange={(newProf) => {
          setProfileId(newProf.id);
          setProfileData(newProf);
        }}
      />

      <main className="container" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {String(profileId).startsWith('demo-') && (
          <div className="demo-banner" role="status">
            Sample profile and session history · Demonstration data, not a real friend's results
          </div>
        )}
        {error && (
          <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Profile Header Summary */}
        <div className="card" style={{ marginBottom: 'var(--space-2xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--white)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', margin: 0 }}>
                {profileData?.name || 'Coach Trainee'}
              </h1>
              <span className="badge badge-yellow">
                {profileData?.target_role || 'Candidate'}
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--gray)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
              Skills: {profileData?.skills?.join(', ') || 'None listed'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/setup')}>
              ✏️ Edit Profile
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/practice')}>
              🚀 Start Practice Room
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <div className="loading-text">AUDITING RECURRING MISTAKES & CALCULATING NEXT BEST ACTION...</div>
          </div>
        ) : (
          <>
            {/* NEXT BEST ACTION (NBA) HERO CARD */}
            {recommendation && (
              <section className="nba-card card">
                <div className="nba-label">
                  🎯 RECOMMENDED BY FRIEND•FIT ENGINE • NEXT BEST ACTION
                </div>
                
                <h2 className="nba-topic">
                  {recommendation.topic.toUpperCase()}
                </h2>

                <div className="nba-duration">
                  ⏱ {recommendation.duration_minutes} MIN TARGETED DRILL
                </div>

                <p className="nba-reason">
                  {recommendation.reason}
                </p>

                {recommendation.risk_score != null && (
                  <div className="nba-prediction">
                    HISTORICAL RISK INDEX · {recommendation.risk_score}/100 · RULE-BASED
                  </div>
                )}

                <div className="nba-cta">
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '1.05rem', padding: '0.85rem 1.75rem' }}
                    onClick={() => navigate(`/practice?topic=${encodeURIComponent(recommendation.topic)}`)}
                  >
                    🚀 Start This Drill Now
                  </button>
                </div>
              </section>
            )}

            {/* QUICK STATS BENTO */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: 'var(--space-2xl)' }}>
                <div className="card" style={{ textAlign: 'center', background: 'var(--white)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray)', textTransform: 'uppercase' }}>
                    Unresolved Mistakes
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--pink)' }}>
                    {stats.unresolved ?? mistakes.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>Active blind spots</div>
                </div>

                <div className="card" style={{ textAlign: 'center', background: 'var(--white)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray)', textTransform: 'uppercase' }}>
                    Practice Sessions
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--black)' }}>
                    {sessions.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>Recorded debriefs</div>
                </div>

                <div className="card" style={{ textAlign: 'center', background: 'var(--white)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray)', textTransform: 'uppercase' }}>
                    Resolution Rate
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--lime-dark)' }}>
                    {Number(stats.total) > 0 ? `${Math.round((Number(stats.resolved) / Number(stats.total)) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>Errors overcome</div>
                </div>

                <div className="card" style={{ textAlign: 'center', background: 'var(--white)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray)', textTransform: 'uppercase' }}>
                    High-Severity Gaps
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {stats.bySeverity?.high ?? mistakes.filter(m => m.severity === 'high').length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>Needs urgent review</div>
                </div>
              </div>
            )}

            {/* TWO COLUMNS: MISTAKE MEMORY & PREDICTIVE PERSISTENCE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
              
              {/* RECURRING MISTAKES MEMORY LEDGER */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', textTransform: 'uppercase', margin: 0 }}>
                    🧠 Recurring Mistake Ledger ({mistakes.length})
                  </h3>
                </div>

                {mistakes.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--gray)' }}>
                    No recurring mistakes captured yet! Complete a practice session to detect conceptual traps.
                  </div>
                ) : (
                  <div className="mistakes-section" style={{ marginTop: 0 }}>
                    {mistakes.map((m) => (
                      <div key={m.id} className="mistake-card card">
                        <div className={`mistake-severity ${m.severity}`}></div>
                        <div className="mistake-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="mistake-topic">{m.topic}</span>
                            <span className={`badge badge-${m.severity === 'high' ? 'pink' : m.severity === 'medium' ? 'yellow' : 'cyan'}`} style={{ fontSize: '0.65rem' }}>
                              {m.severity.toUpperCase()} PRIORITY
                            </span>
                          </div>
                          <div className="mistake-text">
                            <strong>Observed Error:</strong> {m.mistake}
                          </div>
                          {m.recommendation && (
                            <div className="mistake-rec">
                              💡 <strong>Coach Advice:</strong> {m.recommendation}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--gray)' }}>
                            <span>Tested: {m.times_tested ?? 1}x</span>
                            <span>Improved: {m.times_improved ?? 0}x</span>
                            <span>Status: {m.is_resolved ? '✅ Resolved' : '⚠️ Active'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* HISTORY-BASED TOPIC RISK */}
              <div>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  📈 Historical Topic Risk
                </h3>

                {predictions.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--gray)' }}>
                    Not enough repeated attempts yet to estimate topic risk. A first result is not presented as a prediction.
                  </div>
                ) : (
                  <div className="card" style={{ background: 'var(--white)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--dark-2)', marginBottom: '1rem' }}>
                      A transparent rule-based index from observed scores, repeat attempts, and saved mistakes. This is not a trained ML prediction.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {predictions.map((p, idx) => (
                        <div key={idx} style={{ borderBottom: '1px solid var(--off-white)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                              {p.topic}
                            </span>
                            <span 
                              style={{ 
                                fontFamily: 'var(--font-mono)', 
                                fontWeight: 700, 
                                fontSize: '0.85rem',
                                color: p.risk_score >= 60 ? 'var(--pink)' : p.risk_score >= 30 ? '#d97706' : 'var(--lime-dark)'
                              }}
                            >
                              {p.risk_score}/100 · {p.risk_level.toUpperCase()} HISTORICAL RISK
                            </span>
                          </div>
                          
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ 
                                width: `${p.risk_score}%`,
                                background: p.risk_score >= 60 ? 'var(--pink)' : p.risk_score >= 30 ? 'var(--yellow)' : 'var(--lime)'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SESSION HISTORY */}
            <div style={{ marginBottom: 'var(--space-2xl)' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                📜 Past Practice Sessions ({sessions.length})
              </h3>

              {sessions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--gray)' }}>
                  No sessions recorded yet. Launch your first practice drill!
                </div>
              ) : (
                <div className="session-list">
                  {sessions.map((sess) => (
                    <div 
                      key={sess.id} 
                      className="session-card"
                      onClick={() => navigate(`/analysis/${sess.id}`)}
                      title="Click to view detailed session analysis"
                    >
                      <div className="session-info">
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                          {sess.session_type?.toUpperCase() || 'PRACTICE'} SESSION
                        </span>
                        <span className="session-date">
                          📅 {new Date(sess.started_at).toLocaleDateString()} at {new Date(sess.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sess.total_questions || 4} Questions
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--gray)', display: 'block' }}>
                            SCORE
                          </span>
                          <span 
                            className="session-score" 
                            style={{ 
                              color: (sess.overall_score || 0) >= 70 ? 'var(--lime-dark)' : (sess.overall_score || 0) >= 50 ? '#d97706' : 'var(--pink)' 
                            }}
                          >
                            {sess.overall_score ?? '—'}
                          </span>
                        </div>
                        <span style={{ fontSize: '1.25rem', color: 'var(--gray)' }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
