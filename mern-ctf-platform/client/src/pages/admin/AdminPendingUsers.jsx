import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminPendingUsers() {
  const [users, setUsers] = useState([]);
  const { showToast } = useToast();

  const load = async () => {
    try { const res = await api.get('/admin/users/pending'); if (res.data.success) setUsers(res.data.data); }
    catch { showToast('Failed to load pending users', 'error'); }
  };
  useEffect(() => { load(); }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await api.put(`/admin/users/${id}/status`, { action });
      if (res.data.success) { showToast(res.data.message, 'success'); load(); }
    } catch { showToast('Action failed', 'error'); }
  };

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-user-clock me-2" style={{ color: 'var(--accent)' }}></i>Pending Users</h2>
        {users.length === 0 ? (
          <p>No pending users.</p>
        ) : (
          <div className="table-responsive">
            <table className="neon-table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Email</th><th>Username</th><th>Session</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u._id}>
                    <td>{i + 1}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.user_name}</td>
                    <td>{u.session}</td>
                    <td>
                      <button className="btn btn-neon btn-sm me-2" onClick={() => handleAction(u._id, 'approved')}>
                        <i className="fas fa-check me-1"></i> Approve
                      </button>
                      <button className="btn btn-neon-danger btn-sm" onClick={() => handleAction(u._id, 'rejected')}>
                        <i className="fas fa-times me-1"></i> Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
