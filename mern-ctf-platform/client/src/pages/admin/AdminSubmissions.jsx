import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';
import SubmissionDetailsModal from '../../components/SubmissionDetailsModal';

export default function AdminSubmissions() {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [submissionIdInput, setSubmissionIdInput] = useState('');
  const [challengeName, setChallengeName] = useState('');
  const [challengeNameInput, setChallengeNameInput] = useState('');
  const pageRef = useRef(page);
  pageRef.current = page;

  const load = async (p) => {
    const pageNum = p ?? pageRef.current;
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 15 });
      if (search) params.set('search', search);
      if (submissionId) params.set('submissionId', submissionId);
      if (challengeName) params.set('challengeName', challengeName);
      const res = await api.get(`/admin/submissions?${params}`);
      if (res.data.success) { setData(res.data.data); setTotalPages(res.data.pagination.total_pages); setPage(res.data.pagination.current_page); }
    } catch {}
  };
  const hasFilters = !!(search || submissionId || challengeName);
  useEffect(() => {
    load(1);
    if (hasFilters) return undefined;
    const i = setInterval(() => load(), 10000);
    return () => clearInterval(i);
  }, [search, submissionId, challengeName, hasFilters]);

  const applyFilters = () => {
    setSearch(searchInput.trim());
    setSubmissionId(submissionIdInput.trim());
    setChallengeName(challengeNameInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSubmissionIdInput('');
    setChallengeNameInput('');
    setSearch('');
    setSubmissionId('');
    setChallengeName('');
  };

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
        <div className="card mb-4" style={{ background: 'rgba(30,32,42,0.6)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius)' }}>
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label mb-1"><i className="fas fa-user me-1" style={{ color: 'var(--accent)' }}></i>Username</label>
                <input type="text" className="form-control form-control-sm" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by username..." />
              </div>
              <div className="col-md-3">
                <label className="form-label mb-1"><i className="fas fa-hashtag me-1" style={{ color: 'var(--accent)' }}></i>Submission ID</label>
                <input type="text" className="form-control form-control-sm" value={submissionIdInput} onChange={e => setSubmissionIdInput(e.target.value)} placeholder="Exact submission ID..." />
              </div>
              <div className="col-md-3">
                <label className="form-label mb-1"><i className="fas fa-flag me-1" style={{ color: 'var(--accent)' }}></i>Challenge Name</label>
                <input type="text" className="form-control form-control-sm" value={challengeNameInput} onChange={e => setChallengeNameInput(e.target.value)} placeholder="Search by challenge..." />
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button className="btn btn-neon btn-sm flex-grow-1" onClick={applyFilters}><i className="fas fa-search me-1"></i>Filter</button>
                <button className="btn btn-neon-outline btn-sm" onClick={clearFilters} title="Clear filters"><i className="fas fa-eraser"></i></button>
              </div>
            </div>
          </div>
        </div>
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
                  <td><span className={`badge ${s.submission_type === 'correct' ? 'bg-success' : 'bg-danger'}`}>{s.submission_type}</span>{s.practice && <span className="badge" style={{ background: '#facc15', color: '#000', fontSize: '0.6rem', verticalAlign: 'middle' }}>Practice</span>}</td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm" style={{ color: 'var(--accent)', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius)' }} onClick={() => setDetailId(s.submission_id)} title="View details">
                        <i className="fas fa-eye"></i>
                      </button>
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
              {data.length === 0 && <tr><td colSpan="7" className="text-center">{(search || submissionId || challengeName) ? 'No submissions match the filters.' : 'No submissions.'}</td></tr>}
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
      {detailId && <SubmissionDetailsModal submissionId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
