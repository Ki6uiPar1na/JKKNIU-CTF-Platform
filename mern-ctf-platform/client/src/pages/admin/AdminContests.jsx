import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AdminSidebar from '../../components/AdminSidebar';
import useServerTime from '../../hooks/useServerTime';

export default function AdminContests() {
  const [contests, setContests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', banner_url: '', bannerFile: null, startDate: null, endDate: null });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const now = useServerTime();
  const { showToast } = useToast();

  const load = async () => {
    try {
      const res = await api.get('/admin/contests');
      if (res.data.success) setContests(res.data.contests);
    } catch { showToast('Failed to load contests', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', banner_url: '', bannerFile: null, startDate: null, endDate: null });
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let bannerUrl = form.banner_url;
      if (form.bannerFile) {
        const fd = new FormData();
        fd.append('banner', form.bannerFile);
        const upRes = await api.post('/admin/upload-banner', fd);
        bannerUrl = upRes.data.banner_url;
      }
      await api.post('/admin/contests', {
        title: form.title,
        description: form.description,
        banner_url: bannerUrl,
        startDate: form.startDate ? form.startDate.toISOString() : null,
        endDate: form.endDate ? form.endDate.toISOString() : null,
      });
      showToast('Contest created!', 'success');
      resetForm();
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error saving contest', 'error');
    } finally { setUploading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';

  const statusBadge = (c) => {
    if (c.isArchived) return <span className="badge bg-secondary">Archived</span>;
    if (c.startDate && now < new Date(c.startDate).getTime()) return <span className="badge bg-warning text-dark">Upcoming</span>;
    if (c.endDate && now > new Date(c.endDate).getTime()) return <span className="badge bg-secondary">Ended</span>;
    return <span className="badge bg-success">Active</span>;
  };

  if (loading) return <div className="spinner-neon"></div>;

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-calendar-alt me-2" style={{ color: 'var(--accent)' }}></i>Contests</h3>
          <button className="btn btn-neon btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <i className="fas fa-plus me-1"></i> New Contest
          </button>
        </div>

        {showForm && (
          <div className="neon-card p-4 mb-4">
            <h5 className="mb-3" style={{ fontWeight: 700 }}>Create Contest</h5>
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Title *</label>
                  <input type="text" className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Banner Image</label>
                  <input type="file" className="form-control" accept="image/*" onChange={e => setForm({ ...form, bannerFile: e.target.files[0], banner_url: '' })} />
                  {form.bannerFile && <small style={{ color: 'var(--text-muted)' }}>{form.bannerFile.name}</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Start Date</label>
                  <DatePicker
                    selected={form.startDate}
                    onChange={date => setForm({ ...form, startDate: date })}
                    showTimeSelect
                    dateFormat="MMM d, yyyy h:mm aa"
                    timeFormat="h:mm aa"
                    timeIntervals={15}
                    isClearable
                    placeholderText="Select start date"
                    className="form-control"
                    wrapperClassName="datepicker-wrapper"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">End Date</label>
                    <DatePicker
                      selected={form.endDate}
                      onChange={date => setForm({ ...form, endDate: date })}
                      showTimeSelect
                      dateFormat="MMM d, yyyy h:mm aa"
                      timeFormat="h:mm aa"
                      timeIntervals={15}
                      isClearable
                      placeholderText="Select end date"
                      className="form-control"
                      wrapperClassName="datepicker-wrapper"
                      minDate={form.startDate || undefined}
                      filterTime={time => !form.startDate || time > form.startDate}
                    />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-neon btn-sm" disabled={uploading}><i className="fas fa-save me-1"></i> {uploading ? 'Uploading...' : 'Create'}</button>
                <button type="button" className="btn btn-neon-outline btn-sm" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="neon-card p-0">
          <div className="table-responsive">
            <table className="neon-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {contests.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No contests yet.</td></tr>
                ) : contests.map(c => (
                  <tr key={c._id}>
                    <td className="fw-bold">{c.title}</td>
                    <td>{statusBadge(c)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatDate(c.startDate)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatDate(c.endDate)}</td>
                    <td><Link to={`/admin/contests/${c._id}`} className="btn btn-neon-outline btn-sm">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
