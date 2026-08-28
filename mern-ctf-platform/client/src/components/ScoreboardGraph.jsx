import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';

const COLORS = ['#ffd700', '#e0e0e0', '#cd7f32', '#6366f1', '#22d3ee', '#f472b6', '#34d399', '#fb923c', '#a78bfa', '#f87171'];

export default function ScoreboardGraph({ contestId, startDate, endDate, scoreboardFrozen, serverNow }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contestId) return;
    setLoading(true);
    api.get(`/contests/${contestId}/scoreboard/timeline`)
      .then(res => {
        if (res.data.success) {
          const raw = res.data.timeline || [];
          const allTimes = [...new Set(raw.flatMap(t => t.data.map(d => d.time)))].sort();
          const merged = allTimes.map(time => {
            const point = { time };
            raw.forEach(series => {
              const prev = series.data.filter(d => new Date(d.time) <= new Date(time));
              point[series.user_name] = prev.length > 0 ? prev[prev.length - 1].score : 0;
            });
            return point;
          });
          if (startDate) {
            const startPoint = { time: new Date(startDate).toISOString() };
            raw.forEach(series => { startPoint[series.user_name] = 0; });
            merged.unshift(startPoint);
          }
          const now = serverNow ? new Date(serverNow).toISOString() : new Date().toISOString();
          const endPoint = { time: now };
          raw.forEach(series => {
            const last = series.data[series.data.length - 1];
            endPoint[series.user_name] = last ? last.score : 0;
          });
          merged.push(endPoint);
          setTimeline(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contestId]);

  if (loading) return <div className="text-center py-3"><div className="spinner-neon"></div></div>;
  if (timeline.length === 0 || timeline[0].time === undefined) return null;

  const names = Object.keys(timeline[0]).filter(k => k !== 'time');

  const formatTime = (val) => {
    const d = new Date(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div style={{
        background: 'rgba(15,15,25,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{formatTime(label)}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: '0.2rem' }}>
            {p.name}: <strong>{p.value}</strong> pts
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="neon-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <i className="fas fa-chart-line me-2"></i> Score Progression
        </h6>
        {scoreboardFrozen && (
          <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', fontSize: '0.7rem' }}>
            <i className="fas fa-snowflake me-1"></i>Frozen
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 'auto']}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          {names.map((name, i) => (
            <Line
              key={name}
              type="stepAfter"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLORS[i % COLORS.length] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1.2rem', justifyContent: 'center', marginTop: '0.75rem' }}>
        {names.map((name, i) => (
          <span key={name} style={{ fontSize: '0.7rem', color: COLORS[i % COLORS.length], fontWeight: 500 }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}