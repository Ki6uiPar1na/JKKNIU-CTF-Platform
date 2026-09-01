import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AdminSidebar from '../../components/AdminSidebar';
import SubmissionDetailsModal from '../../components/SubmissionDetailsModal';
import { sanitize } from '../../utils/sanitize';
import useServerTime from '../../hooks/useServerTime';

function HintsPanel({ challengeId, onClose }) {
  const [hints, setHints] = useState([]);
  const [form, setForm] = useState({ content: '', cost: '' });
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/challenges/${challengeId}/hints`);
      if (res.data.success) setHints(res.data.hints);
    } catch { showToast('Failed to load hints', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [challengeId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.content) { showToast('Hint content is required', 'error'); return; }
    try {
      const res = await api.post(`/admin/challenges/${challengeId}/hints`, form);
      if (res.data.success) { showToast('Hint added!', 'success'); setForm({ content: '', cost: '' }); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to add hint', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this hint?')) return;
    try {
      const res = await api.delete(`/admin/hints/${id}`);
      if (res.data.success) { showToast('Hint deleted', 'success'); load(); }
    } catch { showToast('Delete failed', 'error'); }
  };

  return (
    <div className="neon-card p-3 mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0"><i className="fas fa-lightbulb me-2" style={{ color: '#facc15' }}></i>Hints</h6>
        <button className="btn btn-neon-outline btn-sm" onClick={onClose}><i className="fas fa-times"></i></button>
      </div>

      <form onSubmit={handleAdd} className="d-flex gap-2 mb-3 align-items-end">
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Content</label>
          <input className="form-control form-control-sm" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Hint text" />
        </div>
        <div style={{ width: '100px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Cost (pts)</label>
          <input type="number" className="form-control form-control-sm" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0 = free" min="0" />
        </div>
        <button type="submit" className="btn btn-neon btn-sm"><i className="fas fa-plus"></i></button>
      </form>

      {loading ? <div className="spinner-neon" style={{ height: '30px' }}></div> : hints.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hints yet.</p>
      ) : (
        hints.map(h => (
          <div key={h._id} className="d-flex justify-content-between align-items-start gap-2 mb-2 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)' }}>
            <div>
              <span style={{ fontSize: '0.85rem' }}>{h.content}</span>
              <span className={`badge ${h.cost === 0 ? 'bg-success' : 'bg-warning text-dark'} ms-2`} style={{ fontSize: '0.65rem' }}>
                {h.cost === 0 ? 'Free' : `${h.cost} pts`}
              </span>
            </div>
            <button className="btn btn-neon-danger btn-sm py-0 px-1" style={{ fontSize: '0.7rem' }} onClick={() => handleDelete(h._id)}><i className="fas fa-trash"></i></button>
          </div>
        ))
      )}
    </div>
  );
}

function ChallengesTab({ contestId }) {
  const [challenges, setChallenges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ challenge_name: '', category: '', description: '', points: '', max_attempts: '', flag_value: '', case_sensitive: 0, visibility: 1, submission_enabled: 1 });
  const [editFiles, setEditFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [hintsFor, setHintsFor] = useState(null);
  const [selected, setSelected] = useState([]);
  const [previewChallenge, setPreviewChallenge] = useState(null);
  const { showToast } = useToast();

  const load = async () => {
    try {
      const res = await api.get(`/admin/contests/${contestId}/challenges`);
      if (res.data.success) setChallenges(res.data.challenges);
    } catch { showToast('Failed to load challenges', 'error'); }
  };
  useEffect(() => { load(); }, [contestId]);

  const resetForm = () => {
    setForm({ challenge_name: '', category: '', description: '', points: '', max_attempts: '', flag_value: '', case_sensitive: 0, visibility: 1, submission_enabled: 1 });
    setEditFiles([]); setPendingFiles([]); setEdit(null); setShowForm(false); setHintsFor(null);
  };

  const handleEdit = (ch) => {
    setForm({
      challenge_name: ch.name, category: ch.category, description: ch.description,
      points: ch.point, max_attempts: ch.max_attempts,
      flag_value: (ch.flags || []).join(', '), case_sensitive: ch.is_case_sensitive ? 1 : 0, visibility: ch.visibility, submission_enabled: ch.submission_enabled ?? 1,
    });
    setEditFiles(ch.files || []);
    setEdit(ch._id); setShowForm(true);
  };

  const handleFileUpload = async (challengeId, file) => {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/admin/challenges/${challengeId}/upload`, fd);
      if (res.data.success) { setEditFiles(res.data.files); showToast('File uploaded!', 'success'); }
    } catch (err) { showToast(err.response?.data?.error || 'Upload failed', 'error'); }
    finally { setUploadingFile(false); }
  };

  const handleFileDelete = async (challengeId, fileUrl) => {
    try {
      const res = await api.delete(`/admin/challenges/${challengeId}/files`, { data: { fileUrl } });
      if (res.data.success) { setEditFiles(res.data.files); showToast('File deleted.', 'success'); }
    } catch { showToast('Delete failed', 'error'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = edit ? `/admin/challenges/${edit}` : `/admin/contests/${contestId}/challenges`;
      const method = edit ? 'put' : 'post';
      const res = await api[method](url, form);
      if (res.data.success) {
        if (!edit && pendingFiles.length > 0) {
          const challengeId = res.data.challenge?._id || edit;
          for (const file of pendingFiles) {
            const fd = new FormData();
            fd.append('file', file);
            await api.post(`/admin/challenges/${challengeId}/upload`, fd);
          }
        }
        showToast(res.data.message, 'success'); resetForm(); load();
      }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to save challenge', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this challenge?')) return;
    try { const res = await api.delete(`/admin/challenges/${id}`); if (res.data.success) { showToast('Challenge deleted', 'success'); load(); } } catch { showToast('Delete failed', 'error'); }
  };

  const toggleVisibility = async (id) => {
    try { await api.put(`/admin/challenges/${id}/toggle-visibility`); load(); } catch { showToast('Toggle failed', 'error'); }
  };

  const toggleSubmission = async (id) => {
    try { await api.put(`/admin/challenges/${id}/toggle-submission`); load(); } catch { showToast('Toggle failed', 'error'); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === challenges.length) setSelected([]);
    else setSelected(challenges.map(c => c._id));
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} challenge(s)?`)) return;
    try {
      const res = await api.post('/admin/challenges/bulk-delete', { ids: selected });
      if (res.data.success) { showToast(res.data.message, 'success'); setSelected([]); load(); }
    } catch { showToast('Bulk delete failed', 'error'); }
  };

  const handleBulkVisibility = async (visibility) => {
    if (!selected.length) return;
    try {
      const res = await api.put('/admin/challenges/bulk-visibility', { ids: selected, visibility });
      if (res.data.success) { showToast(res.data.message, 'success'); setSelected([]); load(); }
    } catch { showToast('Bulk update failed', 'error'); }
  };

  const handleBulkSubmission = async (submission_enabled) => {
    if (!selected.length) return;
    try {
      const res = await api.put('/admin/challenges/bulk-submission', { ids: selected, submission_enabled });
      if (res.data.success) { showToast(res.data.message, 'success'); setSelected([]); load(); }
    } catch { showToast('Bulk update failed', 'error'); }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="fw-bold mb-0"><i className="fas fa-skull-crossbones me-2" style={{ color: 'var(--accent)' }}></i>Challenges</h4>
        <button className="btn btn-neon" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <i className="fas fa-plus me-1"></i> {showForm ? 'Cancel' : 'Add Challenge'}
        </button>
      </div>

      {selected.length > 0 && (
        <div className="neon-card p-2 mb-3 d-flex align-items-center gap-2" style={{ borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selected.length} selected</span>
          <button className="btn btn-neon-outline btn-sm" onClick={() => handleBulkVisibility(1)}><i className="fas fa-eye me-1"></i> Show</button>
          <button className="btn btn-neon-outline btn-sm" onClick={() => handleBulkVisibility(0)}><i className="fas fa-eye-slash me-1"></i> Hide</button>
          <button className="btn btn-neon-outline btn-sm" onClick={() => handleBulkSubmission(1)}><i className="fas fa-unlock me-1"></i> Open Solving</button>
          <button className="btn btn-neon-outline btn-sm" onClick={() => handleBulkSubmission(0)}><i className="fas fa-ban me-1"></i> Lock Solving</button>
          <button className="btn btn-neon-danger btn-sm" onClick={handleBulkDelete}><i className="fas fa-trash me-1"></i> Delete</button>
          <button className="btn btn-sm ms-auto" style={{ color: 'var(--text-muted)' }} onClick={() => setSelected([])}><i className="fas fa-times"></i></button>
        </div>
      )}

      {showForm && (
        <div className="neon-card mb-4 p-3">
          <h5 className="mb-3">{edit ? 'Edit Challenge' : 'Add New Challenge'}</h5>
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
              <div className="mt-1 text-end">
                <button type="button" className="btn btn-sm" style={{ color: 'var(--accent)', fontSize: '0.75rem' }} onClick={() => setPreviewChallenge({ name: form.challenge_name || 'Untitled', category: form.category, point: form.points, description: form.description, files: [] })}>
                  <i className="fas fa-eye me-1"></i> Preview Description
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">Max Attempts</label>
                <input type="number" className="form-control" value={form.max_attempts} onChange={e => setForm({...form, max_attempts: e.target.value})} required />
              </div>
              <div className="col-md-3 mb-3">
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
              <div className="col-md-2 mb-3">
                <label className="form-label">Solve Status</label>
                <select className="form-select" value={form.submission_enabled} onChange={e => setForm({...form, submission_enabled: e.target.value})}>
                  <option value={1}>Open for solving</option><option value={0}>Locked (practice only)</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Challenge Files</label>
              {(edit ? editFiles : []).length > 0 && (
                <div className="mb-2 d-flex flex-wrap gap-2">
                  {(edit ? editFiles : []).map((f, i) => (
                    <div key={i} className="d-flex align-items-center gap-1" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius)', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                      <i className="fas fa-file me-1"></i>
                      <span style={{ color: 'var(--text-secondary)' }}>{f.split('/').pop()}</span>
                      {edit && <button type="button" className="btn btn-neon-danger py-0 px-1" style={{ fontSize: '0.65rem' }} onClick={() => handleFileDelete(edit, f)}><i className="fas fa-times"></i></button>}
                    </div>
                  ))}
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="mb-2 d-flex flex-wrap gap-2">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="d-flex align-items-center gap-1" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius)', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                      <i className="fas fa-file me-1"></i>
                      <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                      <button type="button" className="btn btn-neon-danger py-0 px-1" style={{ fontSize: '0.65rem' }} onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))}><i className="fas fa-times"></i></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="d-flex gap-2">
                <input type="file" className="form-control form-control-sm" onChange={e => {
                  if (e.target.files[0]) {
                    if (edit) handleFileUpload(edit, e.target.files[0]);
                    else setPendingFiles([...pendingFiles, e.target.files[0]]);
                  }
                }} />
                {uploadingFile && <small style={{ color: 'var(--text-muted)' }}>Uploading...</small>}
              </div>
            </div>
            <button type="submit" className="btn btn-neon btn-sm"><i className="fas fa-save me-1"></i> {edit ? 'Update' : 'Create'} Challenge</button>
          </form>
          {edit && <HintsPanel challengeId={edit} onClose={() => setHintsFor(null)} />}
        </div>
      )}

      <div className="neon-card p-0">
        <div className="table-responsive">
          <table className="neon-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" onChange={toggleSelectAll} checked={challenges.length > 0 && selected.length === challenges.length} />
                </th>
                <th>ID</th><th>Name</th><th>Category</th><th>Points</th><th>Attempts</th><th>Solves</th><th>Flags</th><th>Files</th><th>Visible</th><th>Solve</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((ch, i) => (
                <tr key={ch._id} style={{ background: selected.includes(ch._id) ? 'rgba(99,102,241,0.06)' : undefined }}>
                  <td><input type="checkbox" checked={selected.includes(ch._id)} onChange={() => toggleSelect(ch._id)} /></td>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{ch.name}</td>
                  <td><span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)' }}>{ch.category}</span></td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{ch.point}</td>
                  <td>{ch.max_attempts || '∞'}</td>
                  <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ch.solves?.count ?? 0}</span></td>
                  <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>{(ch.flags || []).join(', ')}</td>
                  <td>{(ch.files || []).length > 0 ? <i className="fas fa-paperclip" title={(ch.files || []).map(f => f.split('/').pop()).join(', ')}></i> : '—'}</td>
                  <td>
                    <button className={`btn btn-sm ${ch.visibility ? 'btn-neon' : 'btn-neon-danger'}`} onClick={() => toggleVisibility(ch._id)}>
                      {ch.visibility ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td>
                    <button className={`btn btn-sm ${ch.submission_enabled ? 'btn-neon' : 'btn-neon-danger'}`} onClick={() => toggleSubmission(ch._id)} title={ch.submission_enabled ? 'Click to lock (practice only, no points)' : 'Click to open for points'}>
                      {ch.submission_enabled ? 'Open' : 'Practice'}
                    </button>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm" style={{ color: 'var(--accent)' }} title="Preview" onClick={() => setPreviewChallenge(ch)}><i className="fas fa-eye"></i></button>
                      <button className="btn btn-neon-outline btn-sm" title="Edit" onClick={() => handleEdit(ch)}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-neon-outline btn-sm" title="Hints" onClick={() => { setHintsFor(ch._id); handleEdit(ch); }}><i className="fas fa-lightbulb"></i></button>
                      <button className="btn btn-neon-danger btn-sm" title="Delete" onClick={() => handleDelete(ch._id)}><i className="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
              {challenges.length === 0 && <tr><td colSpan="12" className="text-center">No challenges for this contest.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {previewChallenge && (
        <div className="modal-overlay" onClick={() => setPreviewChallenge(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
        }}>
          <div className="neon-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-bold mb-0" style={{ color: 'var(--accent)' }}>
                <i className="fas fa-skull-crossbones me-2"></i>{previewChallenge.name}
              </h4>
              <button className="btn btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setPreviewChallenge(null)}><i className="fas fa-times fa-lg"></i></button>
            </div>
            <div className="d-flex gap-3 mb-3">
              <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', fontSize: '0.8rem' }}>{previewChallenge.category}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}>{previewChallenge.point} pts</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem' }}
              dangerouslySetInnerHTML={{ __html: sanitize(previewChallenge.description) }} />
            {previewChallenge.files?.length > 0 && (
              <div className="mt-3">
                <small style={{ color: 'var(--text-muted)' }}>Attachments:</small>
                {previewChallenge.files.map((f, i) => (
                  <div key={i} className="mt-1">
                    <a href={f} download style={{ color: 'var(--accent)', fontSize: '0.85rem' }}><i className="fas fa-download me-1"></i>{f.split('/').pop()}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ScoreboardTab({ contestId, contest }) {
  const [scoreboard, setScoreboard] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const isTeam = contest?.participation_mode === 'team';

  useEffect(() => {
    api.get(`/contests/${contestId}/scoreboard`).then(res => { if (res.data.success) { setScoreboard(res.data.scoreboard); setFrozen(res.data.frozen || false); } }).catch(() => {});
  }, [contestId]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0"><i className="fas fa-trophy me-2" style={{ color: 'var(--accent)' }}></i>Scoreboard</h4>
        <a href={`/api/admin/scoreboard/${contestId}/export`} className="btn btn-neon-outline btn-sm" download>
          <i className="fas fa-download me-1"></i> Export CSV
        </a>
      </div>
      {frozen && (
        <div className="alert mb-4" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent)', borderRadius: 'var(--radius)' }}>
          <i className="fas fa-snowflake me-2"></i>Scoreboard is frozen. Rankings reflect the state as of the freeze time.
        </div>
      )}
      <div className="neon-card p-0">
        <div className="table-responsive">
          <table className="neon-table" style={{ marginBottom: 0 }}>
            <thead><tr><th>Rank</th><th>{isTeam ? 'Team' : 'User'}</th><th>Score</th><th>Latest Solve</th></tr></thead>
            <tbody>
              {scoreboard.map(entry => (
                <tr key={entry.rank}>
                  <td><strong>#{entry.rank}</strong></td>
                  <td>{entry.user_name}</td>
                  <td><strong>{entry.total_score}</strong></td>
                  <td>{entry.latest_solve_time ? new Date(entry.latest_solve_time).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
              {scoreboard.length === 0 && <tr><td colSpan="4" className="text-center">No scores yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SubmissionsTab({ contestId }) {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailId, setDetailId] = useState(null);

  const load = async (p = 1) => {
    try {
      const res = await api.get(`/admin/submissions?page=${p}&limit=15&contestId=${contestId}`);
      if (res.data.success) { setData(res.data.data); setTotalPages(res.data.pagination.total_pages); setPage(res.data.pagination.current_page); }
    } catch {}
  };
  useEffect(() => { load(); const i = setInterval(() => load(), 10000); return () => clearInterval(i); }, [contestId]);

  const handleToggle = async (id) => {
    if (!confirm('Toggle this submission type?')) return;
    try { await api.put(`/admin/submissions/${id}/toggle`); load(page); } catch {}
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete this submission? This will also remove associated points.')) return;
    try { await api.delete(`/admin/submissions/${id}`); load(page); } catch {}
  };

  return (
    <>
      <h4 className="fw-bold mb-4"><i className="fas fa-file-alt me-2" style={{ color: 'var(--accent)' }}></i>Submissions</h4>
      <div className="neon-card p-0">
        <div className="table-responsive">
          <table className="neon-table" style={{ marginBottom: 0 }}>
            <thead><tr><th>ID</th><th>User</th><th>Challenge</th><th>Flag</th><th>Type</th><th>Actions</th><th>Time</th></tr></thead>
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
              {data.length === 0 && <tr><td colSpan="7" className="text-center">No submissions.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="d-flex justify-content-center gap-2 mt-4">
          <button className="btn btn-neon-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
          <span className="align-self-center">Page {page} of {totalPages}</span>
          <button className="btn btn-neon-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
        </div>
      )}
      {detailId && <SubmissionDetailsModal submissionId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function FirstBloodTab({ contestId }) {
  const [bloods, setBloods] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/contests/${contestId}/first-blood`);
        if (res.data.success) setBloods(res.data.bloods);
      } catch {}
    };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [contestId]);
  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-bold mb-0"><i className="fas fa-skull me-2" style={{ color: 'var(--accent)' }}></i>First Blood</h4>
        <a href={`/api/admin/first-blood/${contestId}/export`} className="btn btn-neon-outline btn-sm" download>
          <i className="fas fa-download me-1"></i> Export CSV
        </a>
      </div>
      <div className="neon-card p-0">
        <div className="table-responsive">
          <table className="neon-table" style={{ marginBottom: 0 }}>
            <thead><tr><th>Challenge</th><th>Category</th><th>Points</th><th>First Solver</th><th>Solved At</th></tr></thead>
            <tbody>
              {bloods.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No challenges solved yet.</td></tr>
              ) : (
                bloods.map(b => (
                  <tr key={b._id}>
                    <td className="fw-bold">{b.challenge_name}</td>
                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{b.category}</span></td>
                    <td>{b.points}</td>
                    <td><span className="fw-bold" style={{ color: 'var(--accent)' }}>{b.solver_name}</span></td>
                    <td>{new Date(b.solved_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SettingsTab({ contest, onUpdate, onDeleted }) {
  const { showToast } = useToast();
  const now = useServerTime();
  const [freezeTime, setFreezeTime] = useState(contest.scoreboard_freeze_time ? new Date(contest.scoreboard_freeze_time) : null);
  const [editForm, setEditForm] = useState({ title: contest.title, description: contest.description || '', banner_url: contest.banner_url || '', bannerFile: null, startDate: contest.startDate ? new Date(contest.startDate) : null, endDate: contest.endDate ? new Date(contest.endDate) : null });
  const [uploading, setUploading] = useState(false);
  const [preRegFields, setPreRegFields] = useState(contest.pre_registration_fields || []);
  const [preRegEnabled, setPreRegEnabled] = useState(contest.pre_registration_enabled || false);

  useEffect(() => {
    setPreRegEnabled(contest.pre_registration_enabled || false);
    setPreRegFields(contest.pre_registration_fields || []);
  }, [contest.pre_registration_enabled, contest.pre_registration_fields]);

  const FIELD_TYPES = ['text', 'email', 'number', 'select', 'textarea'];

  const handleToggle = async (field, value) => {
    try {
      const res = await api.put(`/admin/contests/${contest._id}`, { [field]: value });
      if (res.data.success) { showToast('Updated!', 'success'); onUpdate(); }
    } catch { showToast('Failed to update', 'error'); }
  };

  const handleFreeze = async () => {
    try {
      const val = freezeTime ? freezeTime.toISOString() : null;
      const res = await api.put(`/admin/contests/${contest._id}`, { scoreboard_freeze_time: val });
      if (res.data.success) { showToast(val ? 'Scoreboard frozen!' : 'Freeze removed!', 'success'); onUpdate(); }
    } catch { showToast('Failed to update freeze time', 'error'); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let bannerUrl = editForm.banner_url;
      if (editForm.bannerFile) {
        const fd = new FormData();
        fd.append('banner', editForm.bannerFile);
        const upRes = await api.post('/admin/upload-banner', fd);
        bannerUrl = upRes.data.banner_url;
      }
      const payload = {
        title: editForm.title,
        description: editForm.description,
        banner_url: bannerUrl,
        startDate: editForm.startDate ? editForm.startDate.toISOString() : null,
        endDate: editForm.endDate ? editForm.endDate.toISOString() : null,
      };
      await api.put(`/admin/contests/${contest._id}`, payload);
      showToast('Contest updated!', 'success');
      onUpdate();
    } catch (err) { showToast(err.response?.data?.error || 'Error updating contest', 'error'); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this contest and ALL its challenges, submissions, and solves?')) return;
    try {
      await api.delete(`/admin/contests/${contest._id}`);
      showToast('Contest deleted.', 'success');
      onDeleted();
    } catch { showToast('Error deleting contest', 'error'); }
  };

  const isFrozen = contest.scoreboard_freeze_time && now > new Date(contest.scoreboard_freeze_time).getTime();
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <>
      <h4 className="fw-bold mb-4"><i className="fas fa-cogs me-2" style={{ color: 'var(--accent)' }}></i>Contest Settings</h4>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Submission Status</h5>
            <p className="mb-3">
              <span className={`badge ${contest.submission_status === 'open' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.85rem', padding: '0.35em 0.8em' }}>
                {contest.submission_status?.toUpperCase() || 'OPEN'}
              </span>
            </p>
            <div className="d-flex gap-2">
              <button className="btn btn-neon btn-sm" disabled={contest.submission_status === 'open'} onClick={() => handleToggle('submission_status', 'open')}>
                <i className="fas fa-play me-1"></i> Open
              </button>
              <button className="btn btn-neon-danger btn-sm" disabled={contest.submission_status === 'closed'} onClick={() => handleToggle('submission_status', 'closed')}>
                <i className="fas fa-stop me-1"></i> Close
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Scoreboard</h5>
            <p className="mb-3">
              <span className={`badge ${contest.scoreboard_visibility === 'public' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '0.85rem', padding: '0.35em 0.8em' }}>
                {contest.scoreboard_visibility === 'public' ? 'PUBLIC' : 'HIDDEN'}
              </span>
            </p>
            <div className="d-flex gap-2">
              <button className="btn btn-neon btn-sm" disabled={contest.scoreboard_visibility === 'public'} onClick={() => handleToggle('scoreboard_visibility', 'public')}>
                <i className="fas fa-eye me-1"></i> Show
              </button>
              <button className="btn btn-neon-danger btn-sm" disabled={contest.scoreboard_visibility === 'hidden'} onClick={() => handleToggle('scoreboard_visibility', 'hidden')}>
                <i className="fas fa-eye-slash me-1"></i> Hide
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3"><i className="fas fa-user-plus me-2" style={{ color: 'var(--accent)' }}></i>Pre-Registration</h5>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {preRegEnabled ? 'When enabled, pre-registration is required. Users must pre-register before the registration window closes to participate. Disable for open participation.' : 'Pre-registration is disabled. Anyone can participate without pre-registering.'}
            </p>
            <button className={`btn btn-sm ${preRegEnabled ? 'btn-neon' : 'btn-neon-outline'}`} onClick={async () => {
              try {
                await api.put(`/admin/contests/${contest._id}/pre-registration`, { enabled: !preRegEnabled });
                setPreRegEnabled(!preRegEnabled);
                showToast(!preRegEnabled ? 'Pre-registration enabled!' : 'Pre-registration disabled!', 'success');
                onUpdate();
              } catch { showToast('Failed to update', 'error'); }
            }}>
              <i className={`fas ${preRegEnabled ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i> {preRegEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        <div className="col-12">
          <div className="neon-card">
            <h5 className="mb-3"><i className="fas fa-layer-group me-2" style={{ color: 'var(--accent)' }}></i>Pre-Registration Form Fields</h5>
            {preRegFields.map((field, i) => (
              <div key={i} className="d-flex align-items-center gap-2 mb-2 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)' }}>
                <input className="form-control form-control-sm" style={{ width: '180px' }} value={field.label} onChange={e => {
                  const copy = [...preRegFields];
                  copy[i] = { ...copy[i], label: e.target.value };
                  setPreRegFields(copy);
                }} placeholder="Field label" />
                <select className="form-select form-select-sm" style={{ width: '120px' }} value={field.type} onChange={e => {
                  const copy = [...preRegFields];
                  copy[i] = { ...copy[i], type: e.target.value, options: e.target.value === 'select' ? (copy[i].options || ['']) : undefined };
                  setPreRegFields(copy);
                }}>
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="form-check form-check-inline mb-0">
                  <input className="form-check-input" type="checkbox" id={`required-${i}`} checked={field.required} onChange={e => {
                    const copy = [...preRegFields];
                    copy[i] = { ...copy[i], required: e.target.checked };
                    setPreRegFields(copy);
                  }} />
                  <label className="form-check-label" htmlFor={`required-${i}`} style={{ fontSize: '0.8rem' }}>Req</label>
                </div>
                {field.type === 'select' && (
                  <input className="form-control form-control-sm" style={{ width: '160px' }} value={(field.options || []).join(', ')} onChange={e => {
                    const copy = [...preRegFields];
                    copy[i] = { ...copy[i], options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setPreRegFields(copy);
                  }} placeholder="option1, option2" />
                )}
                <button className="btn btn-neon-danger btn-sm py-0 px-1" onClick={() => setPreRegFields(preRegFields.filter((_, j) => j !== i))}><i className="fas fa-times"></i></button>
              </div>
            ))}
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-neon-outline btn-sm" onClick={() => setPreRegFields([...preRegFields, { label: '', type: 'text', required: true, options: [] }])}>
                <i className="fas fa-plus me-1"></i> Add Field
              </button>
              <button className="btn btn-neon btn-sm" onClick={async () => {
                try {
                  await api.put(`/admin/contests/${contest._id}/pre-registration`, { fields: preRegFields });
                  showToast('Form fields saved!', 'success');
                  onUpdate();
                } catch { showToast('Failed to save fields', 'error'); }
              }}>
                <i className="fas fa-save me-1"></i> Save Fields
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Pause Contest</h5>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {contest.paused
                ? 'Challenges are hidden from participants.'
                : 'Challenges are currently visible to participants.'}
            </p>
            <button className={`btn btn-sm ${contest.paused ? 'btn-neon' : 'btn-neon-outline'}`} onClick={() => handleToggle('paused', !contest.paused)}>
              <i className={`fas ${contest.paused ? 'fa-play' : 'fa-pause'} me-1`}></i> {contest.paused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Freeze Scoreboard</h5>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isFrozen
                ? `Frozen since ${formatDate(contest.scoreboard_freeze_time)}`
                : contest.scoreboard_freeze_time
                  ? `Will freeze at ${formatDate(contest.scoreboard_freeze_time)}`
                  : 'Scoreboard is live.'}
            </p>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Freeze At</label>
              <div className="d-flex gap-2 align-items-center">
                <div style={{ flex: 1 }}>
                  <DatePicker
                    selected={freezeTime}
                    onChange={date => setFreezeTime(date)}
                    showTimeSelect
                    dateFormat="MMM d, yyyy h:mm aa"
                    timeFormat="h:mm aa"
                    timeIntervals={15}
                    isClearable
                    placeholderText="Select freeze time"
                    className="form-control form-control-sm"
                    wrapperClassName="datepicker-wrapper"
                  />
                </div>
                <button className="btn btn-neon-outline btn-sm" onClick={handleFreeze}><i className="fas fa-snowflake me-1"></i> Apply</button>
                {contest.scoreboard_freeze_time && (
                  <button className="btn btn-neon-danger btn-sm" onClick={() => { setFreezeTime(null); handleToggle('scoreboard_freeze_time', null); }}>
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Participation Mode</h5>
            <p className="mb-3">
              <span className={`badge ${contest.participation_mode === 'solo' ? 'bg-info' : 'bg-primary'}`} style={{ fontSize: '0.85rem', padding: '0.35em 0.8em' }}>
                {contest.participation_mode === 'solo' ? 'SOLO' : 'TEAM'}
              </span>
            </p>
            <div className="d-flex gap-2 mb-3">
              <button className="btn btn-neon btn-sm" disabled={contest.participation_mode === 'solo'} onClick={() => handleToggle('participation_mode', 'solo')}>
                <i className="fas fa-user me-1"></i> Solo
              </button>
              <button className="btn btn-neon-outline btn-sm" disabled={contest.participation_mode === 'team'} onClick={() => handleToggle('participation_mode', 'team')}>
                <i className="fas fa-users me-1"></i> Team
              </button>
            </div>
            {contest.participation_mode === 'team' && (
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Team Size</label>
                <div className="d-flex gap-2 align-items-center">
                  <input type="number" className="form-control form-control-sm" style={{ width: '80px' }} value={contest.max_team_size || 4} onChange={e => {
                    const v = parseInt(e.target.value) || 1;
                    handleToggle('max_team_size', v);
                  }} min={1} max={20} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>members</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="neon-card h-100">
            <h5 className="mb-3">Time Settings</h5>
            <p><strong>Start:</strong> {formatDate(contest.startDate)}</p>
            <p><strong>End:</strong> {formatDate(contest.endDate)}</p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`badge ${contest.status === 'active' ? 'bg-success' : contest.status === 'upcoming' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                {contest.status?.toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        <div className="col-12">
          <div className="neon-card">
            <h5 className="mb-3"><i className="fas fa-edit me-2" style={{ color: 'var(--accent)' }}></i>Edit Contest</h5>
            <form onSubmit={handleEditSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-control" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Description</label>
                  <input type="text" className="form-control" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Banner Image</label>
                  {editForm.banner_url && (
                    <div className="mb-2">
                      <img src={editForm.banner_url} alt="Banner preview" style={{ maxWidth: '200px', maxHeight: '80px', borderRadius: 'var(--radius)', objectFit: 'cover' }} />
                    </div>
                  )}
                  <input type="file" className="form-control" accept="image/*" onChange={e => setEditForm({ ...editForm, bannerFile: e.target.files[0], banner_url: '' })} />
                  {editForm.bannerFile && <small style={{ color: 'var(--text-muted)' }}>{editForm.bannerFile.name}</small>}
                  {editForm.banner_url && <button type="button" className="btn btn-sm btn-neon-outline mt-1" onClick={() => setEditForm({ ...editForm, banner_url: '', bannerFile: null })}>Remove banner</button>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Start Date</label>
                  <DatePicker
                    selected={editForm.startDate}
                    onChange={date => setEditForm({ ...editForm, startDate: date })}
                    showTimeSelect dateFormat="MMM d, yyyy h:mm aa" timeFormat="h:mm aa" timeIntervals={15}
                    isClearable placeholderText="Select start date"
                    className="form-control" wrapperClassName="datepicker-wrapper"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">End Date</label>
                  <DatePicker
                    selected={editForm.endDate}
                    onChange={date => setEditForm({ ...editForm, endDate: date })}
                    showTimeSelect dateFormat="MMM d, yyyy h:mm aa" timeFormat="h:mm aa" timeIntervals={15}
                    isClearable placeholderText="Select end date"
                    className="form-control" wrapperClassName="datepicker-wrapper"
                    minDate={editForm.startDate || undefined}
                    filterTime={time => !editForm.startDate || time > editForm.startDate}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-neon btn-sm mt-3" disabled={uploading}><i className="fas fa-save me-1"></i> {uploading ? 'Uploading...' : 'Save Changes'}</button>
            </form>
          </div>
        </div>

        <div className="col-12">
          <div className="neon-card">
            <h5 className="mb-3">Danger Zone</h5>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Archiving hides this contest from the public contests list. Deleting removes all associated challenges, submissions, and solves.</p>
            <div className="d-flex gap-2">
              <button className="btn btn-neon-outline btn-sm" onClick={async () => {
                try {
                  await api.put(`/admin/contests/${contest._id}`, { isArchived: !contest.isArchived });
                  showToast(contest.isArchived ? 'Contest unarchived.' : 'Contest archived.', 'success');
                  onUpdate();
                } catch { showToast('Error updating contest', 'error'); }
              }}>
                <i className={`fas ${contest.isArchived ? 'fa-box-open' : 'fa-archive'} me-1`}></i> {contest.isArchived ? 'Unarchive' : 'Archive'}
              </button>
              <button className="btn btn-neon-danger btn-sm" onClick={handleDelete}><i className="fas fa-trash me-1"></i> Delete</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function NotificationsTab({ contestId }) {
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', type: 'alert' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/contests/${contestId}/notifications`);
      if (res.data.success) setNotifications(res.data.notifications);
    } catch { showToast('Failed to load notifications', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [contestId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title) { showToast('Title is required', 'error'); return; }
    try {
      const res = await api.post(`/admin/contests/${contestId}/notifications`, form);
      if (res.data.success) { showToast('Notification sent!', 'success'); setForm({ title: '', content: '', type: 'alert' }); setShowForm(false); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to send notification', 'error'); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete notification "${title}"?`)) return;
    try {
      const res = await api.delete(`/admin/notifications/${id}`);
      if (res.data.success) { showToast('Notification deleted', 'success'); load(); }
    } catch { showToast('Delete failed', 'error'); }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0"><i className="fas fa-bell me-2" style={{ color: 'var(--accent)' }}></i>Notifications</h4>
        <button className="btn btn-neon btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="fas fa-plus me-1"></i> {showForm ? 'Cancel' : 'Send'}
        </button>
      </div>

      {showForm && (
        <div className="neon-card p-3 mb-4">
          <h5 className="mb-3">Send Notification</h5>
          <form onSubmit={handleSend}>
            <div className="mb-3">
              <label className="form-label">Title</label>
              <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Content (optional)</label>
              <textarea className="form-control" rows="3" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="alert">Alert (banner)</option>
                <option value="pop">Pop (toast + sound)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-neon btn-sm"><i className="fas fa-paper-plane me-1"></i> Send</button>
          </form>
        </div>
      )}

      {loading ? <div className="text-center py-4"><div className="spinner-neon"></div></div> : notifications.length === 0 ? (
        <div className="neon-card text-center py-5">
          <i className="fas fa-bell-slash" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
          <p className="mt-3 text-secondary">No notifications sent yet.</p>
        </div>
      ) : (
        notifications.map(n => (
          <div key={n._id} className="neon-card p-3 mb-3">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--accent)' }}>{n.title}</h6>
                  <span className={`badge ${n.type === 'pop' ? 'bg-warning text-dark' : 'bg-info'}`} style={{ fontSize: '0.6rem' }}>{n.type === 'pop' ? 'Pop' : 'Alert'}</span>
                </div>
                {n.content && <p className="mb-0" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{n.content}</p>}
                <small style={{ color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
              <button className="btn btn-neon-danger btn-sm py-0 px-1" style={{ fontSize: '0.7rem' }} onClick={() => handleDelete(n._id, n.title)}><i className="fas fa-trash"></i></button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function TeamsTab({ contestId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordModal, setPasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/contests/${contestId}/teams`);
      if (res.data.success) setTeams(res.data.teams);
    } catch { showToast('Failed to load teams', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [contestId]);

  const handleChangeCaptain = async (teamId, userId) => {
    try {
      const res = await api.put(`/admin/teams/${teamId}/captain`, { user_id: userId });
      if (res.data.success) { showToast('Captain updated!', 'success'); load(); }
    } catch { showToast('Failed to update captain', 'error'); }
  };

  const handleRemoveMember = async (teamId, userId, userName) => {
    if (!confirm(`Remove ${userName} from their team?`)) return;
    try {
      const res = await api.delete(`/admin/teams/${teamId}/members/${userId}`);
      if (res.data.success) { showToast(res.data.message, 'success'); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to remove member', 'error'); }
  };

  const handleDisband = async (teamId, name) => {
    if (!confirm(`Disband team "${name}"? This cannot be undone.`)) return;
    try {
      const res = await api.delete(`/admin/teams/${teamId}`);
      if (res.data.success) { showToast(res.data.message, 'success'); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to disband team', 'error'); }
  };

  const handleChangePassword = async (teamId) => {
    if (!newPassword || newPassword.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
    try {
      const res = await api.put(`/admin/teams/${teamId}/password`, { password: newPassword });
      if (res.data.success) { showToast('Password changed!', 'success'); setPasswordModal(null); setNewPassword(''); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to change password', 'error'); }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-neon"></div></div>;

  return (
    <>
      <h4 className="fw-bold mb-4"><i className="fas fa-users me-2" style={{ color: 'var(--accent)' }}></i>Teams</h4>

      {passwordModal && (
        <div className="neon-card p-3 mb-4">
          <h5 className="mb-3">Change Password for {passwordModal.name}</h5>
          <div className="d-flex gap-2">
            <input type="password" className="form-control form-control-sm" style={{ maxWidth: '300px' }} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 4 chars)" />
            <button className="btn btn-neon btn-sm" onClick={() => handleChangePassword(passwordModal._id)}><i className="fas fa-save me-1"></i> Save</button>
            <button className="btn btn-neon-outline btn-sm" onClick={() => { setPasswordModal(null); setNewPassword(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="neon-card text-center py-5">
          <i className="fas fa-users" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
          <p className="mt-3 text-secondary">No teams have been created for this contest yet.</p>
        </div>
      ) : (
        <div className="neon-card p-0">
          <div className="table-responsive">
            <table className="neon-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Captain</th>
                  <th>Members</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => (
                  <tr key={team._id}>
                    <td className="fw-bold">{team.name}</td>
                    <td>
                      <span className="badge bg-warning text-dark">{team.captain?.user_name || 'Unknown'}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {(team.members || []).map(m => m.user_name).join(', ')}
                    </td>
                    <td>{team.members?.length || 1}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button className="btn btn-neon-outline btn-sm" onClick={() => setPasswordModal(team)} title="Change Password">
                          <i className="fas fa-key"></i>
                        </button>
                        <select className="form-select form-select-sm" style={{ width: 'auto', fontSize: '0.75rem' }} value="" onChange={e => { if (e.target.value) handleChangeCaptain(team._id, e.target.value); e.target.value = ''; }}>
                          <option value="">Transfer Captain</option>
                          {(team.members || []).filter(m => m._id !== team.captain?._id).map(m => (
                            <option key={m._id} value={m._id}>{m.user_name}</option>
                          ))}
                        </select>
                        {(team.members || []).filter(m => m._id !== team.captain?._id).map(m => (
                          <button key={m._id} className="btn btn-neon-danger btn-sm" onClick={() => handleRemoveMember(team._id, m._id, m.user_name)} title={`Remove ${m.user_name}`}>
                            <i className="fas fa-user-minus"></i>
                          </button>
                        ))}
                        <button className="btn btn-neon-danger btn-sm" onClick={() => handleDisband(team._id, team.name)} title="Disband Team">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function SolvesTab({ contestId }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get(`/admin/solves?contestId=${contestId}`).then(res => { if (res.data.success) setData(res.data.data); }).catch(() => {});
  }, [contestId]);

  return (
    <>
      <h4 className="fw-bold mb-4"><i className="fas fa-check-circle me-2" style={{ color: 'var(--accent)' }}></i>Solves</h4>
      <div className="neon-card p-0">
        <div className="table-responsive">
          <table className="neon-table" style={{ marginBottom: 0 }}>
            <thead><tr><th>ID</th><th>User</th><th>Challenge</th><th>Points</th><th>Submitted Flag</th><th>Solved At</th></tr></thead>
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
    </>
  );
}

function PreRegistrationsTab({ contestId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/contests/${contestId}/pre-registrations`);
      if (res.data.success) setList(res.data.data);
    } catch { showToast('Failed to load pre-registrations', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [contestId]);

  const handleStatus = async (userId, status) => {
    try {
      await api.put(`/admin/contests/${contestId}/pre-registrations/${userId}/status`, { status });
      showToast(`Pre-registration ${status}!`, 'success');
      load();
    } catch { showToast('Failed to update status', 'error'); }
  };

  const handleRemove = async (userId) => {
    if (!confirm('Remove this pre-registration?')) return;
    try {
      await api.delete(`/admin/contests/${contestId}/pre-registrations/${userId}`);
      showToast('Pre-registration removed.', 'success');
      load();
    } catch { showToast('Failed to remove', 'error'); }
  };

  const statusBadge = (status) => {
    if (status === 'accepted') return <span className="badge bg-success">Accepted</span>;
    if (status === 'rejected') return <span className="badge bg-danger">Rejected</span>;
    return <span className="badge" style={{ background: '#facc15', color: '#000' }}>Pending</span>;
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0"><i className="fas fa-user-plus me-2" style={{ color: 'var(--accent)' }}></i>Pre-Registrations</h4>
        <a href={`${api.defaults.baseURL || ''}/admin/contests/${contestId}/pre-registrations/export`} className="btn btn-neon-outline btn-sm" download>
          <i className="fas fa-download me-1"></i> Export CSV
        </a>
      </div>
      {loading ? <div className="spinner-neon"></div> : (
        <div className="neon-card p-0">
          <div className="table-responsive">
            <table className="neon-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr><th>#</th><th>Name</th><th>Email</th><th>Username</th><th>Member ID</th><th>Registered At</th><th>Status</th><th>Data</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r._id}>
                    <td>{i + 1}</td>
                    <td>{r.user_id?.full_name || '—'}</td>
                    <td>{r.user_id?.email || '—'}</td>
                    <td>{r.user_id?.user_name || '—'}</td>
                    <td>{r.user_id?.member_id || '—'}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.data ? Object.entries(r.data).map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>) : '—'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {r.status !== 'accepted' && <button className="btn btn-neon btn-sm" onClick={() => handleStatus(r.user_id?._id || r.user_id, 'accepted')} title="Accept"><i className="fas fa-check"></i></button>}
                        {r.status !== 'rejected' && <button className="btn btn-neon-danger btn-sm" onClick={() => handleStatus(r.user_id?._id || r.user_id, 'rejected')} title="Reject"><i className="fas fa-times"></i></button>}
                        <button className="btn btn-neon-danger btn-sm" onClick={() => handleRemove(r.user_id?._id || r.user_id)} title="Remove"><i className="fas fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan="9" className="text-center">No pre-registrations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function BansTab({ contestId, contest }) {
  const [bans, setBans] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: contest?.participation_mode === 'team' ? 'team' : 'user', target: '', reason: '' });
  const { showToast } = useToast();
  const isTeam = contest?.participation_mode === 'team';

  const load = async () => {
    setLoading(true);
    try {
      const banRes = await api.get(`/admin/contests/${contestId}/bans`);
      if (banRes.data.success) setBans(banRes.data.data);
      if (isTeam) {
        const teamRes = await api.get(`/admin/contests/${contestId}/teams`);
        if (teamRes.data.success) setTeams(teamRes.data.teams || []);
      } else {
        const userRes = await api.get('/admin/users');
        if (userRes.data.success) setUsers((userRes.data.users || []).filter(u => u.role === 1));
      }
    } catch { showToast('Failed to load bans', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [contestId, isTeam]);

  const bannedIds = new Set(bans.map(b => (b.user_id?._id || b.team_id?._id)?.toString()));
  const userCandidates = users.filter(u => !bannedIds.has(u._id));
  const teamCandidates = teams.filter(t => !bannedIds.has(t._id));

  const handleBan = async () => {
    if (!form.target) { showToast('Select a target to ban', 'error'); return; }
    try {
      const payload = form.type === 'team'
        ? { team_id: form.target }
        : { user_id: form.target };
      if (form.reason) payload.reason = form.reason;
      const res = await api.post(`/admin/contests/${contestId}/bans`, payload);
      if (res.data.success) { showToast('Banned.', 'success'); setForm({ ...form, target: '', reason: '' }); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Ban failed', 'error'); }
  };

  const handleUnban = async (ban) => {
    const name = ban.team_id ? `team "${ban.team_id?.name || ban.team_id?._id}"` : `user "${ban.user_id?.user_name || ban.user_id?._id}"`;
    if (!confirm(`Unban ${name}? Their points remain intact.`)) return;
    try {
      const res = await api.delete(`/admin/contests/${contestId}/bans/${ban._id}`);
      if (res.data.success) { showToast('Unbanned. Points preserved.', 'success'); load(); }
    } catch { showToast('Unban failed', 'error'); }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0"><i className="fas fa-ban me-2" style={{ color: 'var(--accent)' }}></i>Bans</h4>
      </div>

      <div className="neon-card p-3 mb-4">
        <h5 className="mb-3"><i className="fas fa-user-slash me-2" style={{ color: 'var(--accent)' }}></i>Ban a {isTeam ? 'User or Team' : 'User'}</h5>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Banned users/teams lose access to this contest (challenges, submissions, hints, teams). Their points stay on the scoreboard and are unaffected if you unban them later.
        </p>
        <div className="row g-2 align-items-end">
          {isTeam && (
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Type</label>
              <select className="form-select form-select-sm" value={form.type} onChange={e => { setForm({ ...form, type: e.target.value, target: '' }); }}>
                <option value="team">Team</option>
                <option value="user">User</option>
              </select>
            </div>
          )}
          <div className={isTeam ? 'col-md-4' : 'col-md-6'}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>{form.type === 'team' ? 'Team' : 'User'}</label>
            <select className="form-select form-select-sm" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
              <option value="">Select {form.type === 'team' ? 'a team' : 'a user'}...</option>
              {(form.type === 'team' ? teamCandidates : userCandidates).map(t => (
                form.type === 'team'
                  ? <option key={t._id} value={t._id}>{t.name}</option>
                  : <option key={t._id} value={t._id}>{t.user_name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Reason (optional)</label>
            <input className="form-control form-control-sm" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Cheating, rule violation" />
          </div>
          <div className="col-md-1">
            <button className="btn btn-neon btn-sm w-100" onClick={handleBan}><i className="fas fa-gavel me-1"></i>Ban</button>
          </div>
        </div>
      </div>

      {loading ? <div className="spinner-neon"></div> : (
        <div className="neon-card p-0">
          <div className="table-responsive">
            <table className="neon-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr><th>Type</th><th>Target</th><th>Reason</th><th>Banned By</th><th>Banned At</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {bans.map(b => (
                  <tr key={b._id}>
                    <td><span className={`badge ${b.team_id ? 'bg-warning text-dark' : 'bg-danger'}`}>{b.team_id ? 'TEAM' : 'USER'}</span></td>
                    <td className="fw-bold">
                      {b.team_id ? (b.team_id.name || b.team_id._id) : (b.user_id.user_name || b.user_id._id)}
                      {b.user_id && !b.team_id && <small style={{ color: 'var(--text-muted)' }}> — {b.user_id.full_name || ''}</small>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{b.reason || '—'}</td>
                    <td>{b.banned_by?.user_name || '—'}</td>
                    <td>{new Date(b.createdAt).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-neon-outline btn-sm" onClick={() => handleUnban(b)} title="Unban (points remain)">
                        <i className="fas fa-user-check"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {bans.length === 0 && <tr><td colSpan="6" className="text-center">No users or teams are banned from this contest.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminContestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'challenges';
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadContest = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/contests/${id}`);
      if (res.data.success) {
        setContest(res.data.contest);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadContest(); }, [id]);

  if (loading) return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4"><div className="d-flex justify-content-center p-5"><div className="spinner-neon"></div></div></div>
    </div>
  );

  if (!contest) return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-exclamation-triangle me-2"></i>Contest not found.
          <br /><Link to="/admin/contests" className="btn btn-neon-outline btn-sm mt-3">Back to Contests</Link>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { key: 'challenges', icon: 'fa-skull-crossbones', label: 'Challenges' },
    { key: 'scoreboard', icon: 'fa-trophy', label: 'Scoreboard' },
    { key: 'submissions', icon: 'fa-file-alt', label: 'Submissions' },
    { key: 'solves', icon: 'fa-check-circle', label: 'Solves' },
    { key: 'first-blood', icon: 'fa-skull', label: 'First Blood' },
    { key: 'pre-registrations', icon: 'fa-user-plus', label: 'Pre-Reg' },
    { key: 'notifications', icon: 'fa-bell', label: 'Notifications' },
    { key: 'teams', icon: 'fa-users', label: 'Teams' },
    { key: 'bans', icon: 'fa-ban', label: 'Bans' },
    { key: 'settings', icon: 'fa-cogs', label: 'Settings' },
  ];

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <div className="d-flex align-items-center gap-3 mb-4">
          <Link to="/admin/contests" className="btn btn-neon-outline btn-sm"><i className="fas fa-arrow-left me-1"></i> All Contests</Link>
          <div>
            <h3 className="fw-bold mb-0" style={{ letterSpacing: '-0.02em' }}>{contest.title}</h3>
            <small style={{ color: 'var(--text-muted)' }}>Contest ID: {contest._id}</small>
          </div>
        </div>

        <ul className="nav nav-tabs mb-4">
          {tabs.map(t => (
            <li key={t.key} className="nav-item">
              <Link to={`?tab=${t.key}`} className={`nav-link ${tab === t.key ? 'active' : ''}`}>
                <i className={`fas ${t.icon} me-1`}></i> {t.label}
              </Link>
            </li>
          ))}
        </ul>

        {tab === 'challenges' && <ChallengesTab contestId={id} />}
        {tab === 'scoreboard' && <ScoreboardTab contestId={id} contest={contest} />}
        {tab === 'submissions' && <SubmissionsTab contestId={id} />}
        {tab === 'first-blood' && <FirstBloodTab contestId={id} />}
        {tab === 'solves' && <SolvesTab contestId={id} />}
        {tab === 'pre-registrations' && <PreRegistrationsTab contestId={id} />}
        {tab === 'notifications' && <NotificationsTab contestId={id} />}
        {tab === 'teams' && <TeamsTab contestId={id} />}
        {tab === 'bans' && <BansTab contestId={id} contest={contest} />}
        {tab === 'settings' && <SettingsTab contest={contest} onUpdate={loadContest} onDeleted={() => navigate('/admin/contests')} />}
      </div>
    </div>
  );
}
