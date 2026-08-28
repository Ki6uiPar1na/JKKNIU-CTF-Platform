import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminSolves() {
  const [data, setData] = useState([]);

  const load = () => {
    api.get('/admin/solves').then(res => { if (res.data.success) setData(res.data.data); }).catch(() => {});
  };
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-check-circle me-2" style={{ color: 'var(--accent)' }}></i>Solves</h2>
        <div className="table-responsive">
          <table className="neon-table">
            <thead>
              <tr><th>ID</th><th>User</th><th>Challenge</th><th>Points</th><th>Submitted Flag</th><th>Solved At</th></tr>
            </thead>
            <tbody>
              {data.map(s => (
                <tr key={s.id}>
                  <td>{String(s.id).slice(-6)}</td>
                  <td>{s.user_name}</td>
                  <td>{s.challenge_name}</td>
                  <td>{s.challenge_point}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.submitted_flag}</td>
                  <td>{new Date(s.timestamp_of_submission).toLocaleString()}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan="6" className="text-center">No solves found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
