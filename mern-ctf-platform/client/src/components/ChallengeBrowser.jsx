import { useState, useEffect } from 'react';
import api from '../utils/api';
import { categoryConfig, categoryOrder, categoryScheme, rgbaOf } from '../utils/categories';

function ChallengeRow({ ch, progress, selfIdentity, isSelected, onOpen, isAdmin, onChanged }) {
  const status = progress?.status || 'not_tried';
  const solved = status === 'solved';
  const tried = status === 'tried';
  const practice = ch.submission_enabled === 0;
  const solvers = ch.solves?.solvers || [];
  const solveCount = ch.solves?.count ?? 0;
  let blood = null;
  if (selfIdentity) {
    if (solvers[0] === selfIdentity) blood = 'gold';
    else if (solvers[1] === selfIdentity) blood = 'silver';
    else if (solvers[2] === selfIdentity) blood = 'bronze';
  }

  const bloodColors = {
    gold: { fg: '#ffd700', wash: 'rgba(255, 215, 0, 0.12)' },
    silver: { fg: '#d0d5dd', wash: 'rgba(224, 226, 231, 0.14)' },
    bronze: { fg: '#e2a17c', wash: 'rgba(205, 127, 50, 0.14)' },
  };

  return (
    <li id={`chall-${ch._id}`}>
      <div
        role="button"
        tabIndex={0}
        className="rctf-row"
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
        }}
        data-solved={solved && !blood ? '' : undefined}
        data-blood={blood ?? undefined}
        data-selected={isSelected ? '' : undefined}
        data-tried={tried ? '' : undefined}
      >
        {blood && (
          <i
            className={`fas fa-medal`}
            data-indicator
            style={{ color: bloodColors[blood].fg }}
          />
        )}
        {!blood && solved && <i className="fas fa-check" data-indicator style={{ color: '#4ade80' }} />}

        <item-main>
          <item-title>
            <span data-part="category">{ch.category} /</span>
            <span data-part="name">{ch.name}</span>
          </item-title>
          <span data-part="meta">
            {practice && <span className="rctf-pill"><i className="fas fa-dumbbell" />Practice</span>}
            {!practice && ch.submission_enabled === 1 && <span className="rctf-open">Open</span>}
          </span>
        </item-main>

        <item-score>
          <span data-part="points">
            <strong>{ch.point.toLocaleString()}</strong> pts
          </span>
          <span data-part="solves">{solveCount.toLocaleString()} {solveCount === 1 ? 'solve' : 'solves'}</span>
        </item-score>

        {isAdmin && (
          <item-admin onClick={e => e.stopPropagation()}>
            <button
              type="button"
              style={adminBtn(ch)}
              onClick={async () => { try { await api.put(`/admin/challenges/${ch._id}/toggle-visibility`); onChanged(); } catch {} }}
              title={ch.visibility === 0 ? 'Hidden — click to show' : 'Visible — click to hide'}
            >
              <i className={`fas ${ch.visibility === 0 ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
            <button
              type="button"
              style={adminBtn(ch)}
              onClick={async () => { try { await api.put(`/admin/challenges/${ch._id}/toggle-submission`); onChanged(); } catch {} }}
              title={practice ? 'Practice (locked) — click to open for points' : 'Open — click to lock (practice only)'}
            >
              <i className={`fas ${practice ? 'fa-lock' : 'fa-lock-open'}`} />
            </button>
            <button
              type="button"
              style={adminBtn(ch)}
              onClick={async () => { if (!window.confirm('Delete this challenge?')) return; try { await api.delete(`/admin/challenges/${ch._id}`); onChanged(); } catch {} }}
              title="Delete challenge"
            >
              <i className="fas fa-trash" />
            </button>
          </item-admin>
        )}
      </div>
    </li>
  );
}

function adminBtn(ch) {
  return {
    padding: '0.15rem 0.4rem',
    fontSize: '0.65rem',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.04)',
  };
}

function ChallengeBrowser({
  challenges,
  categories,
  filter,
  setFilter,
  solveFilter,
  setSolveFilter,
  userProgress,
  user,
  selfIdentity,
  selected,
  openChallenge,
  onChanged,
}) {
  const isAdmin = !!user && (user.role === 0 || user.role === 2);
  const [query, setQuery] = useState('');
  const [hideSolved, setHideSolved] = useState(() => localStorage.getItem('rctf:hideSolved') === '1');
  const [collapsed, setCollapsed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('rctf:collapsed') || '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('rctf:hideSolved', hideSolved ? '1' : '0');
  }, [hideSolved]);
  useEffect(() => {
    localStorage.setItem('rctf:collapsed', JSON.stringify([...collapsed]));
  }, [collapsed]);

  const searching = query.trim().length > 0;
  const effCollapsed = searching || filter !== 'all' || solveFilter !== 'all' ? new Set() : collapsed;

  const group = s => String(s || '').toLowerCase();
  const allChallenges = Object.values(challenges).flat();

  const stats = allChallenges.reduce((acc, c) => {
    acc.totalPts += c.point || 0;
    if (userProgress[c._id]?.status === 'solved') {
      acc.earnedPts += c.point || 0;
      acc.solved++;
    }
    acc.total++;
    return acc;
  }, { earnedPts: 0, totalPts: 0, solved: 0, total: 0 });

  const visibleGroups = Object.entries(challenges)
    .filter(([cat]) => filter === 'all' || cat === filter)
    .map(([cat, chs]) => {
      const list = chs.filter(c => {
        if (solveFilter === 'open' && c.submission_enabled !== 1) return false;
        if (solveFilter === 'locked' && c.submission_enabled !== 0) return false;
        if (searching && !group(c.name).includes(query.trim().toLowerCase()) && !group(cat).includes(query.trim().toLowerCase())) return false;
        if (hideSolved && userProgress[c._id]?.status === 'solved' && selected?._id !== c._id) return false;
        return true;
      });
      return [cat, list];
    })
    .filter(([, list]) => list.length > 0)
    .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b));

  const anyCollapsed = visibleGroups.some(([cat]) => effCollapsed.has(cat));
  const allCategoryKeys = visibleGroups.map(([cat]) => cat);

  const toggleCat = cat => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleCollapseAll = () => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (anyCollapsed) {
        allCategoryKeys.forEach(k => next.delete(k));
      } else {
        allCategoryKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  return (
    <div className="rctf-list">
      <div className="rctf-head">
        <div className="rctf-stats">
          <span className="rctf-stat"><strong>{stats.earnedPts.toLocaleString()}</strong> / {stats.totalPts.toLocaleString()} pts</span>
          <span className="rctf-stat"><strong>{stats.solved.toLocaleString()}</strong> / {stats.total.toLocaleString()}</span>
        </div>
        <div className="rctf-controls">
          <label className="rctf-search">
            <i className="fas fa-search"></i>
            <input type="search" value={query} placeholder="Search challenges..." spellCheck={false} autoCapitalize="off" autoComplete="off" onChange={e => setQuery(e.target.value)} />
          </label>
          <div className="rctf-toggle-group">
            <button type="button" data-slot="hide-solved" data-active={hideSolved || undefined} title={hideSolved ? 'Show solved' : 'Hide solved'} aria-pressed={hideSolved} onClick={() => setHideSolved(v => !v)}>
              <i className={`fas ${hideSolved ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
            <button type="button" data-slot="collapse" data-active={!anyCollapsed || undefined} title={anyCollapsed ? 'Expand all' : 'Collapse all'} onClick={toggleCollapseAll}>
              <i className={`fas ${anyCollapsed ? 'fa-expand' : 'fa-compress'}`} />
            </button>
          </div>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="rctf-empty">
          <i className="fas fa-puzzle-piece" />
          <p>{searching ? 'Try a different search term.' : hideSolved ? 'All challenges have been solved!' : 'No challenges available.'}</p>
        </div>
      ) : (
        <div className="rctf-scroll">
          {visibleGroups.map(([cat, chs]) => {
            const cfg = categoryConfig(cat);
            const scheme = categoryScheme(cat);
            const collapsedCats = effCollapsed.has(cat);
            const solvedInCat = (challenges[cat] || []).filter(c => userProgress[c._id]?.status === 'solved').length;
            return (
              <div key={cat} className="rctf-group"
                style={{
                  '--rctf-bg-l0': scheme.l0,
                  '--rctf-bg-l1': scheme.l1,
                  '--rctf-bg-row': rgbaOf(scheme.f1, 0.06),
                  '--rctf-fg-l0': scheme.f0,
                  '--rctf-fg-l1': scheme.f1,
                  '--rctf-ring': rgbaOf(scheme.f1, 0.25),
                  '--rctf-hdr': rgbaOf(scheme.f1, 0.16),
                  '--rctf-hdr-line': rgbaOf(scheme.f1, 0.45),
                }}
              >
                <div className="rctf-group-header">
                  <button type="button" aria-expanded={!collapsedCats} data-expanded={!collapsedCats || undefined} onClick={() => toggleCat(cat)}>
                    <i className={`fas ${cfg.icon}`} data-slot="icon" />
                    <span data-slot="name">{cfg.name}</span>
                    <span data-slot="count"><strong>{solvedInCat}</strong> / {(challenges[cat] || []).length}</span>
                    <i className="fas fa-chevron-down" data-slot="chevron" />
                  </button>
                </div>
                {!collapsedCats && (
                  <div className="rctf-group-body">
                    <ul>
                      {chs.map(ch => (
                        <ChallengeRow
                          key={ch._id}
                          ch={ch}
                          progress={userProgress[ch._id]}
                          selfIdentity={selfIdentity}
                          isSelected={selected?._id === ch._id}
                          onOpen={() => openChallenge(ch)}
                          isAdmin={isAdmin}
                          onChanged={onChanged}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .rctf-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .rctf-head {
          display: flex; flex-direction: column; gap: 0.6rem;
          padding: 0.85rem 1rem;
          background: var(--bg-surface); border: 1px solid rgba(255,255,255,0.06);
          border-radius: var(--radius-md);
        }
        .rctf-stats {
          display: flex; justify-content: space-between;
          color: var(--text-muted); font-size: 0.8rem; font-variant-numeric: tabular-nums;
        }
        .rctf-stat strong { color: var(--text-primary); font-weight: 600; }
        .rctf-controls { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .rctf-controls .rctf-toggle-group { display: flex; gap: 0.4rem; margin-left: auto; }
        .rctf-search {
          display: flex; flex: 1; min-width: 180px; align-items: center; gap: 0.5rem;
          height: 2.4rem; padding: 0 0.8rem; color: var(--text-muted);
          background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
        }
        .rctf-search:focus-within { outline: 2px solid rgba(99,102,241,0.5); }
        .rctf-search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 0.85rem; }
        .rctf-search input::placeholder { color: var(--text-muted); }
        .rctf-toggle-group button {
          display: inline-flex; align-items: center; justify-content: center;
          height: 2.4rem; width: 2.6rem; color: var(--text-primary); font-size: 1rem;
          background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.06);
          border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease;
        }
        .rctf-toggle-group button:hover { background: rgba(255,255,255,0.08); }
        .rctf-toggle-group button[data-active] { color: var(--accent); background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); }

        .rctf-scroll { display: flex; flex-direction: column; gap: 0.75rem; }
        .rctf-empty {
          display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          padding: 2.5rem 1rem; color: var(--text-muted);
          background: var(--bg-surface); border: 1px solid rgba(255,255,255,0.06);
          border-radius: var(--radius-md);
        }
        .rctf-empty i { font-size: 1.6rem; opacity: 0.7; }
        .rctf-empty p { margin: 0; font-size: 0.85rem; }

        .rctf-group {
          background: var(--rctf-bg-l1);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .rctf-group-header {
          position: relative;
          background: linear-gradient(90deg, var(--rctf-hdr) 0%, var(--rctf-bg-l0) 65%, transparent 100%);
          border-bottom: 1px solid var(--rctf-hdr-line);
        }
        .rctf-group-header::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--rctf-fg-l1);
        }
        .rctf-group-header:hover { filter: brightness(1.12); }
        .rctf-group-header button {
          display: flex; align-items: center; gap: 0.625rem;
          width: 100%; padding: 0.6rem 0.9rem 0.6rem 0.95rem; text-align: left;
          color: var(--rctf-fg-l1); background: transparent;
          border: 0; cursor: pointer; font-family: var(--font-sans);
          transition: filter 0.15s ease;
        }
        .rctf-group-header [data-slot='icon'] { flex-shrink: 0; font-size: 1rem; color: var(--rctf-fg-l1); text-shadow: 0 0 10px var(--rctf-ring); }
        .rctf-group-header [data-slot='name'] { font-size: 1rem; font-weight: 700; letter-spacing: 0.02em; color: var(--rctf-fg-l0); }
        .rctf-group-header [data-slot='count'] { margin-left: auto; color: var(--rctf-fg-l1); white-space: nowrap; font-size: 0.82rem; font-variant-numeric: tabular-nums; background: var(--rctf-hdr); border: 1px solid var(--rctf-hdr-line); border-radius: 999px; padding: 0.12rem 0.6rem; }
        .rctf-group-header [data-slot='count'] strong { color: var(--rctf-fg-l0); font-weight: 600; }
        .rctf-group-header [data-slot='chevron'] { flex-shrink: 0; font-size: 0.8rem; color: var(--rctf-fg-l1); transform: rotate(-90deg); transition: transform 150ms ease; }
        .rctf-group-header button[data-expanded] [data-slot='chevron'] { transform: rotate(0deg); }

        .rctf-group-body ul { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
        .rctf-group-body li { display: block; }

        .rctf-group-body li > .rctf-row {
          position: relative;
          display: flex; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.25rem 1rem;
          width: 100%; padding: 0.7rem 2.1rem 0.7rem 2.4rem;
          text-align: left; cursor: pointer;
          background: transparent; border: 0; font-family: var(--font-sans);
          font-size: 0.95rem; color: var(--text-primary);
          --edge-soft: transparent;
        }
        .rctf-group-body li > .rctf-row:focus-visible {
          outline: 2px solid var(--accent); outline-offset: -2px; z-index: 1;
        }
        .rctf-group-body li > .rctf-row:hover { background: var(--rctf-bg-row); }
        .rctf-group-body li > .rctf-row[data-tried] { box-shadow: inset 2px 0 0 rgba(248,113,113,0.5); }
        .rctf-group-body li > .rctf-row[data-solved] { --edge-color: var(--foreground-success, #4ade80); --edge-soft: rgba(74,222,128,0.10); }
        .rctf-group-body li > .rctf-row[data-blood='gold'] { --edge-color: #ffd700; --edge-soft: rgba(255,215,0,0.12); }
        .rctf-group-body li > .rctf-row[data-blood='silver'] { --edge-color: #d0d5dd; --edge-soft: rgba(224,226,231,0.14); }
        .rctf-group-body li > .rctf-row[data-blood='bronze'] { --edge-color: #e2a17c; --edge-soft: rgba(205,127,50,0.14); }
        .rctf-group-body li > .rctf-row[data-solved]::before,
        .rctf-group-body li > .rctf-row[data-blood]::before {
          content: ''; position: absolute; inset: 0 auto 0 0; width: 7rem; pointer-events: none;
          background: linear-gradient(to right, var(--edge-soft), transparent);
        }
        .rctf-group-body li > .rctf-row[data-selected] {
          box-shadow: inset 0 0 0 2px var(--rctf-ring);
          background: var(--rctf-bg-row);
        }
        .rctf-group-body li > .rctf-row[data-selected]::after {
          content: ''; position: absolute; inset: 0 0 0 auto; width: 12rem; pointer-events: none;
          background: linear-gradient(to left, var(--rctf-bg-l0), transparent);
        }
        .rctf-group-body li > .rctf-row > [data-indicator] {
          position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);
          font-size: 1rem; z-index: 1;
        }

        .rctf-group-body li > .rctf-row > item-main { position: relative; z-index: 1; display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .rctf-group-body li > .rctf-row > item-main item-title { display: flex; align-items: baseline; gap: 0.35rem; overflow: hidden; }
        .rctf-group-body li > .rctf-row > item-main item-title [data-part='category'] { display: none; color: var(--rctf-fg-l1); font-size: 0.95rem; }
        .rctf-group-body li > .rctf-row > item-main item-title [data-part='name'] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.08rem; font-weight: 600; color: var(--rctf-fg-l0); }
        .rctf-group-body li > .rctf-row > item-main [data-part='meta'] { display: flex; align-items: center; gap: 0.4rem; min-height: 1.05rem; }
        .rctf-pill {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-size: 0.62rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase;
          color: #facc15; background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35); border-radius: 8px; padding: 0.08rem 0.5rem;
        }
        .rctf-open { display: inline-flex; align-items: center; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: rgba(74,222,128,0.85); opacity: 0.8; }

        .rctf-group-body li > .rctf-row > item-score { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .rctf-group-body li > .rctf-row > item-score [data-part='points'] { font-size: 1.1rem; color: var(--rctf-fg-l1); }
        .rctf-group-body li > .rctf-row > item-score [data-part='points'] strong { color: var(--rctf-fg-l0); font-weight: 600; }
        .rctf-group-body li > .rctf-row > item-score [data-part='solves'] { font-size: 0.7rem; color: var(--rctf-fg-l1); opacity: 0.75; }

        .rctf-group-body li > .rctf-row > item-admin { position: relative; z-index: 2; display: none; gap: 0.3rem; }
        .rctf-group-body li > .rctf-row:hover > item-admin { display: flex; }

        @media (min-width: 640px) {
          .rctf-group-body li > .rctf-row > item-main item-title [data-part='category'] { display: inline; }
        }
        @media (max-width: 600px) {
          .rctf-group-body li > .rctf-row > item-admin { display: flex; }
          .rctf-group-body li > .rctf-row > item-score { align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

export default ChallengeBrowser;