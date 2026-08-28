import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Captcha from '../components/Captcha';

function Field({ name, label, icon, type = 'text', col = 'col-md-6', required = true, value, onChange, error, sessionOptions }) {
  return (
    <div className={`${col} mb-3`}>
      <label className="form-label"><i className={`fas fa-${icon} me-1`}></i>{label}</label>
      {type === 'select' ? (
        <select className="form-select" name={name} value={value} onChange={onChange} required={required}>
          <option value="">Select {label}</option>
          {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input type={type} className="form-control" name={name} value={value} onChange={onChange} placeholder={label} required={required} />
      )}
      {error && <small className="text-danger">{error}</small>}
    </div>
  );
}

export default function Signup() {
  const [form, setForm] = useState({ member_id: '', full_name: '', username: '', email: '', password: '', confirm_password: '', session: '' });
  const [captchaId, setCaptchaId] = useState(null);
  const [captchaText, setCaptchaText] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleCaptchaReady = useCallback((id) => setCaptchaId(id), []);

  const currentYear = new Date().getFullYear();
  const sessionOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) sessionOptions.push(`${y}-${y + 1}`);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!captchaText) { setErrors({ captcha: 'Please enter the CAPTCHA.' }); return; }
    if (form.password !== form.confirm_password) { setErrors({ confirm_password: 'Passwords do not match!' }); return; }
    setLoading(true);
    try {
      const data = await signup({ ...form, captchaId, captchaText });
      if (data.success) {
        showToast(data.message, 'success');
        setTimeout(() => navigate('/login'), 1500);
      } else if (data.errors) {
        setErrors(data.errors);
      } else {
        setErrors({ general: data.error || 'Signup failed.' });
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
      } else {
        setErrors({ general: data?.error || 'An error occurred during signup.' });
      }
    }
    setCaptchaText('');
    setLoading(false);
  };

  const fieldProps = (name) => ({
    name, value: form[name], onChange: handleChange, error: errors[name], sessionOptions,
  });

  return (
    <div className="container" style={{ marginTop: '60px' }}>
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="neon-card">
            <div className="text-center mb-4">
              <i className="fas fa-user-plus" style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.5rem' }}></i>
              <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}>Sign Up</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="row">
                <Field name="full_name" label="Full Name" icon="user" {...fieldProps('full_name')} />
                <Field name="member_id" label="Member ID" icon="id-card" type="number" {...fieldProps('member_id')} />
                <Field name="username" label="Username" icon="at" {...fieldProps('username')} />
                <Field name="email" label="Email" icon="envelope" type="email" {...fieldProps('email')} />
                <Field name="password" label="Password" icon="lock" type="password" {...fieldProps('password')} />
                <small className="d-block mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '-0.5rem' }}>Min 8 chars, uppercase, lowercase &amp; number required</small>
                <Field name="confirm_password" label="Confirm Password" icon="check-double" type="password" {...fieldProps('confirm_password')} />
                <Field name="session" label="Session" icon="calendar" type="select" {...fieldProps('session')} />
              </div>
              <div className="mb-3">
                <label className="form-label"><i className="fas fa-shield me-1"></i>CAPTCHA</label>
                <Captcha onCaptchaReady={handleCaptchaReady} />
                <input type="text" className="form-control mt-2" value={captchaText} onChange={e => setCaptchaText(e.target.value)} placeholder="Enter the text above" required />
                {errors.captcha && <small className="text-danger">{errors.captcha}</small>}
              </div>
              {errors.general && <div className="alert alert-danger py-2"><i className="fas fa-exclamation-circle me-1"></i>{errors.general}</div>}
              <button type="submit" className="btn btn-neon w-100" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-1"></span> Creating account...</> : <><i className="fas fa-user-plus me-1"></i>Create Account</>}
              </button>
            </form>
            <p className="text-center mt-3" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Already have an account? <Link to="/login" className="fw-bold">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
