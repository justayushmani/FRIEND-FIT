import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useTimer } from '../hooks';

export default function PracticeRoom({ profileId, profileData }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [error, setError] = useState(null);

  // Speech Recognition
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Timers
  const sessionTimer = useTimer(true);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Initialize or start session
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (!profileId) {
        setSessionLoading(false);
        return;
      }

      try {
        setSessionLoading(true);
        setError(null);
        // Start new session
        const session = await api.startSession(profileId, 'interview');
        if (!mounted) return;
        setSessionId(session.id);
        
        // Fetch first question
        await loadNextQuestion(session.id);
      } catch (err) {
        if (!mounted) return;
        console.error('Session init error:', err);
        setError(err.message || 'Could not start practice session');
      } finally {
        if (mounted) setSessionLoading(false);
      }
    }

    initSession();

    return () => {
      mounted = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [profileId]);

  // Load next question
  const loadNextQuestion = async (sid) => {
    const sId = sid || sessionId;
    if (!sId) return;

    try {
      setQuestionLoading(true);
      setError(null);
      setEvaluation(null);
      setAnswerText('');

      const q = await api.getQuestion(sId);
      setCurrentQuestion(q);
      setQuestionCount(prev => prev + 1);
      setQuestionStartTime(Date.now());
    } catch (err) {
      console.error('Failed to get question:', err);
      setError(err.message || 'Failed to fetch next question');
    } finally {
      setQuestionLoading(false);
    }
  };

  // Toggle Voice Recognition
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type your answer in the box!');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (event.results[event.resultIndex].isFinal) {
            setAnswerText(prev => (prev ? prev + ' ' : '') + currentTranscript.trim());
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } catch (err) {
        console.error('Speech recognition start failed:', err);
        setIsRecording(false);
      }
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!answerText.trim() || !currentQuestion || !sessionId) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    try {
      setSubmittingAnswer(true);
      setError(null);

      const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
      const res = await api.submitAnswer(sessionId, currentQuestion.id, answerText, timeTaken);
      setEvaluation(res.evaluation);
    } catch (err) {
      console.error('Submit answer error:', err);
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // End Session & Navigate to Analysis
  const handleEndSession = async () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    try {
      await api.endSession(sessionId);
      navigate(`/analysis/${sessionId}`);
    } catch (err) {
      console.error('Error ending session:', err);
      navigate(`/analysis/${sessionId}`);
    }
  };

  if (!profileId) {
    return (
      <div className="practice-room" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div className="question-card" style={{ maxWidth: '500px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--lime)', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
            NO ACTIVE PROFILE
          </h2>
          <p style={{ color: 'var(--gray-light)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            To begin personal practice sessions, you need to create a profile for your friend or load the pre-built demo profile.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/setup')}>
              Create Profile
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={async () => {
                const res = await api.seedDemo();
                if (res?.profile) {
                  localStorage.setItem('friendfit_profile_id', JSON.stringify(res.profile.id));
                  localStorage.setItem('friendfit_profile', JSON.stringify(res.profile));
                  window.location.reload();
                }
              }}
            >
              Load Ayush Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-room">
      {/* Top Bar */}
      <header className="practice-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--dark-3)', color: 'var(--cream)', border: '1px solid var(--gray)' }}
            onClick={() => {
              if (confirm('Leave practice room? Your current session answers are saved.')) {
                handleEndSession();
              }
            }}
          >
            ← Exit
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--lime)' }}>
            FRIEND•FIT ROOM
          </span>
          {profileData && (
            <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
              👤 {profileData.name}
            </span>
          )}
        </div>

        <div className="practice-meta">
          <div className="practice-counter">
            QUESTION {questionCount} {questionCount > 0 ? '• LIVE' : ''}
          </div>
          <div className="practice-timer" title="Session Duration">
            ⏱ {sessionTimer.formatted}
          </div>
          <button
            className="btn btn-sm btn-pink"
            onClick={handleEndSession}
            disabled={sessionLoading || questionCount === 0}
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main Practice Area */}
      <main className="practice-main">
        {error && (
          <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {sessionLoading || questionLoading ? (
          <div className="loading-state" style={{ minHeight: '300px' }}>
            <div className="spinner"></div>
            <div className="loading-text">
              {sessionLoading ? 'CALIBRATING AI COACH FOR YOUR PROFILE...' : 'GENERATING ADAPTIVE QUESTION...'}
            </div>
          </div>
        ) : currentQuestion ? (
          <>
            {/* Question Card */}
            <div className="question-card">
              <div className="question-header">
                <span className="question-number">QUESTION #{questionCount}</span>
                {currentQuestion.topic_name && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                    {currentQuestion.topic_name}
                  </span>
                )}
                {currentQuestion.difficulty && (
                  <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
                    {currentQuestion.difficulty.toUpperCase()}
                  </span>
                )}
              </div>

              <h2 className="question-text">
                {currentQuestion.question_text}
              </h2>

              {currentQuestion.reason && (
                <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray-light)', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                  🎯 <strong>Coach Motivation:</strong> {currentQuestion.reason}
                </div>
              )}
            </div>

            {/* Answer Area */}
            {!evaluation ? (
              <div className="answer-area">
                <textarea
                  className="answer-textarea"
                  placeholder="Type your response here, or tap the microphone below to speak your answer naturally..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  disabled={submittingAnswer}
                />

                <div className="answer-actions">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className={`mic-btn ${isRecording ? 'recording' : ''}`}
                      onClick={toggleSpeechRecognition}
                      title={isRecording ? 'Click to Stop Recording' : 'Click to Speak Answer'}
                      disabled={submittingAnswer}
                    >
                      {isRecording ? '⏹' : '🎙️'}
                    </button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: isRecording ? 'var(--pink)' : 'var(--gray-light)' }}>
                      {isRecording ? 'LISTENING... (SPEAK FREELY)' : 'TAP TO DICTATE ANSWER'}
                    </span>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}
                    onClick={handleSubmitAnswer}
                    disabled={submittingAnswer || !answerText.trim()}
                  >
                    {submittingAnswer ? 'Evaluating Answer...' : 'Submit Answer →'}
                  </button>
                </div>
              </div>
            ) : (
              /* Evaluation Feedback Card */
              <div className="feedback-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray-light)', textTransform: 'uppercase' }}>
                      COACH EVALUATION SCORE
                    </span>
                    <div className={`feedback-score ${evaluation.score >= 75 ? 'high' : evaluation.score >= 50 ? 'medium' : 'low'}`}>
                      {evaluation.score}<span style={{ fontSize: '1.25rem', color: 'var(--gray)' }}>/100</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => loadNextQuestion()}
                    >
                      Next Question →
                    </button>
                    <button
                      className="btn btn-pink"
                      onClick={handleEndSession}
                    >
                      Complete Session & View Analysis
                    </button>
                  </div>
                </div>

                <div className="feedback-text">
                  <strong style={{ color: 'var(--cream)', display: 'block', marginBottom: '0.25rem' }}>AI Feedback:</strong>
                  {evaluation.feedback}
                </div>

                {/* Strengths & Weaknesses Pills */}
                <div className="feedback-pills">
                  {evaluation.strengths?.map((str, i) => (
                    <span key={`s-${i}`} className="pill-strength">✓ {str}</span>
                  ))}
                  {evaluation.weaknesses?.map((wk, i) => (
                    <span key={`w-${i}`} className="pill-weakness">✗ {wk}</span>
                  ))}
                </div>

                {evaluation.conceptGaps?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--yellow)' }}>
                    ⚠️ <strong>Identified Concept Gap:</strong> {evaluation.conceptGaps.join(', ')}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3 className="empty-title" style={{ color: 'var(--cream)' }}>Session Ready</h3>
            <p className="empty-text">Click below to start practicing with adaptive questions.</p>
            <button className="btn btn-primary" onClick={() => loadNextQuestion()}>
              Get First Question
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
