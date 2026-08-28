import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';

export default function Profile() {
  const { user, refreshToken } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [contests, setContests] = useState([]);
  const [contestsLoading, setContestsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUserName(user.user_name || '');
    }
  }, [user]);

  useEffect(() => {
    api.get('/users/me/contests')
      .then(res => { if (res.data.success) setContests(res.data.data); })
      .catch(() => {})
      .finally(() => setContestsLoading(false));
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.put('/users/profile', { full_name: fullName, user_name: userName });
      if (res.data.success) {
        showToast(res.data.message, 'success');
        await refreshToken();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    try {
      const res = await api.put('/users/password', { current_password: currentPassword, new_password: newPassword });
      if (res.data.success) {
        showToast(res.data.message, 'success');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password.');
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <h2 className="text-center mt-5 mb-4 fw-bold" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-user-cog me-2" style={{ color: 'var(--accent)' }}></i>Edit Profile</h2>

          <div className="neon-card mb-4">
            <form onSubmit={handleProfileUpdate}>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-user me-1"></i>Full Name</label>
                <input type="text" className="form-control" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-envelope me-1"></i>Email</label>
                <input type="email" className="form-control" value={user?.email || ''} disabled />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-at me-1"></i>Username</label>
                <input type="text" className="form-control" value={userName} onChange={e => setUserName(e.target.value)} required />
              </div>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <button type="submit" className="btn btn-neon w-100"><i className="fas fa-save me-1"></i>Save Changes</button>
            </form>
          </div>

          <div className="neon-card mb-5">
            <h3 className="text-center mb-4 fw-bold" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              <i className="fas fa-key me-2" style={{ color: 'var(--accent)' }}></i>Change Password
            </h3>
            <form onSubmit={handlePasswordChange}>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-lock me-1"></i>Current Password</label>
                <input type="password" className="form-control" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-key me-1"></i>New Password</label>
                <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-check-double me-1"></i>Confirm New Password</label>
                <input type="password" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-neon w-100"><i className="fas fa-exchange-alt me-1"></i>Change Password</button>
            </form>
          </div>
        </div>
      </div>

      <div className="row justify-content-center mt-4">
        <div className="col-md-10">
          <h3 className="text-center mb-4 fw-bold" style={{ letterSpacing: '-0.02em' }}>
            <i className="fas fa-trophy me-2" style={{ color: 'var(--accent)' }}></i>My Contests
          </h3>

          {contestsLoading ? (
            <div className="text-center"><div className="spinner-neon"></div></div>
          ) : contests.length === 0 ? (
            <div className="neon-card text-center py-4">
              <p className="mb-0" style={{ color: 'rgba(255,255,255,0.5)' }}>You haven't participated in any contests yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="neon-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Contest</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Solves</th>
                    <th>Rank</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contests.length === 0 ? (
                    <tr><td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'rgba(255,255,255,0.4)' }}>No contests participated yet.</td></tr>
                  ) : contests.map((c, i) => (
                    <tr key={c.contest_id}>
                      <td>{i + 1}</td>
                      <td className="fw-semibold">{c.contest_title}</td>
                      <td>
                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                      </td>
                      <td>{c.total_score}</td>
                      <td>{c.solves}</td>
                      <td className="fw-bold" style={{ color: c.rank === 1 ? 'var(--accent)' : 'inherit' }}>
                        {c.rank ? `#${c.rank} / ${c.participants}` : 'N/A'}
                      </td>
                      <td>
                        <Link to={`/contests/${c.contest_id}?tab=scoreboard`} className="btn btn-sm btn-neon-outline">
                          <i className="fas fa-ranking-star me-1"></i>Scoreboard
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
