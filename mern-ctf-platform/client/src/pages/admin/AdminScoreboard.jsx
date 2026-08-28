import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminScoreboard() {
  const [contests, setContests] = useState([]);
  const [contestId, setContestId] = useState('');
  const [scoreboard, setScoreboard] = useState([]);

  useEffect(() => {
    api.get('/admin/contests').then(res => { if (res.data.success) setContests(res.data.contests); }).catch(() => {});
  }, []);

  const loadScoreboard = async () => {
    if (!contestId) { setScoreboard([]); return; }
    const res = await api.get(`/contests/${contestId}/scoreboard`);
    if (res.data.success) setScoreboard(res.data.scoreboard);
  };

  useEffect(() => { loadScoreboard(); }, [contestId]);

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-trophy me-2" style={{ color: 'var(--accent)' }}></i>Scoreboard</h2>

        <div className="mb-4">
          <label className="form-label fw-bold">Select Contest</label>
          <select className="form-select" value={contestId} onChange={e => setContestId(e.target.value)}>
            <option value="">— Select a contest —</option>
            {contests.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>

        <div className="table-responsive">
          <table className="neon-table">
            <thead>
              <tr><th>Rank</th><th>User</th><th>Score</th><th>Latest Solve</th></tr>
            </thead>
            <tbody>
              {scoreboard.map(entry => (
                <tr key={entry.rank}>
                  <td><strong>#{entry.rank}</strong></td>
                  <td>{entry.user_name}</td>
                  <td><strong>{entry.total_score}</strong></td>
                  <td>{entry.latest_solve_time ? new Date(entry.latest_solve_time).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
              {!contestId && <tr><td colSpan="4" className="text-center">Select a contest above.</td></tr>}
              {contestId && scoreboard.length === 0 && <tr><td colSpan="4" className="text-center">No scores yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
