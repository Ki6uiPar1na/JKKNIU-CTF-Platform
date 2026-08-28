import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Captcha from '../components/Captcha';
import api from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState(null);
  const [captchaText, setCaptchaText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleCaptchaReady = useCallback((id) => setCaptchaId(id), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captchaText) { setError('Please enter the CAPTCHA.'); return; }
    setLoading(true);
    try {
      const data = await login(email, password, captchaId, captchaText);
      if (data.success) {
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => navigate(data.role === 0 || data.role === 2 ? '/admin' : '/contests'), 1000);
      } else {
        setError(data.error || 'Login failed.');
        setCaptchaText('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.');
      setCaptchaText('');
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ marginTop: '80px' }}>
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="neon-card">
            <div className="text-center mb-4">
              <i className="fas fa-shield-alt" style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.5rem' }}></i>
              <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}>Login</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-envelope me-1"></i>Email</label>
                <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-lock me-1"></i>Password</label>
                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
                <div className="text-end mt-1">
                  <Link to="/forgot-password" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Forgot password?</Link>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-shield me-1"></i>CAPTCHA</label>
                <Captcha onCaptchaReady={handleCaptchaReady} />
                <input type="text" className="form-control mt-2" value={captchaText} onChange={e => setCaptchaText(e.target.value)} placeholder="Enter the text above" required />
              </div>
              {error && <div className="alert alert-danger py-2"><i className="fas fa-exclamation-circle me-1"></i>{error}</div>}
              <button type="submit" className="btn btn-neon w-100" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-1"></span> Logging in...</> : <><i className="fas fa-right-to-bracket me-1"></i>Login</>}
              </button>
            </form>
            <p className="text-center mt-3" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Don't have an account? <Link to="/signup" className="fw-bold">Sign up here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
