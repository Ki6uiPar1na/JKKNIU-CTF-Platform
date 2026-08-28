import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminChallenges() {
  const [searchParams] = useSearchParams();
  const [contests, setContests] = useState([]);
  const [contestId, setContestId] = useState(searchParams.get('contestId') || '');
  const [challenges, setChallenges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ challenge_name: '', category: '', description: '', points: '', max_attempts: '', flag_value: '', case_sensitive: 0, visibility: 1 });
  const { showToast } = useToast();

  const loadContests = async () => {
    try {
      const res = await api.get('/admin/contests');
      if (res.data.success) setContests(res.data.contests);
    } catch { /* ignore */ }
  };

  const loadChallenges = async () => {
    if (!contestId) { setChallenges([]); return; }
    try {
      const res = await api.get(`/admin/contests/${contestId}/challenges`);
      if (res.data.success) setChallenges(res.data.challenges);
    } catch { showToast('Failed to load challenges', 'error'); }
  };

  useEffect(() => { loadContests(); }, []);
  useEffect(() => { loadChallenges(); }, [contestId]);

  const resetForm = () => {
    setForm({ challenge_name: '', category: '', description: '', points: '', max_attempts: '', flag_value: '', case_sensitive: 0, visibility: 1 });
    setEdit(null); setShowForm(false);
  };

  const handleEdit = (ch) => {
    setForm({
      challenge_name: ch.name, category: ch.category, description: ch.description,
      points: ch.point, max_attempts: ch.max_attempts,
      flag_value: (ch.flags || []).join(', '), case_sensitive: ch.is_case_sensitive ? 1 : 0, visibility: ch.visibility,
    });
    setEdit(ch._id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contestId) { showToast('Select a contest first.', 'error'); return; }
    try {
      const url = edit ? `/admin/challenges/${edit}` : `/admin/contests/${contestId}/challenges`;
      const method = edit ? 'put' : 'post';
      const res = await api[method](url, form);
      if (res.data.success) { showToast(res.data.message, 'success'); resetForm(); loadChallenges(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to save challenge', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this challenge?')) return;
    try { const res = await api.delete(`/admin/challenges/${id}`); if (res.data.success) { showToast('Challenge deleted', 'success'); loadChallenges(); } } catch { showToast('Delete failed', 'error'); }
  };

  const toggleVisibility = async (id) => {
    try { await api.put(`/admin/challenges/${id}/toggle-visibility`); loadChallenges(); } catch { showToast('Toggle failed', 'error'); }
  };

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold mb-0" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-skull-crossbones me-2" style={{ color: 'var(--accent)' }}></i>Challenges</h2>
          <button className="btn btn-neon" onClick={() => { resetForm(); setShowForm(!showForm); }} disabled={!contestId}>
            <i className="fas fa-plus me-1"></i> {showForm ? 'Cancel' : 'Add Challenge'}
          </button>
        </div>

        <div className="mb-4">
          <label className="form-label fw-bold">Select Contest</label>
          <select className="form-select" value={contestId} onChange={e => setContestId(e.target.value)}>
            <option value="">— Select a contest —</option>
            {contests.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>

        {showForm && (
          <div className="neon-card mb-4">
            <h4 className="mb-3">{edit ? 'Edit Challenge' : 'Add New Challenge'}</h4>
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Challenge Name</label>
                  <input className="form-control" value={form.challenge_name} onChange={e => setForm({...form, challenge_name: e.target.value})} required />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required>
                    <option value="">Select</option>
                    {['Web', 'Cryptography', 'Pwn', 'OSINT', 'Forensic', 'Steganography', 'Misc', 'Reverse Engg'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Points</label>
                  <input type="number" className="form-control" value={form.points} onChange={e => setForm({...form, points: e.target.value})} required />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Description (Markdown supported)</label>
                <textarea className="form-control" rows="4" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max Attempts</label>
                  <input type="number" className="form-control" value={form.max_attempts} onChange={e => setForm({...form, max_attempts: e.target.value})} required />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Flag Value(s) (comma-separated)</label>
                  <input className="form-control" value={form.flag_value} onChange={e => setForm({...form, flag_value: e.target.value})} required />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">Case Sensitive</label>
                  <select className="form-select" value={form.case_sensitive} onChange={e => setForm({...form, case_sensitive: e.target.value})}>
                    <option value={0}>No</option><option value={1}>Yes</option>
                  </select>
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">Visibility</label>
                  <select className="form-select" value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})}>
                    <option value={1}>Visible</option><option value={0}>Hidden</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-neon"><i className="fas fa-save me-1"></i> {edit ? 'Update' : 'Create'} Challenge</button>
            </form>
          </div>
        )}

        <div className="table-responsive">
          <table className="neon-table">
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Category</th><th>Points</th><th>Attempts</th><th>Flags</th><th>Visible</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((ch, i) => (
                <tr key={ch._id}>
                  <td>{i + 1}</td>
                  <td>{ch.name}</td>
                  <td>{ch.category}</td>
                  <td>{ch.point}</td>
                  <td>{ch.max_attempts}</td>
                  <td>{(ch.flags || []).join(', ')}</td>
                  <td>
                    <button className={`btn btn-sm ${ch.visibility ? 'btn-neon' : 'btn-neon-danger'}`} onClick={() => toggleVisibility(ch._id)}>
                      {ch.visibility ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-neon-outline btn-sm me-1" onClick={() => handleEdit(ch)}><i className="fas fa-edit"></i></button>
                    <button className="btn btn-neon-danger btn-sm" onClick={() => handleDelete(ch._id)}><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              ))}
              {!contestId && <tr><td colSpan="8" className="text-center">Select a contest above to view its challenges.</td></tr>}
              {contestId && challenges.length === 0 && <tr><td colSpan="8" className="text-center">No challenges for this contest.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
