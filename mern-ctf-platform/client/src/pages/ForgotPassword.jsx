import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email is required.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) { setSent(true); showToast(res.data.message, 'success'); }
      else setError(res.data.error || 'Failed to send reset email.');
    } catch (err) { setError(err.response?.data?.error || 'Server error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ marginTop: '80px' }}>
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="neon-card">
            <div className="text-center mb-4">
              <i className="fas fa-key" style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.5rem' }}></i>
              <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}>Forgot Password</h3>
            </div>
            {sent ? (
              <div className="text-center">
                <i className="fas fa-envelope-circle-check" style={{ fontSize: '3rem', color: 'var(--accent)', marginBottom: '1rem' }}></i>
                <p className="mb-3">If that email is registered, a password reset link has been sent. Check your inbox.</p>
                <Link to="/login" className="btn btn-neon"><i className="fas fa-arrow-left me-1"></i> Back to Login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="text-muted small mb-3">Enter your registered email and we'll send you a reset link.</p>
                <div className="mb-3">
                  <label className="form-label"><i className="fas fa-envelope me-1"></i>Email</label>
                  <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                {error && <div className="alert alert-danger py-2"><i className="fas fa-exclamation-circle me-1"></i>{error}</div>}
                <button type="submit" className="btn btn-neon w-100" disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-1"></span> Sending...</> : <><i className="fas fa-paper-plane me-1"></i> Send Reset Link</>}
                </button>
                <p className="text-center mt-3" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Remember your password? <Link to="/login" className="fw-bold">Log in</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
