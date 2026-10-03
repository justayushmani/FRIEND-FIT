import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';

export default function ProfileSetup({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [weakAreas, setWeakAreas] = useState([]);
  const [weakInput, setWeakInput] = useState('');
  const [projects, setProjects] = useState([]);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const addSkill = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault();
      const trimmed = skillInput.trim().replace(/,$/, '');
      if (!skills.includes(trimmed)) {
        setSkills([...skills, trimmed]);
      }
      setSkillInput('');
    }
  };

  const removeSkill = (index) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const addWeakArea = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && weakInput.trim()) {
      e.preventDefault();
      const trimmed = weakInput.trim().replace(/,$/, '');
      if (!weakAreas.includes(trimmed)) {
        setWeakAreas([...weakAreas, trimmed]);
      }
      setWeakInput('');
    }
  };

  const removeWeakArea = (index) => {
    setWeakAreas(weakAreas.filter((_, i) => i !== index));
  };

  const addProject = () => {
    setProjects([...projects, { name: '', tech: '', description: '' }]);
  };

  const updateProject = (idx, field, val) => {
    const updated = [...projects];
    updated[idx][field] = val;
    setProjects(updated);
  };

  const removeProject = (idx) => {
    setProjects(projects.filter((_, i) => i !== idx));
  };

  const handlePrefill = () => {
    setName('Demo Friend');
    setTargetRole('Full-Stack Software Engineer');
    setSkills(['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'System Design']);
    setWeakAreas(['Database optimization', 'System design trade-offs', 'Concurrency']);
    setProjects([
      { name: 'E-commerce Platform', tech: 'React, Node.js, PostgreSQL', description: 'Full-stack marketplace app with payments' },
      { name: 'Real-time Chat App', tech: 'WebSocket, Redis, React', description: 'Scalable messaging system' }
    ]);
    setResumeText('Full-stack developer with 2+ years building web applications using React, Node.js, and PostgreSQL.');
    setJobDescription('Looking for a full-stack software engineer role with emphasis on backend scalability and UI.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for your practice profile.');
      setStep(1);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const formattedProjects = projects
        .filter(p => p.name.trim())
        .map(p => ({
          name: p.name,
          tech: typeof p.tech === 'string' ? p.tech.split(',').map(s => s.trim()) : p.tech,
          description: p.description
        }));

      const payload = {
        name,
        targetRole,
        skills,
        weakAreas,
        projects: formattedProjects,
        resumeText,
        jobDescription,
      };

      const created = await api.createProfile(payload);
      if (onComplete) {
        onComplete(created);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="setup-page">
      <Navbar />

      <main className="setup-content">
        <div className="setup-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', textTransform: 'uppercase' }}>
                Profile Setup
              </h2>
              <p style={{ color: 'var(--gray)', fontSize: '0.875rem' }}>
                Configure your friend’s target role, background, and practice goals.
              </p>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-accent" 
              onClick={handlePrefill}
              title="Fill with standard demo values"
            >
              ⚡ Load Sample Values
            </button>
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
              <span>{error}</span>
              <button className="error-dismiss" onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* Stepper Header */}
          <div className="setup-progress">
            <div className={`setup-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>1</div>
            <div className={`setup-connector ${step > 1 ? 'done' : ''}`}></div>
            <div className={`setup-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>2</div>
            <div className={`setup-connector ${step > 2 ? 'done' : ''}`}></div>
            <div className={`setup-step ${step === 3 ? 'active' : ''}`}>3</div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* STEP 1: Basic Info */}
            {step === 1 && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--dark)' }}>
                  Step 1: Who is practicing?
                </h3>
                
                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    FRIEND'S NAME *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', padding: '0.75rem', border: 'var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Your friend's name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    TARGET ROLE *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', padding: '0.75rem', border: 'var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="e.g., Full-Stack Software Engineer"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    required
                  />
                </div>

                <div className="form-actions">
                  <div></div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (!name.trim()) {
                        setError('Name is required');
                        return;
                      }
                      setError('');
                      setStep(2);
                    }}
                  >
                    Next: Skills & Weak Areas →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Skills & Known Weaknesses */}
            {step === 2 && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--dark)' }}>
                  Step 2: Technical Baseline
                </h3>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    KNOWN SKILLS (Type and press Enter or comma)
                  </label>
                  <div className="chips-input">
                    {skills.map((s, idx) => (
                      <span key={idx} className="chip">
                        {s}
                        <button type="button" className="chip-remove" onClick={() => removeSkill(idx)}>×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="chip-input-field"
                      placeholder="Add skill (e.g. React, SQL, Docker)..."
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={addSkill}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    SELF-IDENTIFIED WEAK AREAS / BLIND SPOTS
                  </label>
                  <div className="chips-input">
                    {weakAreas.map((w, idx) => (
                      <span key={idx} className="chip" style={{ background: 'var(--pink)', color: 'white', borderColor: 'var(--black)' }}>
                        {w}
                        <button type="button" className="chip-remove" onClick={() => removeWeakArea(idx)} style={{ color: 'white' }}>×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="chip-input-field"
                      placeholder="Add weak area (e.g. SQL joins, concurrency, indexing)..."
                      value={weakInput}
                      onChange={(e) => setWeakInput(e.target.value)}
                      onKeyDown={addWeakArea}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                    Next: Projects & Resume →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Projects & Context */}
            {step === 3 && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--dark)' }}>
                  Step 3: Real Projects & Resume Context
                </h3>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      PROJECTS (OPTIONAL; COACH CAN ASK ABOUT THESE)
                    </label>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addProject}>
                      + Add Project
                    </button>
                  </div>

                  {projects.map((proj, idx) => (
                    <div key={idx} style={{ border: 'var(--border)', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem' }}>PROJECT #{idx + 1}</span>
                        {projects.length > 1 && (
                          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--pink)', cursor: 'pointer', fontWeight: 700 }} onClick={() => removeProject(idx)}>
                            Delete
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Project Name (e.g., E-commerce Platform)"
                        className="input"
                        style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', border: 'var(--border)' }}
                        value={proj.name}
                        onChange={(e) => updateProject(idx, 'name', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Tech Stack (e.g., React, Node.js, PostgreSQL)"
                        className="input"
                        style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', border: 'var(--border)' }}
                        value={proj.tech}
                        onChange={(e) => updateProject(idx, 'tech', e.target.value)}
                      />
                      <textarea
                        placeholder="Brief description & key responsibilities..."
                        className="input"
                        style={{ width: '100%', minHeight: '60px', padding: '0.5rem', border: 'var(--border)', resize: 'vertical' }}
                        value={proj.description}
                        onChange={(e) => updateProject(idx, 'description', e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    TARGET JOB DESCRIPTION / FOCUS
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', padding: '0.75rem', border: 'var(--border)' }}
                    placeholder="e.g. Growth stage startup looking for full-stack engineer"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    RESUME SUMMARY / EXTRA NOTES (OPTIONAL)
                  </label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: '80px', padding: '0.75rem', border: 'var(--border)', resize: 'vertical' }}
                    placeholder="Paste bullet points or summary from resume..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                    ← Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Creating Coach Profile...' : '🚀 Save Profile & Launch'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
