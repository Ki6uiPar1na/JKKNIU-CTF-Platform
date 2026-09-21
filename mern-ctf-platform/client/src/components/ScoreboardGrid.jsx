import { useMemo, useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import ScoreboardGraphPanel from './ScoreboardGraphPanel';
import { categoryScheme, rgbaOf } from '../utils/categories';

const BLOOD_PATHS = [
  'M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m.994 5.886c-.083-.777-1.008-1.16-1.617-.67l-.084.077l-2 2l-.083.094a1 1 0 0 0 0 1.226l.083.094l.094.083a1 1 0 0 0 1.226 0l.094-.083l.293-.293V16l.007.117a1 1 0 0 0 1.986 0L13 16V8z',
  'M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m1 5h-3l-.117.007a1 1 0 0 0 0 1.986L10 9h3v2h-2l-.15.005a2 2 0 0 0-1.844 1.838L9 13v2l.005.15a2 2 0 0 0 1.838 1.844L11 17h3l.117-.007a1 1 0 0 0 0-1.986L14 15h-3v-2h2l.15-.005a2 2 0 0 0 1.844-1.838L15 11V9l-.005-.15a2 2 0 0 0-1.838-1.844z',
  'M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m1 5h-2l-.15.005A2 2 0 0 0 9 9a1 1 0 0 0 1.974.23l.02-.113L11 9h2v2h-2l-.133.007c-1.111.12-1.154 1.73-.128 1.965l.128.021L11 13h2v2h-2l-.007-.117A1 1 0 0 0 9 15a2 2 0 0 0 1.85 1.995L11 17h2l.15-.005a2 2 0 0 0 1.844-1.838L15 15v-2l-.005-.15a2 2 0 0 0-.17-.667l-.075-.152l-.019-.032l.02-.03a2 2 0 0 0 .242-.795L15 11V9l-.005-.15a2 2 0 0 0-1.838-1.844z',
];

const BLOOD_LABELS = ['First blood', 'Second blood', 'Third blood'];
const MEDAL_COLORS = ['#ffd700', '#d7dbe0', '#cd7f32'];
const RANK_COLORS = { 1: '#ffd700', 2: '#d7dbe0', 3: '#cd7f32' };

const HEAD_H = 132;
const ROW_H = 51;
const TEAM_COL_W = 300;
const CAT_WIDTH = 124;
const SL_WINDOW = 12 * 60 * 60 * 1000;
const DELTA_WINDOW = 2 * 60 * 60 * 1000;
const SCREENSHOT_CSS_VARS = [
  '--accent', '--accent-dim', '--accent-subtle', '--bg-body', '--bg-surface', '--bg-elevated',
  '--bg-input', '--bg-hover', '--text-primary', '--text-secondary', '--text-muted',
  '--radius-sm', '--radius-md', '--radius-lg', '--shadow-md', '--shadow-lg',
  '--font-sans', '--font-mono',
  '--category-web', '--category-crypto', '--category-pwn', '--category-osint',
  '--category-forensic', '--category-stego', '--category-misc', '--category-reverse',
];

const catColor = (cat) => categoryScheme(cat).f1;
const catWash = (cat, alpha) => rgbaOf(categoryScheme(cat).f1, alpha);

const titleCase = (s) =>
  String(s || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const entryInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || '');
  return (a + b).toUpperCase();
};

const entryGradient = (name) => {
  const h = (String(name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 360;
  return `linear-gradient(135deg, hsl(${h},70%,45%), hsl(${(h + 60) % 360},70%,35%))`;
};

function formatRel(ms, startMs) {
  const diff = Math.max(0, (ms || 0) - (startMs || 0));
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  const d = Math.floor(hr / 24);
  return `${d}d ${hr % 24}h`;
}

function BloodIcon({ medal }) {
  return (
    <svg
      className="sgx-medal"
      viewBox="0 0 24 24"
      style={{ color: MEDAL_COLORS[medal - 1] || '#94a3b8', verticalAlign: '-3px', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path fill="currentColor" d={BLOOD_PATHS[medal - 1]} />
    </svg>
  );
}

function SparkLine({ series, tierColor }) {
  const pts = useMemo(() => {
    const raw = (series?.data || []).map((p) => ({ t: new Date(p.time).getTime(), s: p.score || 0 }));
    if (raw.length < 2) return null;
    let windowStart = raw[raw.length - 1].t - SL_WINDOW;
    let sel = raw.filter((p) => p.t >= windowStart);
    if (sel.length < 2) { windowStart = raw[0].t; sel = raw; }
    const min = Math.min(...sel.map((p) => p.s));
    const max = Math.max(...sel.map((p) => p.s));
    const span = Math.max(1, max - min);
    const spanT = Math.max(1, sel[sel.length - 1].t - windowStart);
    return sel.map((p) => ({
      x: 1.5 + ((p.t - windowStart) / spanT) * 97,
      y: 1.5 + (1 - (p.s - min) / span) * 25,
    }));
  }, [series]);
  if (!pts) return null;
  return (
    <svg className="sgx-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
        fill="none"
        stroke={tierColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ScoreboardGrid({
  scoreboard = [],
  challengesByCategory = {},
  isTeamContest = false,
  selfName = '',
  startDate,
  contestId,
}) {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState(null);
  const [viewMode, setViewMode] = useState('challenges');
  const [sortMode, setSortMode] = useState('category');
  const [hoverCol, setHoverCol] = useState(null);
  const [tip, setTip] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [visibleNames, setVisibleNames] = useState([]);
  const [hoveredName, setHoveredName] = useState(null);
  const [solveHighlight, setSolveHighlight] = useState(null);
  const [screenshotting, setScreenshotting] = useState(false);
  const [colWidth, setColWidth] = useState(58);
  const [catWidth, setCatWidth] = useState(CAT_WIDTH);

  const model = useMemo(() => {
    const chs = [];
    const catGroups = [];
    const solversByCh = new Map();
    Object.keys(challengesByCategory || {}).forEach((cat) => {
      const mapped = (challengesByCategory[cat] || [])
        .filter((ch) => ch && ch._id)
        .map((ch) => ({
          id: String(ch._id),
          name: ch.name,
          category: cat,
          points: Number(ch.point) || 0,
          solvesCount: Number(ch.solves?.count) || 0,
        }));
      if (!mapped.length) return;
      chs.push(...mapped);
      catGroups.push({
        category: cat,
        challenges: mapped,
        points: mapped.reduce((s, c) => s + c.points, 0),
        solvesCount: mapped.reduce((s, c) => s + c.solvesCount, 0),
        ids: new Set(mapped.map((c) => c.id)),
      });
    });

    (scoreboard || []).forEach((e) => {
      (e.solves || []).forEach((s) => {
        const cid = String(s.id);
        if (!solversByCh.has(cid)) solversByCh.set(cid, []);
        solversByCh.get(cid).push({ uid: e.user_id, t: new Date(s.solveTime).getTime() || 0 });
      });
    });

    const bloodMap = new Map();
    chs.forEach((ch) => {
      const mapper = new Map();
      const seen = new Set();
      let blood = 0;
      (solversByCh.get(ch.id) || [])
        .slice()
        .sort((a, b) => a.t - b.t)
        .forEach((s) => {
          if (seen.has(s.uid)) return;
          seen.add(s.uid);
          if (blood < 3) { mapper.set(s.uid, blood); blood += 1; }
        });
      bloodMap.set(ch.id, mapper);
    });

    return { all: chs, catGroups, bloodMap };
  }, [scoreboard, challengesByCategory]);

  const startMs = useMemo(() => (startDate ? new Date(startDate).getTime() : 0), [startDate]);

  useEffect(() => {
    let live = true;
    if (!contestId) return undefined;
    const include = selfName ? String(selfName) : '';
    const url =
      `/contests/${contestId}/scoreboard/timeline` +
      (include ? `?include=${encodeURIComponent(include)}` : '');
    api
      .get(url)
      .then((res) => {
        if (!live) return;
        setTimeline(res.data && res.data.success ? res.data.timeline || [] : []);
      })
      .catch(() => {
        if (live) setTimeline([]);
      });
    return () => { live = false; };
  }, [contestId, selfName, scoreboard]);

  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    let list = (scoreboard || []).slice();
    if (q) list = list.filter((e) => String(e.user_name || '').toLowerCase().includes(q));
    if (viewMode === 'categories' || !focusedId) {
      list.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      return list;
    }
    const timeOf = (e) =>
      Math.min(
        ...[...(e.solves || [])]
          .filter((s) => String(s.id) === focusedId)
          .map((s) => new Date(s.solveTime).getTime() || 0)
      );
    list = list.filter((e) => Number.isFinite(timeOf(e)));
    list.sort((a, b) => timeOf(a) - timeOf(b));
    return list;
  }, [scoreboard, q, focusedId, viewMode]);

  const columns = useMemo(() => {
    if (viewMode === 'categories') {
      return model.catGroups.map((g) => ({ type: 'category', key: `cat:${g.category}`, group: g }));
    }
    const toCol = (ch) => ({ type: 'challenge', key: `ch:${ch.id}`, challenge: ch });
    if (sortMode === 'solves') {
      return model.all
        .slice()
        .sort((a, b) => a.solvesCount - b.solvesCount || a.name.localeCompare(b.name))
        .map(toCol);
    }
    return model.all.map(toCol);
  }, [model, viewMode, sortMode]);

  useEffect(() => {
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const n = Math.max(1, model.all.length);
      const g = Math.max(1, model.catGroups.length);
      setColWidth(Math.max(58, Math.floor((w - TEAM_COL_W - 24) / n)));
      setCatWidth(Math.max(CAT_WIDTH, Math.floor((w - TEAM_COL_W - 24) / g)));
    };
    update();
    let ro = null;
    if (rootRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(rootRef.current);
    }
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [model.all.length, model.catGroups.length]);

  const seriesByName = useMemo(() => {
    const m = new Map();
    (timeline || []).forEach((s) => {
      if (s && s.user_name) m.set(String(s.user_name), s);
    });
    return m;
  }, [timeline]);

  const deltas = useMemo(() => {
    const m = new Map();
    const series = (timeline || []).filter((s) => s && s.user_name && (s.data || []).length);
    if (!series.length) return m;
    const scoreAt = (pts, t) => {
      let v = 0;
      for (const p of pts) {
        const pt = new Date(p.time).getTime();
        if (pt <= t) v = p.score || 0;
        else break;
      }
      return v;
    };
    const maxTime = Math.max(0, ...series.flatMap((s) => (s.data || []).map((p) => new Date(p.time).getTime())));
    const pastTime = maxTime - DELTA_WINDOW;
    const sorted = (fn) => {
      const map = {};
      series.forEach((s) => { map[String(s.user_name)] = fn(s); });
      return Object.keys(map).sort((a, b) => map[b] - map[a]);
    };
    const cur = sorted((s) => (s.data[s.data.length - 1]?.score) || 0);
    const past = sorted((s) => scoreAt(s.data, pastTime));
    series.forEach((s) => {
      const key = String(s.user_name);
      const pastRank = past.indexOf(key) + 1 || Infinity;
      const curRank = cur.indexOf(key) + 1 || Infinity;
      if (pastRank < Infinity && curRank < Infinity) m.set(key, pastRank - curRank);
    });
    return m;
  }, [timeline]);

  useEffect(() => {
    const update = () => {
      const sc = scrollRef.current;
      if (!sc || !rows.length) return;
      const tableTop = sc.getBoundingClientRect().top + window.scrollY;
      const startTop = tableTop + HEAD_H;
      const from = window.scrollY;
      const to = window.scrollY + window.innerHeight;
      const a = Math.max(0, Math.floor((from - startTop) / ROW_H));
      const b = Math.max(a, Math.min(rows.length, Math.ceil((to - startTop) / ROW_H)));
      setVisibleNames(rows.slice(a, b).map((r) => r.user_name));
    };
    update();
    window.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [rows]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFocus = (id) => {
    setFocusedId((cur) => {
      const next = cur === id ? null : id;
      if (next && scrollRef.current) {
        const top = scrollRef.current.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      }
      return next;
    });
  };

  const clearTip = () => setTip(null);

  const moveTip = (e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));

  const showCellTip = (e, name, lines) => {
    setTip({ x: e.clientX, y: e.clientY, above: e.clientY > 260, name, lines });
  };

  const challengeTooltipLines = (entry, ch) => {
    const solve = (entry.solves || [])
      .filter((s) => String(s.id) === ch.id)
      .sort((a, b) => (new Date(a.solveTime) || 0) - (new Date(b.solveTime) || 0))[0];
    const solved = !!solve;
    const blood = model.bloodMap.get(ch.id)?.get(entry.user_id);
    const lines = [];
    if (blood !== undefined) {
      lines.push({ text: `${ch.points} pts ·`, blood: blood + 1, label: BLOOD_LABELS[blood] });
    } else if (solved) {
      lines.push({ text: `${ch.points} pts · Solved` });
    } else {
      lines.push({ text: `${ch.points} pts · Unsolved` });
    }
    if (solved && solve.solveTime) {
      lines.push({ text: `${formatRel(new Date(solve.solveTime).getTime(), startMs)} into contest`, time: true });
    }
    return lines;
  };

  const shoot = async () => {
    const node = scrollRef.current;
    if (!node || !rootRef.current) return;
    setScreenshotting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const w = node.scrollWidth;
      const h = node.scrollHeight;
      const clone = rootRef.current.cloneNode(true);
      clone.querySelectorAll('[data-screenshot-hidden]').forEach((el) => el.parentNode?.removeChild(el));
      const sc = clone.querySelector('.sgx-scroll');
      if (sc) {
        sc.style.maxHeight = 'none';
        sc.style.overflow = 'visible';
      }
      const cs = getComputedStyle(document.documentElement);
      const vars = SCREENSHOT_CSS_VARS.map((v) => `${v}:${cs.getPropertyValue(v)};`).join('');
      const holder = document.createElement('div');
      holder.setAttribute(
        'style',
        `all:initial;width:${w}px;${vars}font-family:var(--font-sans);color:var(--text-primary);background:var(--bg-body);box-sizing:border-box;`
      );
      holder.appendChild(clone);
      const xml = new XMLSerializer().serializeToString(holder);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<foreignObject width="100%" height="100%" xmlns="http://www.w3.org/1999/xhtml">${xml}</foreignObject></svg>`;
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `scoreboard-${isTeamContest ? 'teams' : 'users'}.png`;
      a.click();
    } catch (err) {
      console.warn('Screenshot failed:', err);
    } finally {
      setScreenshotting(false);
    }
  };

  const rowColor = (entry, isSelf) => {
    if (isSelf) return '#6366f1';
    return RANK_COLORS[entry.rank] || '#64748b';
  };

  return (
    <div className="sgx" ref={rootRef} style={{ '--sgx-colw': `${colWidth}px`, '--sgx-catw': `${catWidth}px` }}>
      {model.all.length > 0 && (
        <div className="sgx-graphwrap" data-screenshot-hidden>
          <ScoreboardGraphPanel
            timeline={timeline || []}
            visibleNames={visibleNames}
            hoveredName={hoveredName}
            solveHighlight={solveHighlight}
            selfName={selfName}
            startMs={startMs}
          />
        </div>
      )}

      <div className="sgx-toolbar" data-screenshot-hidden>
        <div className="sgx-tleft">
          <div className="sgx-seg" role="tablist">
            <button
              type="button"
              role="tab"
              className="sgx-segbutton"
              data-active={viewMode === 'challenges' ? '' : undefined}
              aria-pressed={viewMode === 'challenges'}
              onClick={() => { setViewMode('challenges'); setFocusedId(null); }}
            >
              <i className="fas fa-table-cells-large"></i>Challenges
            </button>
            <button
              type="button"
              role="tab"
              className="sgx-segbutton"
              data-active={viewMode === 'categories' ? '' : undefined}
              aria-pressed={viewMode === 'categories'}
              onClick={() => { setViewMode('categories'); setFocusedId(null); }}
            >
              <i className="fas fa-layer-group"></i>Categories
            </button>
          </div>
          <div className="sgx-seg" role="group" aria-label="Sort mode" data-disabled={viewMode === 'categories' ? '' : undefined}>
            <button
              type="button"
              className="sgx-segbutton"
              data-active={viewMode === 'challenges' && sortMode === 'solves' ? '' : undefined}
              aria-pressed={viewMode === 'challenges' && sortMode === 'solves'}
              title="Sort by solves ascending"
              onClick={() => { if (viewMode === 'challenges') setSortMode('solves'); }}
            >
              <i className="fas fa-arrow-up-wide-short"></i>
            </button>
            <button
              type="button"
              className="sgx-segbutton"
              data-active={viewMode === 'challenges' && sortMode === 'category' ? '' : undefined}
              aria-pressed={viewMode === 'challenges' && sortMode === 'category'}
              title="Sort by category"
              onClick={() => { if (viewMode === 'challenges') setSortMode('category'); }}
            >
              <i className="fas fa-shapes"></i>
            </button>
          </div>
          {focusedId && (
            <div className="sgx-chip">
              <span>Filtering by</span>
              <b>{model.all.find((c) => c.id === focusedId)?.name || ''}</b>
              <button type="button" aria-label="Clear challenge filter" onClick={() => setFocusedId(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
          <span className="sgx-count">
            <i className="fas fa-users me-1"></i>
            {rows.length.toLocaleString()} / {scoreboard.length.toLocaleString()}
          </span>
        </div>
        <div className="sgx-tright">
          <button
            type="button"
            className="sgx-shot"
            disabled={screenshotting}
            title="Save scoreboard as PNG"
            onClick={shoot}
          >
            {screenshotting ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-camera"></i>
            )}
            <span>{screenshotting ? 'Capturing…' : 'Screenshot'}</span>
          </button>
          <div className="sgx-search">
            <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}></i>
            <input
              ref={searchRef}
              type="text"
              placeholder={`Search ${isTeamContest ? 'teams' : 'users'}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className="sgx-scroll"
        ref={scrollRef}
        onMouseLeave={() => { setHoverCol(null); setHoveredName(null); clearTip(); setSolveHighlight(null); }}
      >
        {model.all.length === 0 ? (
          <div className="sgx-empty">No challenges have been published yet.</div>
        ) : (
          <div className="sgx-table">
            <div className="sgx-header">
              <div className="sgx-corner">
                <span className="sgx-corner-label">{isTeamContest ? 'Team' : 'User'}</span>
                <span className="sgx-corner-score" style={{ alignSelf: 'flex-end' }}>Score</span>
              </div>
              <div className="sgx-hcells">
                {columns.map((col) => {
                  if (col.type === 'category') {
                    const g = col.group;
                    return (
                      <div
                        className="sgx-hcell sgx-hcat"
                        key={col.key}
                        style={{ '--cat-fg': catColor(g.category) }}
                        data-col={col.key}
                        data-hovercol={hoverCol === col.key ? '' : undefined}
                        onMouseEnter={(e) => {
                          setHoverCol(col.key);
                          showCellTip(e, titleCase(g.category), [
                            { text: `${g.challenges.length} challenge${g.challenges.length === 1 ? '' : 's'}` },
                            { text: `${g.points.toLocaleString()} pts total` },
                            { text: `${g.solvesCount.toLocaleString()} total solves` },
                          ]);
                        }}
                        onMouseLeave={() => { setHoverCol((c) => (c === col.key ? null : c)); clearTip(); }}
                        onMouseMove={moveTip}
                      >
                        <span className="sgx-hpts">{g.points.toLocaleString()}</span>
                        <span className="sgx-hname">{titleCase(g.category)}</span>
                        <span className="sgx-hband" style={{ background: catColor(g.category) }}></span>
                      </div>
                    );
                  }
                  const ch = col.challenge;
                  const focused = focusedId === ch.id;
                  const dim = viewMode === 'challenges' && focusedId !== null && !focused;
                  return (
                    <div
                      className="sgx-hcell"
                      key={col.key}
                      style={{ '--cat-fg': catColor(ch.category) }}
                      data-focused={focused || undefined}
                      data-dim={dim ? '' : undefined}
                      data-col={col.key}
                      data-hovercol={hoverCol === col.key ? '' : undefined}
                      onMouseEnter={(e) => {
                        setHoverCol(col.key);
                        showCellTip(e, ch.name, [
                          { text: titleCase(ch.category) },
                          { text: `${ch.points} pts` },
                          { text: `${ch.solvesCount} solve${ch.solvesCount === 1 ? '' : 's'}` },
                        ]);
                      }}
                      onMouseLeave={() => { setHoverCol((c) => (c === col.key ? null : c)); clearTip(); }}
                      onMouseMove={moveTip}
                    >
                      <span className="sgx-hpts">{ch.points}</span>
                      <button type="button" className="sgx-hname" onClick={() => toggleFocus(ch.id)}>
                        {ch.name}
                      </button>
                      <span className="sgx-hband" style={{ background: catColor(ch.category), boxShadow: `0 0 6px ${catWash(ch.category, 0.8)}` }}></span>
                    </div>
                  );
                })}
              </div>
            </div>

            {rows.length === 0 && (
              <div className="sgx-empty">
                {q
                  ? `No ${isTeamContest ? 'teams' : 'users'} match your search.`
                  : focusedId
                    ? 'No teams have solved this challenge yet.'
                    : viewMode === 'categories'
                      ? 'No categories to display.'
                      : 'No scores yet.'}
              </div>
            )}

            {rows.map((entry) => {
              const isSelf = !!selfName && String(entry.user_name) === String(selfName);
              const pinned = isSelf && !q && !focusedId;
              const delta = deltas.get(String(entry.user_name));
              const dcls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
              const dic = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
              const sparkSeries = seriesByName.get(String(entry.user_name));
              return (
                <div
                  className="sgx-row"
                  key={entry.user_id ?? `${entry.user_name}-${entry.rank}`}
                  data-self={isSelf ? '' : undefined}
                  data-pin={pinned ? '' : undefined}
                  onMouseEnter={() => setHoveredName(String(entry.user_name))}
                  onMouseLeave={() => setHoveredName((cur) => (cur === String(entry.user_name) ? null : cur))}
                >
                  <div className="sgx-team">
                    <div className="sgx-rank" style={{ color: rowColor(entry, isSelf) }}>
                      #{entry.rank}
                      <small>{entry.rank === 1 ? '1st' : entry.rank === 2 ? '2nd' : entry.rank === 3 ? '3rd' : ''}</small>
                      {pinned && delta !== undefined && (
                        <span className="sgx-delta" data-cls={dcls}>
                          {dic}{delta > 0 ? delta : delta < 0 ? -delta : ''}
                        </span>
                      )}
                    </div>
                    <div className="sgx-avatar" style={{ background: entryGradient(entry.user_name) }}>
                      {entryInitials(entry.user_name)}
                    </div>
                    <div className="sgx-nwrap">
                      <div className="sgx-namewrap">
                        <span className="sgx-name">{entry.user_name}</span>
                        {isSelf && <span className="sgx-you">You</span>}
                      </div>
                      <span className="sgx-solves">{(entry.solves || []).length} solve{(entry.solves || []).length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="sgx-sparkwrap">
                      <SparkLine series={sparkSeries} tierColor={rowColor(entry, isSelf)} />
                    </div>
                    <div className="sgx-score">
                      <b>{entry.total_score.toLocaleString()}</b>
                      <small>pts</small>
                    </div>
                  </div>
                  <div className="sgx-cells">
                    {columns.map((col) => {
                      if (col.type === 'category') {
                        const g = col.group;
                        const solvedCount = (entry.solves || []).filter((s) => g.ids.has(String(s.id))).length;
                        const total = g.challenges.length;
                        const allSolved = total > 0 && solvedCount === total;
                        return (
                          <div
                            className="sgx-cell sgx-catcell"
                            key={col.key}
                            data-col={col.key}
                            data-hovercol={hoverCol === col.key ? '' : undefined}
                            onMouseEnter={(e) =>
                              showCellTip(e, titleCase(g.category), [
                                { text: `${solvedCount} / ${total} solved` },
                              ])
                            }
                            onMouseLeave={clearTip}
                            onMouseMove={moveTip}
                          >
                            {allSolved ? (
                              <i className="fas fa-check sgx-catcheck" style={{ color: catColor(g.category) }}></i>
                            ) : solvedCount > 0 ? (
                              <span
                                className="sgx-progress"
                                style={{
                                  background: `conic-gradient(${catColor(g.category)} ${Math.round((solvedCount / total) * 360)}deg, rgba(148,163,184,0.25) 0deg)`,
                                }}
                              >
                                <i></i>
                              </span>
                            ) : (
                              <span className="sgx-ring" data-unsolved="" style={{ borderColor: catWash(g.category, 0.45) }}></span>
                            )}
                          </div>
                        );
                      }
                      const ch = col.challenge;
                      const solved = (entry.solves || []).some((s) => String(s.id) === ch.id);
                      const blood = solved ? model.bloodMap.get(ch.id)?.get(entry.user_id) : undefined;
                      const solve = solved
                        ? (entry.solves || []).find((s) => String(s.id) === ch.id)
                        : null;
                      return (
                        <div
                          className="sgx-cell"
                          key={col.key}
                          data-col={col.key}
                          data-dim={viewMode === 'challenges' && focusedId !== null && focusedId !== ch.id ? '' : undefined}
                          data-hovercol={hoverCol === col.key ? '' : undefined}
                          onMouseEnter={(e) => {
                            showCellTip(e, ch.name, challengeTooltipLines(entry, ch));
                            if (solved && solve?.solveTime) {
                              setSolveHighlight({
                                user_name: entry.user_name,
                                time: new Date(solve.solveTime).getTime() || 0,
                              });
                            }
                          }}
                          onMouseLeave={() => { clearTip(); setSolveHighlight(null); }}
                          onMouseMove={moveTip}
                        >
                          {blood !== undefined ? (
                            <BloodIcon medal={blood + 1} />
                          ) : (
                            <span
                              className="sgx-ring"
                              data-solved={solved ? '' : undefined}
                              data-unsolved={!solved ? '' : undefined}
                            ></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tip && (
        <div
          className="sgx-tooltip"
          data-above={tip.above || undefined}
          style={{ left: tip.x, top: tip.y }}
        >
          <strong>{tip.name}</strong>
          {tip.lines.map((l, i) => (
            <div className="sgx-tip-line" key={i}>
              {l.blood !== undefined && <BloodIcon medal={l.blood} />}
              {l.blood !== undefined && <span style={{ color: MEDAL_COLORS[l.blood - 1] || '#94a3b8' }}>{l.label}</span>}
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sgx { display: flex; flex-direction: column; }

        .sgx-graphwrap { padding: 14px 16px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }

        .sgx-toolbar {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 10px 16px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sgx-tleft, .sgx-tright { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
        .sgx-seg { display: flex; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-input); }
        .sgx-seg[data-disabled] { opacity: 0.5; }
        .sgx-segbutton {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
          font-size: 0.78rem; color: var(--text-secondary); background: transparent; border: 0; cursor: pointer;
        }
        .sgx-segbutton:hover { color: var(--text-primary); background: var(--bg-hover); }
        .sgx-segbutton[data-active] { background: var(--accent-subtle); color: var(--accent); }
        .sgx-count { color: var(--text-secondary); font-size: 0.82rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .sgx-chip {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px;
          background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px; font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap;
        }
        .sgx-chip b { color: var(--accent); font-weight: 600; font-size: 0.8rem; }
        .sgx-chip button, .sgx-search button {
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 0; color: var(--text-muted); cursor: pointer;
          width: 18px; height: 18px; border-radius: 50%; font-size: 0.7rem;
        }
        .sgx-chip button:hover, .sgx-search button:hover { color: var(--text-primary); }
        .sgx-search {
          display: flex; align-items: center; gap: 8px; background: var(--bg-input);
          border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 6px 10px;
        }
        .sgx-search input { background: transparent; border: 0; outline: 0; color: var(--text-primary); font-size: 0.85rem; width: 150px; }
        .sgx-search input::placeholder { color: var(--text-muted); }
        .sgx-shot {
          display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
          font-size: 0.78rem; color: var(--text-secondary); background: var(--bg-input);
          border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-sm); cursor: pointer;
        }
        .sgx-shot:hover { color: var(--text-primary); background: var(--bg-hover); }
        .sgx-shot:disabled { opacity: 0.6; cursor: default; }

        .sgx-scroll { position: relative; }
        .sgx-table { min-width: max-content; position: relative; }

        .sgx-header { position: sticky; top: 0; z-index: 30; display: flex; background: var(--bg-elevated); }
        .sgx-corner {
          position: sticky; left: 0; z-index: 31; flex-shrink: 0; width: 300px; height: 132px;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 10px 14px; background: var(--bg-elevated);
          border-bottom: 1px solid rgba(255,255,255,0.07); border-right: 1px solid rgba(255,255,255,0.07);
        }
        .sgx-corner-label { font-weight: 600; font-size: 0.8rem; letter-spacing: 0.04em; color: var(--text-primary); text-transform: uppercase; }
        .sgx-corner-score { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .sgx-hcells { display: flex; }
        .sgx-hcell {
          position: relative; width: var(--sgx-colw, 58px); height: 132px; flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center;
          border-left: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.07);
          background: var(--bg-elevated); transition: background 0.12s ease;
        }
        .sgx-hcell[data-hovercol] { background: rgba(255,255,255,0.06); }
        .sgx-hcell[data-dim] { opacity: 0.3; }
        .sgx-hcell.sgx-hcat { width: var(--sgx-catw, 124px); }
        .sgx-hpts { font-size: 0.72rem; color: var(--cat-fg, var(--text-primary)); opacity: 0.92; margin-top: 10px; font-variant-numeric: tabular-nums; position: relative; z-index: 2; }
        .sgx-hname {
          position: absolute; left: calc(50% + 3px); bottom: 14px; transform-origin: bottom left; transform: rotate(-45deg);
          background: transparent; border: 0; padding: 0; max-width: none;
          font-family: var(--font-sans); font-size: 0.8rem; color: var(--cat-fg, var(--text-primary)); cursor: pointer;
          white-space: nowrap; transition: color 0.15s ease; z-index: 4; line-height: 1.2;
        }
        .sgx-hname:hover { color: var(--accent); z-index: 7; }
        .sgx-hcell[data-focused] .sgx-hname { color: var(--accent); font-weight: 600; }
        .sgx-hband { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; }

        .sgx-row { display: flex; background: var(--bg-surface); transition: background 0.15s ease; }
        .sgx-row[data-self] { background: rgba(99,102,241,0.08); }
        .sgx-row[data-pin] { position: sticky; top: 132px; z-index: 16; box-shadow: 0 6px 16px rgba(0,0,0,0.28); background: var(--bg-surface); }
        .sgx-row:hover { background: rgba(255,255,255,0.03); }
        .sgx-row[data-self]:hover { background: rgba(99,102,241,0.12); }
        .sgx-team {
          position: sticky; left: 0; z-index: 12; flex-shrink: 0; width: 300px;
          display: flex; align-items: center; gap: 10px; padding: 8px 14px;
          background: var(--bg-elevated); border-bottom: 1px solid rgba(255,255,255,0.05);
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .sgx-row[data-self] .sgx-team { background: rgba(99,102,241,0.14); }
        .sgx-row[data-pin] .sgx-team { z-index: 17; }
        .sgx-rank { min-width: 36px; display: flex; flex-direction: column; align-items: center; line-height: 1.1; font-weight: 600; font-size: 0.95rem; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .sgx-rank small { font-size: 0.58rem; font-weight: 500; color: var(--text-muted); }
        .sgx-delta { margin-top: 2px; font-size: 0.62rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        .sgx-delta[data-cls="up"] { color: #4ade80; }
        .sgx-delta[data-cls="down"] { color: #f87171; }
        .sgx-delta[data-cls="flat"] { color: var(--text-muted); }
        .sgx-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.76rem; font-weight: 600; flex-shrink: 0; }
        .sgx-nwrap { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .sgx-namewrap { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .sgx-name { font-weight: 600; font-size: 0.88rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sgx-you { font-size: 0.58rem; font-weight: 700; background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 6px; letter-spacing: 0.02em; flex-shrink: 0; }
        .sgx-solves { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sgx-sparkwrap { width: 56px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .sgx-spark { width: 56px; height: 16px; display: block; }
        .sgx-score { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; }
        .sgx-score b { font-weight: 600; font-size: 0.9rem; color: var(--text-primary); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .sgx-score small { font-size: 0.66rem; color: var(--text-muted); }
        .sgx-cells { display: flex; flex-shrink: 0; }
        .sgx-cell {
          width: var(--sgx-colw, 58px); height: 50px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-left: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.12s ease;
        }
        .sgx-cell.sgx-catcell { width: var(--sgx-catw, 124px); }
        .sgx-row:hover .sgx-cell[data-hovercol] { background: rgba(255,255,255,0.07); }
        .sgx-cell[data-hovercol] { background: rgba(255,255,255,0.05); }
        .sgx-cell[data-dim] { opacity: 0.25; }
        .sgx-ring { width: 14px; height: 14px; border-radius: 50%; box-sizing: border-box; }
        .sgx-ring[data-solved] { border: 2px solid rgba(74,222,128,0.8); }
        .sgx-ring[data-unsolved] { border: 2px dashed rgba(148,163,184,0.35); }
        .sgx-medal { width: 18px; height: 18px; }
        .sgx-catcheck { color: var(--accent); font-size: 0.85rem; }
        .sgx-progress { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; position: relative; }
        .sgx-progress i { width: 10px; height: 10px; border-radius: 50%; background: var(--bg-surface); display: block; }

        .sgx-empty { padding: 32px; text-align: center; color: var(--text-muted); font-size: 0.9rem; }

        .sgx-tooltip {
          position: fixed; z-index: 1200; max-width: 16rem; display: flex; flex-direction: column;
          gap: 2px; padding: 8px 10px; background: var(--bg-elevated);
          border: 1px solid rgba(255,255,255,0.14); border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg); pointer-events: none; font-size: 0.78rem; line-height: 1.45;
        }
        .sgx-tooltip[data-above] { transform: translate(-50%, calc(-100% - 12px)); }
        .sgx-tooltip:not([data-above]) { transform: translate(-50%, 12px); }
        .sgx-tooltip strong { font-weight: 600; color: var(--text-primary); font-size: 0.8rem; }
        .sgx-tip-line { display: flex; align-items: center; gap: 4px; color: var(--text-secondary); white-space: nowrap; }
      `}</style>
    </div>
  );
}