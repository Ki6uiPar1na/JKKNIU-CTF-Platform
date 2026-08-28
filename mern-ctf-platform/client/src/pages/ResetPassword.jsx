import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/auth/reset-password/${token}`, { password });
      if (res.data.success) { setDone(true); showToast('Password reset successfully!', 'success'); }
      else setError(res.data.error || 'Failed to reset password.');
    } catch (err) { setError(err.response?.data?.error || 'Server error.'); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="container" style={{ marginTop: '80px' }}>
        <div className="row justify-content-center">
          <div className="col-md-5">
            <div className="neon-card text-center">
              <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: 'var(--accent)', marginBottom: '1rem' }}></i>
              <h4 className="fw-bold mb-3">Password Reset Successful</h4>
              <p className="mb-3">You can now log in with your new password.</p>
              <button className="btn btn-neon" onClick={() => navigate('/login')}><i className="fas fa-right-to-bracket me-1"></i> Go to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '80px' }}>
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="neon-card">
            <div className="text-center mb-4">
              <i className="fas fa-lock-open" style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.5rem' }}></i>
              <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}>Reset Password</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required />
              </div>
              {error && <div className="alert alert-danger py-2"><i className="fas fa-exclamation-circle me-1"></i>{error}</div>}
              <button type="submit" className="btn btn-neon w-100" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-1"></span> Resetting...</> : <><i className="fas fa-save me-1"></i> Reset Password</>}
              </button>
              <p className="text-center mt-3" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Link to="/login" className="fw-bold">Back to Login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
