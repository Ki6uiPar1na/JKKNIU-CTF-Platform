import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ full_name: '', user_name: '', email: '', new_password: '' });
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const isSuperAdmin = currentUser?.role === 2;

  const load = async () => {
    try { const res = await api.get('/admin/users'); if (res.data.success) setUsers(res.data.users); }
    catch { showToast('Failed to load users', 'error'); }
  };
  useEffect(() => { load(); }, []);

  const handleRemove = async (id) => {
    if (!confirm('Remove this user?')) return;
    try { const res = await api.delete(`/admin/users/${id}`); if (res.data.success) { showToast('User removed', 'success'); load(); } }
    catch { showToast('Failed to remove user', 'error'); }
  };

  const handleMakeAdmin = async (id) => {
    if (!confirm('Promote this user to admin?')) return;
    try { const res = await api.post(`/admin/users/${id}/make-admin`); if (res.data.success) { showToast('User promoted!', 'success'); load(); } }
    catch { showToast('Failed to promote user', 'error'); }
  };

  const handleMakeSuperadmin = async (id) => {
    if (!confirm('Promote this admin to superadmin?')) return;
    try { const res = await api.post(`/admin/users/${id}/make-superadmin`); if (res.data.success) { showToast('Promoted to superadmin!', 'success'); load(); } }
    catch { showToast('Failed to promote user', 'error'); }
  };

  const handleDemote = async (id) => {
    if (!confirm('Demote this admin to regular user?')) return;
    try { const res = await api.post(`/admin/users/${id}/demote`); if (res.data.success) { showToast('Admin demoted to user!', 'success'); load(); } }
    catch { showToast('Failed to demote user', 'error'); }
  };

  const openEdit = (u) => {
    setForm({ full_name: u.full_name, user_name: u.user_name, email: u.email, new_password: '' });
    setEditUser(u);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = { full_name: form.full_name, user_name: form.user_name, email: form.email };
      if (form.new_password) payload.new_password = form.new_password;
      const res = await api.put(`/admin/users/${editUser._id}`, payload);
      if (res.data.success) { showToast('User updated!', 'success'); setEditUser(null); load(); }
    } catch (err) { showToast(err.response?.data?.error || 'Update failed', 'error'); }
  };

  const roleBadge = (role) => {
    if (role === 2) return <span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>Superadmin</span>;
    if (role === 0) return <span className="badge badge-active">Admin</span>;
    return <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>User</span>;
  };

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-users me-2" style={{ color: 'var(--accent)' }}></i>Users</h2>

        {editUser && (
          <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="modal-dialog">
              <div className="modal-content" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Edit User</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setEditUser(null)}></button>
                </div>
                <form onSubmit={handleEdit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Full Name</label>
                      <input className="form-control" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <input className="form-control" value={form.user_name} onChange={e => setForm({...form, user_name: e.target.value})} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                      <input type="password" className="form-control" value={form.new_password} onChange={e => setForm({...form, new_password: e.target.value})} placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-neon-outline btn-sm" onClick={() => setEditUser(null)}>Cancel</button>
                    <button type="submit" className="btn btn-neon btn-sm"><i className="fas fa-save me-1"></i> Save Changes</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="neon-card p-0">
          <div className="table-responsive">
            <table className="neon-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr><th>#</th><th>ID</th><th>Member ID</th><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u._id}>
                    <td>{i + 1}</td>
                    <td>{u._id.slice(-6)}</td>
                    <td>{u.member_id}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><Link to={`/profile/${u._id}`} className="fw-bold">{u.user_name}</Link></td>
                    <td>{roleBadge(u.role)}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-neon-outline btn-sm" onClick={() => openEdit(u)} title="Edit"><i className="fas fa-edit"></i></button>
                        {u.role === 1 && <button className="btn btn-neon-outline btn-sm" onClick={() => handleMakeAdmin(u._id)} title="Make Admin"><i className="fas fa-shield-alt"></i></button>}
                        {u.role === 0 && isSuperAdmin && <button className="btn btn-neon-outline btn-sm" onClick={() => handleMakeSuperadmin(u._id)} title="Make Superadmin"><i className="fas fa-crown"></i></button>}
                        {u.role === 0 && isSuperAdmin && <button className="btn btn-neon-outline btn-sm" onClick={() => handleDemote(u._id)} title="Demote to User"><i className="fas fa-user"></i></button>}
                        {u.role !== 2 && <button className="btn btn-neon-danger btn-sm" onClick={() => handleRemove(u._id)} title="Remove"><i className="fas fa-trash"></i></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="8" className="text-center">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
