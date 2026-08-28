import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminSubmissions() {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(page);
  pageRef.current = page;

  const load = async (p) => {
    const pageNum = p ?? pageRef.current;
    try {
      const res = await api.get(`/admin/submissions?page=${pageNum}&limit=15`);
      if (res.data.success) { setData(res.data.data); setTotalPages(res.data.pagination.total_pages); setPage(res.data.pagination.current_page); }
    } catch {}
  };
  useEffect(() => { load(); const i = setInterval(() => load(), 10000); return () => clearInterval(i); }, []);

  const handleToggle = async (id) => {
    if (!confirm('Toggle this submission type?')) return;
    try {
      await api.put(`/admin/submissions/${id}/toggle`);
      load(page);
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this submission? This will also remove associated points.')) return;
    try {
      await api.delete(`/admin/submissions/${id}`);
      load(page);
    } catch {}
  };

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-file-alt me-2" style={{ color: 'var(--accent)' }}></i>Submissions</h2>
        <div className="table-responsive">
          <table className="neon-table">
            <thead>
              <tr><th>ID</th><th>User</th><th>Challenge</th><th>Flag</th><th>Type</th><th>Actions</th><th>Time</th></tr>
            </thead>
            <tbody>
              {data.map(s => (
                <tr key={s.submission_id}>
                  <td>{String(s.submission_id).slice(-6)}</td>
                  <td>{s.user_name}</td>
                  <td>{s.challenge_name} ({s.challenge_point})</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.submitted_flag}</td>
                  <td><span className={`badge ${s.submission_type === 'correct' ? 'bg-success' : 'bg-danger'}`}>{s.submission_type}</span></td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm" style={{ color: 'var(--accent)', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius)' }} onClick={() => handleToggle(s.submission_id)} title="Toggle correct/incorrect">
                        <i className="fas fa-exchange-alt"></i>
                      </button>
                      <button className="btn btn-sm" style={{ color: '#f87171', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)' }} onClick={() => handleDelete(s.submission_id)} title="Delete submission">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                  <td>{new Date(s.timestamp_of_submission).toLocaleString()}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan="7" className="text-center">No submissions.</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button className="btn btn-neon-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
            <span className="align-self-center">Page {page} of {totalPages}</span>
            <button className="btn btn-neon-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
