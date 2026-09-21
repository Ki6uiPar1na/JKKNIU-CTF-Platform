import { useState, useEffect } from 'react';
import { sanitize } from '../utils/sanitize';
import api from '../utils/api';
import { categoryConfig, categoryScheme, rgbaOf } from '../utils/categories';

function ChallengeDetailsView({ challenge, userProgress, onSubmit, onClose }) {
  const [flag, setFlag] = useState('');
  const [hints, setHints] = useState([]);
  const [paidHints, setPaidHints] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [hintsLoading, setHintsLoading] = useState(false);
  const [revealing, setRevealing] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    setFlag('');
    setActiveTab('details');
    const contestId = window.location.pathname.split('/')[2];
    if (!contestId) return;
    setHintsLoading(true);
    api.get(`/contests/${contestId}/challenges/${challenge._id}/hints`)
      .then(res => {
        if (res.data.success) {
          setHints(res.data.hints || []);
          setPaidHints(res.data.paid_hints || []);
          const ids = {};
          (res.data.revealed_ids || []).forEach(id => { ids[id] = true; });
          setRevealed(ids);
        }
      })
      .catch(() => {})
      .finally(() => setHintsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge._id]);

  const progress = userProgress[challenge._id] || {};
  const solved = progress.status === 'solved';
  const isPractice = challenge.submission_enabled === 0;
  const cfg = categoryConfig(challenge.category);
  const scheme = categoryScheme(challenge.category);
  const allHints = [...hints, ...paidHints];
  const solvers = challenge.solves?.solvers || [];
  const solveCount = challenge.solves?.count ?? 0;

  const handleRevealHint = async hintId => {
    const contestId = window.location.pathname.split('/')[2];
    setRevealing(hintId);
    try {
      const res = await api.post(`/contests/${contestId}/hints/${hintId}/reveal`);
      if (res.data.success) {
        setRevealed(prev => ({ ...prev, [hintId]: true }));
      }
    } catch { /* keep silent */ }
    finally { setRevealing(null); }
  };

  const submitDisabled =
    !flag.trim() ||
    solved ||
    (challenge.submission_enabled === 1 && progress.remaining_attempts === 0);

  return (
    <div className="cde" style={{ '--cde-l0': scheme.l0, '--cde-f1': scheme.f1, '--cde-f0': scheme.f0, '--cde-ring': rgbaOf(scheme.f1, 0.25) }}>

      <div className="cde-head">
        <div className="cde-head-main">
          <div className="cde-title-row">
            <h3 className="cde-title">{challenge.name}</h3>
            <button type="button" className="cde-close" onClick={onClose} title="Close" aria-label="Close">
              <i className="fas fa-xmark"></i>
            </button>
          </div>
          <div className="cde-meta">
            <span className="cde-chip" style={{ background: 'var(--cde-l0)', color: 'var(--cde-f1)' }}>
              <i className={`fas ${cfg.icon}`}></i>{cfg.name}
            </span>
            {solved && <span className="cde-chip cde-chip-solved"><i className="fas fa-check"></i>Solved</span>}
            {isPractice && <span className="cde-chip cde-chip-practice"><i className="fas fa-dumbbell"></i>Practice</span>}
            <span className="cde-chip"><i className="fas fa-user-check"></i>{solveCount} {solveCount === 1 ? 'solve' : 'solves'}</span>
          </div>
        </div>
        <div className="cde-score">
          <span className="cde-points">{challenge.point.toLocaleString()} <small>pts</small></span>
        </div>
      </div>

      <div className="cde-tabs">
        <button type="button" className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
          <i className="fas fa-file-lines"></i> Details
        </button>
        <button type="button" className={activeTab === 'solvers' ? 'active' : ''} onClick={() => setActiveTab('solvers')}>
          <i className="fas fa-trophy"></i> Solvers
          <span className="cde-tab-count">{solveCount}</span>
        </button>
      </div>

      <div className="cde-scroll">
        {activeTab === 'details' ? (
          <div className="cde-overview">
            <h5 className="cde-section"><i className="fas fa-align-left"></i>Description</h5>
            <div className="cde-desc" dangerouslySetInnerHTML={{ __html: sanitize(challenge.description) }} />

            {allHints.length > 0 && (
              <>
                <h5 className="cde-section"><i className="fas fa-lightbulb"></i>Hints</h5>
                <div className="cde-hints">
                  {hintsLoading ? (
                    <div className="spinner-neon" style={{ height: '24px' }}></div>
                  ) : (
                    allHints.map(h => (
                      <div key={h._id} className="cde-hint">
                        {h.cost === 0 || revealed[h._id] || isPractice ? (
                          <span className="cde-hint-text">{h.content}</span>
                        ) : (
                          <div className="cde-hint-locked">
                            <span className="cde-hint-cost">Hint costs {h.cost} pts to reveal</span>
                            <button type="button" className="btn btn-neon-outline btn-sm py-0 px-2" style={{ fontSize: '0.75rem' }} disabled={revealing === h._id} onClick={() => handleRevealHint(h._id)}>
                              <i className="fas fa-eye me-1"></i> {revealing === h._id ? 'Revealing...' : `Reveal (${h.cost} pts)`}
                            </button>
                          </div>
                        )}
                        <span className={`badge ${h.cost === 0 ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '0.6rem' }}>
                          {h.cost === 0 ? (isPractice ? 'Free (practice)' : 'Free') : `${h.cost} pts`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="cde-solvers">
            <div className="cde-solvers-head">
              <i className="fas fa-trophy"></i>
              {solveCount} {solveCount === 1 ? 'solve' : 'solves'} on this challenge
            </div>
            {solvers.length > 0 ? (
              solvers.map((name, i) => (
                <div key={name} className="cde-solver">
                  <span className="cde-solver-rank">{i + 1}</span>
                  <i className="fas fa-user"></i>
                  <span>{name}</span>
                  {i === 0 && <span className="cde-blood cde-blood-gold"><i className="fas fa-medal"></i></span>}
                  {i === 1 && <span className="cde-blood cde-blood-silver"><i className="fas fa-medal"></i></span>}
                  {i === 2 && <span className="cde-blood cde-blood-bronze"><i className="fas fa-medal"></i></span>}
                </div>
              ))
            ) : (
              <p className="cde-solvers-empty">No one has solved this challenge yet. Be the first!</p>
            )}
          </div>
        )}
      </div>

      {challenge.files && challenge.files.length > 0 && (
        <div className="cde-files-dock">
          <h5 className="cde-section cde-files-head"><i className="fas fa-paperclip"></i>Attachments</h5>
          <div className="cde-files">
            {challenge.files.map((f, i) => (
              <div key={i} className="cde-file">
                <i className="fas fa-file-arrow-down" data-slot="fileicon"></i>
                <span className="cde-file-name">{f.split('/').pop()}</span>
                <a href={f} target="_blank" rel="noopener noreferrer" download className="cde-dl-btn">
                  <i className="fas fa-download"></i> Download Attachment
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cde-foot">
        {isPractice && (
          <div className="cde-practice-note"><i className="fas fa-dumbbell me-2"></i><strong>Practice mode.</strong> You can still test your flag here, but no points are awarded.</div>
        )}
        {solved && (
          <div className="cde-solved-note"><i className="fas fa-check-circle me-2"></i>Challenge solved — score already counted.</div>
        )}
        <div className="cde-flag-row">
          <input
            type="text"
            className="form-control"
            value={flag}
            disabled={solved}
            onChange={e => setFlag(e.target.value)}
            placeholder="FLAG{...}"
            onKeyDown={e => { if (e.key === 'Enter' && flag.trim() && !submitDisabled) onSubmit(flag); }}
          />
          <button type="button" className="btn btn-neon btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => onSubmit(flag)} disabled={submitDisabled}>
            <i className="fas fa-paper-plane me-1"></i> Submit
          </button>
        </div>
        <div className="cde-attempts small">
          <span><i className="fas fa-bomb me-1"></i>Max attempts: {isPractice ? 'Unlimited (practice)' : challenge.max_attempts}</span>
          <span><i className="fas fa-upload me-1"></i>Submissions: {progress.total_submissions || 0}</span>
          {challenge.submission_enabled === 1 && !solved && (
            <span><i className="fas fa-shield-alt me-1"></i>Remaining: {progress.remaining_attempts ?? challenge.max_attempts}</span>
          )}
        </div>
      </div>

      <style>{`
        .cde {
          display: flex; flex-direction: column;
          height: 100%; min-height: 0;
          background: var(--bg-surface);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .cde-head {
          display: flex; justify-content: space-between; gap: 1rem;
          padding: 1rem 1.1rem 0.75rem;
        }
        .cde-head-main { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; flex: 1; }
        .cde-title-row { display: flex; align-items: center; gap: 0.5rem; }
        .cde-title { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .cde-close {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.7rem; height: 1.7rem; flex-shrink: 0;
          color: var(--text-secondary); background: var(--bg-elevated);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .cde-close:hover { color: var(--text-primary); background: rgba(255,255,255,0.08); }
        .cde-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .cde-chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.15rem 0.6rem; border-radius: 14px; font-size: 0.72rem; white-space: nowrap;
          color: var(--text-secondary); background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .cde-chip-solved { color: #4ade80; background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.3); }
        .cde-chip-practice { color: #facc15; background: rgba(250,204,21,0.1); border-color: rgba(250,204,21,0.3); }
        .cde-score { flex-shrink: 0; display: flex; align-items: flex-start; }
        .cde-points { font-size: 1.35rem; font-weight: 700; color: var(--cde-f0); font-variant-numeric: tabular-nums; }
        .cde-points small { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; }

        .cde-tabs {
          display: flex; gap: 0.25rem; padding: 0 1.1rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .cde-tabs button {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.5rem 0.7rem; font-size: 0.82rem;
          color: var(--text-secondary); background: transparent; border: 0;
          border-bottom: 2px solid transparent; cursor: pointer;
          font-family: var(--font-sans);
        }
        .cde-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
        .cde-tab-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 1.15rem; height: 1.15rem; padding: 0 0.3rem;
          font-size: 0.62rem; border-radius: 8px;
          color: var(--rctf-fg-l1, var(--text-secondary)); background: rgba(255,255,255,0.08);
        }

        .cde-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: none; padding: 0.9rem 1.1rem 1.1rem; }
        .cde-overview { display: flex; flex-direction: column; gap: 0.75rem; }
        .cde-section { margin: 0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; }
        .cde-section::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); margin-left: 0.35rem; }
        .cde-desc { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }

        .cde-files { display: flex; flex-direction: column; gap: 0.3rem; }
        .cde-files-dock {
          flex-shrink: 0; display: flex; flex-direction: column; gap: 0.45rem;
          padding: 0.5rem 1.1rem 0.6rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.015);
        }
        .cde-files-head { margin: 0; font-size: 0.7rem; }
        .cde-file {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.4rem 0.6rem;
          background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.05); border-radius: var(--radius);
        }
        .cde-file [data-slot='fileicon'] { color: var(--text-muted); font-size: 0.9rem; flex-shrink: 0; }
        .cde-dl-btn {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.32rem 0.7rem; font-size: 0.75rem; white-space: nowrap;
          color: var(--accent); text-decoration: none;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.35); border-radius: var(--radius);
          transition: background 0.15s ease;
        }
        .cde-dl-btn:hover { background: rgba(99,102,241,0.24); color: var(--accent); }

        .cde-hints { display: flex; flex-direction: column; gap: 0.4rem; }
        .cde-hint {
          padding: 0.5rem 0.7rem; background: rgba(250,204,21,0.05);
          border-left: 3px solid #facc15; border-radius: var(--radius);
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
        }
        .cde-hint-text { font-size: 0.85rem; flex: 1; min-width: 0; }
        .cde-hint-locked { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .cde-hint-cost { color: var(--text-muted); font-size: 0.82rem; font-style: italic; }

        .cde-solvers { display: flex; flex-direction: column; gap: 0.35rem; }
        .cde-solvers-head { display: flex; align-items: center; gap: 0.5rem; color: #4ade80; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.4rem; }
        .cde-solver {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.45rem 0.7rem; background: rgba(255,255,255,0.03); border-radius: var(--radius);
          font-size: 0.88rem;
        }
        .cde-solver-rank { color: var(--accent); font-size: 0.78rem; width: 1.4rem; font-variant-numeric: tabular-nums; }
        .cde-solver > i.fa-user { color: var(--text-secondary); }
        .cde-solvers-empty { color: var(--text-secondary); font-size: 0.88rem; }
        .cde-blood { margin-left: auto; font-size: 0.85rem; }
        .cde-blood-gold { color: #ffd700; }
        .cde-blood-silver { color: #d0d5dd; }
        .cde-blood-bronze { color: #e2a17c; }

        .cde-foot {
          flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem;
          padding: 0.7rem 1.1rem 0.9rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.015);
        }
        .cde-practice-note { font-size: 0.78rem; color: #facc15; background: rgba(250,204,21,0.08); border: 1px solid rgba(250,204,21,0.25); border-radius: var(--radius); padding: 0.4rem 0.6rem; }
        .cde-solved-note { font-size: 0.78rem; color: #4ade80; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25); border-radius: var(--radius); padding: 0.4rem 0.6rem; }
        .cde-flag-row { display: flex; gap: 0.5rem; }
        .cde-flag-row .form-control { font-family: var(--font-mono, monospace); }
        .cde-attempts { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; color: var(--text-muted); margin-top: 0.1rem; }

        .cde-empty { align-items: center; justify-content: center; text-align: center; gap: 0.6rem; display: flex; }
        .cde-empty i { font-size: 2rem; color: var(--text-muted); opacity: 0.7; }
        .cde-empty h5 { margin: 0; color: var(--text-secondary); font-weight: 600; }
        .cde-empty p { margin: 0; color: var(--text-muted); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}

export function ChallengeDetailsPane({ challenge, userProgress, onSubmit, onClose }) {
  if (!challenge) {
    return (
      <div className="cde cde-empty">
        <i className="fas fa-flag-banner"></i>
        <h5>Select a challenge</h5>
        <p>Choose a challenge from the list to view details</p>
      </div>
    );
  }
  return <ChallengeDetailsView challenge={challenge} userProgress={userProgress} onSubmit={onSubmit} onClose={onClose} />;
}

export function ChallengeDrawer({ open, challenge, userProgress, onSubmit, onClose }) {
  if (!open) return null;
  return (
    <div className="cde-drawer-backdrop" onClick={onClose}>
      <div className="cde-drawer-sheet" onClick={e => e.stopPropagation()}>
        {challenge ? (
          <ChallengeDetailsView challenge={challenge} userProgress={userProgress} onSubmit={onSubmit} onClose={onClose} />
        ) : null}
      </div>
      <style>{`
        .cde-drawer-backdrop {
          position: fixed; inset: 0; z-index: 1045;
          display: flex; align-items: flex-end; justify-content: center;
          background: rgba(8,10,22,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          animation: cdeFade 0.25s ease;
        }
        .cde-drawer-sheet {
          width: 100%; max-width: 720px; height: min(88dvh, 640px);
          animation: cdeSlideUp 0.3s ease;
        }
        @keyframes cdeFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdeSlideUp { from { transform: translateY(24px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

export default ChallengeDetailsPane;