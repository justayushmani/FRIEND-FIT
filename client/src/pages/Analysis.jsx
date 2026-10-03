import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';

export default function Analysis({ profileId }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadAnalysis() {
      if (!sessionId) return;
      try {
        setLoading(true);
        setError(null);

        const [analysisRes, sessionRes] = await Promise.all([
          api.getAnalysis(sessionId),
          api.getSession(sessionId),
        ]);

        if (!mounted) return;

        setAnalysis(analysisRes);
        setSessionData(sessionRes);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to load session analysis');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAnalysis();
    return () => { mounted = false; };
  }, [sessionId]);

  const overallScore = analysis?.overallScore ?? sessionData?.session?.overall_score ?? 0;
  const categories = analysis?.categories || [];

  return (
    <div className="analysis-page">
      <Navbar profileId={profileId} />

      <main className="container" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <div className="loading-text">SYNTHESIZING COACH DEBRIEF & WEAKNESS AUDIT...</div>
          </div>
        ) : error ? (
          <div className="error-banner">
            <span>{error}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            {!analysis ? (
              <div className="error-banner" role="alert">
                <span>Analysis is unavailable because a validated local Gemma result was not returned. No substitute scores were created.</span>
                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
              </div>
            ) : <>
            <div className="analysis-header">
              <span className="badge badge-lime" style={{ marginBottom: '0.75rem' }}>
                SESSION AUDIT COMPLETE
              </span>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', textTransform: 'uppercase' }}>
                Performance Analysis
              </h1>
              <p style={{ color: 'var(--gray)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                Session ID: {sessionId} • {sessionData?.answers?.length || 0} Questions Answered
              </p>
            </div>

            {/* Overall Score Banner */}
            <div className="card analysis-overall">
              <span className="overall-label">OVERALL SESSION PERFORMANCE</span>
              <div 
                className="overall-score"
                style={{
                  color: overallScore >= 75 ? 'var(--lime-dark)' : overallScore >= 50 ? '#d97706' : 'var(--pink)'
                }}
              >
                {overallScore}
                <span style={{ fontSize: '2rem', color: 'var(--gray)' }}>/100</span>
              </div>
              <p style={{ marginTop: '0.75rem', maxWidth: '600px', textAlign: 'center', color: 'var(--dark-2)', fontSize: '1.05rem', lineHeight: 1.5 }}>
                {analysis.summary}
              </p>
            </div>

            {/* Category Grid */}
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Rubric Breakdown
            </h3>
            <div className="category-grid">
              {categories.map((cat, idx) => (
                <div key={idx} className="category-card card">
                  <div className="category-name">{cat.name || cat.category}</div>
                  <div className="category-score">
                    {cat.score}
                    <span style={{ fontSize: '1rem', color: 'var(--gray)' }}>/100</span>
                  </div>
                  <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${cat.score}%`,
                        background: cat.score >= 75 ? 'var(--lime)' : cat.score >= 50 ? 'var(--yellow)' : 'var(--pink)'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Weaknesses & Concept Gaps */}
            {analysis?.keyWeaknesses && analysis.keyWeaknesses.length > 0 && (
              <div className="card" style={{ marginBottom: 'var(--space-2xl)', borderColor: 'var(--pink)' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: '0.75rem' }}>
                  🚨 Flagged Weaknesses & Mistakes
                </h3>
                <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                  {analysis.keyWeaknesses.map((wk, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                      {wk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Coach Next Step Recommendations */}
            <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                Coach Action Plan
              </h3>
              <div className="recommendations-list">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className="recommendation-item">
                    <div className="rec-number">{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Answers Log */}
            {sessionData?.questions && sessionData.questions.length > 0 && (
              <div style={{ marginBottom: 'var(--space-2xl)' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  Session Questions & Submitted Answers
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {sessionData.questions.map((q, i) => {
                    const ans = sessionData.answers?.find(a => a.question_id === q.id);
                    return (
                      <div key={i} className="card" style={{ background: 'var(--off-white)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem' }}>
                            Q{i + 1}: {q.topic_name || 'Interview Question'}
                          </span>
                          {ans && (
                            <span className="badge" style={{ background: ans.score >= 70 ? 'var(--lime)' : ans.score >= 50 ? 'var(--yellow)' : 'var(--pink)' }}>
                              Score: {ans.score}/100
                            </span>
                          )}
                        </div>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{q.question_text}</p>
                        {ans && (
                          <div style={{ background: 'var(--white)', padding: '0.75rem', border: '1px solid var(--gray-light)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--dark-2)', marginBottom: '0.5rem' }}>
                              <strong>Your Answer:</strong> {ans.answer_text}
                            </div>
                            {ans.feedback && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--dark)', borderLeft: '3px solid var(--lime)', paddingLeft: '0.5rem' }}>
                                <strong>Feedback:</strong> {ans.feedback}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                🎯 View Next Best Action in Dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/practice')}>
                🚀 Start Another Practice Session
              </button>
            </div>
            </>}
          </>
        )}
      </main>
    </div>
  );
}
