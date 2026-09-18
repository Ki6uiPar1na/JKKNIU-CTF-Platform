import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';

const TIER_COLORS = ['#ffd700', '#d7dbe0', '#cd7f32'];
const SELF_COLOR = '#6366f1';
const OTHER_COLOR = '#64748b';

function tierColor(series) {
  if (series.isSelf) return SELF_COLOR;
  if (series.rank >= 1 && series.rank <= 3) return TIER_COLORS[series.rank - 1];
  return OTHER_COLOR;
}

function seriesPoints(series) {
  return (series.data || []).map((p) => ({ time: new Date(p.time).getTime(), score: p.score || 0 }));
}

function toKey(i) {
  return `k${i}`;
}

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

function fmtClock(t) {
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function GraphTip({ active, payload, label, startMs, keyToSeries }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload
    .filter((p) => p.value !== undefined && p.value !== null)
    .sort((a, b) => b.value - a.value);
  if (!rows.length) return null;
  return (
    <div className="gx-graph-tip">
      <div className="gx-graph-tip-time">{formatRel(label, startMs)} into contest</div>
      {rows.map((p) => {
        const s = keyToSeries[p.dataKey];
        return (
          <div className="gx-graph-tip-row" key={p.dataKey}>
            <span className="gx-graph-tip-dot" style={{ background: p.color }}></span>
            <span className="gx-graph-tip-name">{s ? s.user_name : p.dataKey}</span>
            <span className="gx-graph-tip-pts">{p.value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function PinButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className="gx-pin"
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-active={active || undefined}
      onClick={onClick}
    >
      <i className={icon}></i>
    </button>
  );
}

export default function ScoreboardGraphPanel({
  timeline = [],
  visibleNames = [],
  hoveredName = null,
  solveHighlight = null,
  selfName = null,
  startMs = 0,
  height = 280,
}) {
  const [pinTop3, setPinTop3] = useState(false);
  const [pinSelf, setPinSelf] = useState(false);

  const series = useMemo(
    () =>
      (timeline || [])
        .filter((s) => s && s.user_name && (s.data || []).length)
        .map((s) => ({ ...s, isSelf: selfName !== null && String(s.user_name) === String(selfName) })),
    [timeline, selfName]
  );

  const { renderSeries, data, keyToSeries } = useMemo(() => {
    const seen = new Set((visibleNames || []).map((n) => String(n)));
    const sel = series
      .filter((s) => {
        const name = String(s.user_name);
        if (seen.has(name)) return true;
        if (pinTop3 && s.rank >= 1 && s.rank <= 3) return true;
        if (pinSelf && s.isSelf) return true;
        return false;
      })
      .map((s, i) => ({ ...s, key: toKey(i) }));

    const keyMap = {};
    sel.forEach((s) => { keyMap[s.key] = s; });

    const times = [...new Set(sel.flatMap((s) => seriesPoints(s).map((p) => p.time)))].sort((a, b) => a - b);
    const merged = times.map((t) => {
      const row = { time: t };
      sel.forEach((s) => {
        let v = 0;
        for (const p of seriesPoints(s)) {
          if (p.time <= t) v = p.score;
          else break;
        }
        row[s.key] = v;
      });
      return row;
    });

    return { renderSeries: sel, data: merged, keyToSeries: keyMap };
  }, [series, visibleNames, pinTop3, pinSelf]);

  if (renderSeries.length === 0) {
    return (
      <div className="gx-panel">
        <div className="gx-empty">
          <i className="fas fa-chart-line me-2"></i>No scoring data to chart yet.
        </div>
      </div>
    );
  }

  const maxTime = data.length ? data[data.length - 1].time : startMs;
  const hl = solveHighlight ? renderSeries.find((s) => String(s.user_name) === String(solveHighlight.user_name)) : null;
  let hlPoint = null;
  if (hl) {
    const pts = seriesPoints(hl);
    for (const p of pts) {
      if (p.time === solveHighlight.time) { hlPoint = p; break; }
      if (p.time > solveHighlight.time) break;
      hlPoint = p;
    }
  }

  return (
    <div className="gx-panel" data-interactive>
      <div className="gx-controls">
        <PinButton
          icon="fas fa-thumbtack"
          label="Pin top 3 to graph"
          active={pinTop3}
          onClick={() => setPinTop3((v) => !v)}
        />
        <PinButton
          icon="fas fa-face-smile"
          label="Pin self to graph"
          active={pinSelf}
          onClick={() => setPinSelf((v) => !v)}
        />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 12, bottom: 4 }}>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtClock}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            minTickGap={48}
            scale="time"
          />
          <YAxis hide domain={[0, (dataMax) => dataMax * 1.05]} />
          <Tooltip
            content={<GraphTip startMs={startMs} keyToSeries={keyToSeries} />}
            cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeDasharray: '4 4' }}
          />
          {renderSeries.map((s) => {
            const dimmed =
              hoveredName !== null &&
              String(s.user_name) !== String(hoveredName) &&
              !s.isSelf;
            return (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                data={data}
                dot={false}
                connectNulls
                stroke={tierColor(s)}
                strokeWidth={s.isSelf ? 3 : 2}
                strokeOpacity={dimmed ? 0.15 : 1}
                isAnimationActive={false}
              />
            );
          })}
          {hlPoint && (
            <ReferenceDot
              x={hlPoint.time}
              y={hlPoint.score}
              r={4}
              fill={hl ? tierColor(hl) : SELF_COLOR}
              stroke="#0d0d14"
              strokeWidth={2}
              isFront
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {maxTime > 0 && <div className="gx-now">now</div>}
      <style>{`
        .gx-panel { position: relative; display: block; }
        .gx-panel[data-interactive] { padding-block-start: 0.5rem; }
        .gx-controls {
          position: absolute; z-index: 5; inset-block-start: 0.5rem; inset-inline-end: 0.75rem;
          display: flex; gap: 0.25rem; opacity: 0; transition: opacity 120ms ease;
        }
        .gx-panel:hover .gx-controls, .gx-panel:focus-within .gx-controls { opacity: 1; }
        .gx-pin {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.75rem; height: 1.75rem; padding: 0; font-size: 0.75rem;
          color: var(--text-secondary); background: var(--bg-hover);
          border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); cursor: pointer;
        }
        .gx-pin:hover { color: var(--text-primary); background: var(--bg-elevated); }
        .gx-pin[data-active] { color: var(--accent); background: var(--accent-subtle); border-color: var(--accent); }
        .gx-empty {
          display: flex; align-items: center; justify-content: center; min-height: 180px;
          color: var(--text-muted); font-size: 0.9rem;
        }
        .gx-now {
          position: absolute; inset-inline-end: 0.5rem; inset-block-start: 0.5rem;
          font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted);
        }
        .gx-graph-tip {
          display: flex; flex-direction: column; gap: 3px; padding: 8px 10px;
          background: var(--bg-elevated); border: 1px solid rgba(255,255,255,0.14);
          border-radius: var(--radius-md); box-shadow: var(--shadow-lg); pointer-events: none;
        }
        .gx-graph-tip-time { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .gx-graph-tip-row { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-primary); white-space: nowrap; }
        .gx-graph-tip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .gx-graph-tip-name { overflow: hidden; text-overflow: ellipsis; max-width: 12rem; }
        .gx-graph-tip-pts { margin-left: auto; font-weight: 600; font-variant-numeric: tabular-nums; }
        .recharts-wrapper { outline: none; }
        .recharts-surface:focus { outline: none; }
      `}</style>
    </div>
  );
}