import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminSettings() {
  const [status, setStatus] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [smtp, setSmtp] = useState({ smtp_host: '', smtp_port: 587, smtp_secure: false, smtp_user: '', smtp_pass: '', smtp_from_email: '', smtp_from_name: '' });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [subject, setSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const { showToast } = useToast();

  const load = async () => {
    try { const res = await api.get('/admin/platform-status'); if (res.data.success) { setStatus(res.data.data); setPlatformName(res.data.data.platform_name || ''); setLogoPreview(res.data.data.logo_url || null); } }
    catch { showToast('Failed to load platform status', 'error'); }
    try { const res = await api.get('/admin/smtp-config'); if (res.data.success && res.data.data) { setSmtp(prev => ({ ...prev, ...res.data.data })); } }
    catch { /* smtp config may not exist */ }
    try { const res = await api.get('/admin/users'); if (res.data.success) setUsers(res.data.users); }
    catch { /* users may not load */ }
  };
  useEffect(() => { load(); }, []);

  const formatDate = (d) => d ? new Date(d).toISOString().slice(0, 16) : '';

  const handleAction = async (action) => {
    try {
      const body = { action };
      if (action === 'schedule') {
        body.start_time = startTime ? new Date(startTime).toISOString() : null;
        body.end_time = endTime ? new Date(endTime).toISOString() : null;
      }
      const res = await api.put('/admin/platform-status', body);
      if (res.data.success) { showToast(res.data.message, 'success'); load(); }
    } catch { showToast('Failed to update settings', 'error'); }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      let logo_url = logoPreview;
      if (logoFile) {
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('banner', logoFile);
        const uploadRes = await api.post('/admin/upload-logo', formData);
        if (!uploadRes.data.success) { showToast('Logo upload failed', 'error'); setSavingBranding(false); setUploadingLogo(false); return; }
        logo_url = uploadRes.data.logo_url;
        setUploadingLogo(false);
      }
      const res = await api.put('/admin/platform-status', { action: 'update_branding', platform_name: platformName, logo_url });
      if (res.data.success) { showToast('Branding updated successfully', 'success'); load(); }
      setLogoFile(null);
    } catch { showToast('Failed to update branding', 'error'); }
    finally { setSavingBranding(false); setUploadingLogo(false); }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const res = await api.put('/admin/smtp-config', {
        ...smtp,
        smtp_host: (smtp.smtp_host || '').trim(),
        smtp_user: (smtp.smtp_user || '').trim(),
        smtp_pass: (smtp.smtp_pass || '').trim(),
        smtp_from_email: (smtp.smtp_from_email || '').trim(),
        smtp_from_name: (smtp.smtp_from_name || '').trim(),
      });
      if (res.data.success) showToast('SMTP configuration saved.', 'success');
    } catch { showToast('Failed to save SMTP config', 'error'); }
    finally { setSavingSmtp(false); }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await api.post('/admin/test-smtp');
      if (res.data.success) showToast('SMTP connection successful!', 'success');
      else showToast(res.data.error || 'SMTP test failed', 'error');
    } catch (err) { showToast(err.response?.data?.error || 'SMTP test failed', 'error'); }
    finally { setTestingSmtp(false); }
  };

  const handleSmtpChange = (field, value) => {
    setSmtp(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectAll = () => {
    if (selectAll) { setSelectedUsers([]); setSelectAll(false); }
    else { setSelectedUsers(users.filter(u => u.status === 1).map(u => u._id)); setSelectAll(true); }
  };

  const handleToggleUser = (id) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectAll(false);
  };

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) { showToast('Select at least one recipient.', 'error'); return; }
    if (!subject.trim()) { showToast('Subject is required.', 'error'); return; }
    if (!emailMessage.trim()) { showToast('Message is required.', 'error'); return; }
    setSendingEmail(true);
    try {
      const res = await api.post('/admin/send-email', { recipients: selectedUsers, subject, message: emailMessage });
      if (res.data.success) { showToast(res.data.message, 'success'); setSubject(''); setEmailMessage(''); setSelectedUsers([]); setSelectAll(false); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to send email.', 'error'); }
    finally { setSendingEmail(false); }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-cogs me-2" style={{ color: 'var(--accent)' }}></i>Platform Settings</h2>

        <div className="neon-card mb-4">
          <h4 className="mb-3"><i className="fas fa-paint-brush me-2" style={{ color: 'var(--accent)' }}></i>Branding</h4>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Platform Name</label>
              <input type="text" className="form-control" value={platformName} onChange={e => setPlatformName(e.target.value)} placeholder="e.g. JKKNIU CTF" maxLength={100} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Logo (image file)</label>
              <input type="file" className="form-control" accept="image/*" onChange={handleLogoChange} />
              {(logoPreview || logoFile) && (
                <div className="mt-2">
                  <img src={logoPreview} alt="Logo preview" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.05)' }} />
                  {logoFile && <button className="btn btn-sm ms-2" style={{ color: '#f87171' }} onClick={() => { setLogoFile(null); setLogoPreview(status?.logo_url || null); }}><i className="fas fa-times"></i></button>}
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-neon mt-3" onClick={handleSaveBranding} disabled={savingBranding}>
            {savingBranding ? <><span className="spinner-border spinner-border-sm me-1"></span> {uploadingLogo ? 'Uploading...' : 'Saving...'}</> : <><i className="fas fa-save me-1"></i> Save Branding</>}
          </button>
        </div>

        <div className="neon-card mb-4">
          <h4 className="mb-3">Current Status</h4>
          <p>
            <strong>Submission Status:</strong>{' '}
            <span className={`badge ${status?.submission_status === 'open' ? 'bg-success' : 'bg-danger'}`}>
              {status?.submission_status?.toUpperCase()}
            </span>
          </p>
          {status?.submission_start_time && <p><strong>Start:</strong> {new Date(status.submission_start_time).toLocaleString()}</p>}
          {status?.submission_end_time && <p><strong>End:</strong> {new Date(status.submission_end_time).toLocaleString()}</p>}
        </div>

        <div className="neon-card mb-4">
          <h4 className="mb-3">Manual Controls</h4>
          <div className="d-flex gap-3">
            <button className="btn btn-neon" onClick={() => handleAction('manual_open')}><i className="fas fa-play me-1"></i> Open Submissions</button>
            <button className="btn btn-neon-danger" onClick={() => handleAction('manual_close')}><i className="fas fa-stop me-1"></i> Close Submissions</button>
          </div>
        </div>

        <div className="neon-card">
          <h4 className="mb-3">Schedule CTF</h4>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label">Start Time</label>
              <input type="datetime-local" className="form-control" value={startTime || formatDate(status?.submission_start_time)} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">End Time</label>
              <input type="datetime-local" className="form-control" value={endTime || formatDate(status?.submission_end_time)} onChange={e => setEndTime(e.target.value)} />
            </div>
            <div className="col-md-4 mb-3 d-flex align-items-end">
              <button className="btn btn-neon w-100" onClick={() => handleAction('schedule')}><i className="fas fa-calendar-check me-1"></i> Schedule</button>
            </div>
          </div>
        </div>

        {(smtp.smtp_host && smtp.smtp_user) ? (
          <div className="neon-card mb-4">
            <h4 className="mb-3"><i className="fas fa-paper-plane me-2" style={{ color: 'var(--accent)' }}></i>Send Email</h4>
            <p className="text-muted small mb-3">Send an email to registered users.</p>
            <div className="mb-3">
              <label className="form-label mb-2">Recipients ({selectedUsers.length} selected)</label>
              <div className="d-flex align-items-center mb-2">
                <div className="form-check me-3">
                  <input type="checkbox" className="form-check-input" id="selectAll" checked={selectAll} onChange={handleSelectAll} />
                  <label className="form-check-label" htmlFor="selectAll">Select All (active users)</label>
                </div>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius)', padding: '8px' }}>
                {users.filter(u => u.status === 1).map(user => (
                  <div key={user._id} className="form-check form-check-inline me-2 mb-1" style={{ minWidth: '180px' }}>
                    <input type="checkbox" className="form-check-input" id={`u-${user._id}`} checked={selectedUsers.includes(user._id)} onChange={() => handleToggleUser(user._id)} />
                    <label className="form-check-label small" htmlFor={`u-${user._id}`}>{user.user_name} ({user.email})</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Subject</label>
              <input type="text" className="form-control" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
            </div>
            <div className="mb-3">
              <label className="form-label">Message</label>
              <textarea className="form-control" rows="5" value={emailMessage} onChange={e => setEmailMessage(e.target.value)} placeholder="Write your message here..." style={{ resize: 'vertical' }}></textarea>
            </div>
            <button className="btn btn-neon" onClick={handleSendEmail} disabled={sendingEmail || selectedUsers.length === 0}>
              {sendingEmail ? <><span className="spinner-border spinner-border-sm me-1"></span> Sending...</> : <><i className="fas fa-paper-plane me-1"></i> Send Email</>}
            </button>
          </div>
        ) : null}

        <div className="neon-card mb-4">
          <h4 className="mb-3"><i className="fas fa-envelope me-2" style={{ color: 'var(--accent)' }}></i>SMTP Configuration</h4>
          <p className="text-muted small mb-3">Configure email settings for password reset, notifications, and other system emails.</p>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">SMTP Host</label>
              <input type="text" className="form-control" placeholder="smtp.gmail.com" value={smtp.smtp_host} onChange={e => handleSmtpChange('smtp_host', e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Port</label>
              <input type="number" className="form-control" value={smtp.smtp_port} onChange={e => handleSmtpChange('smtp_port', Number(e.target.value))} />
            </div>
            <div className="col-md-3 d-flex align-items-end pb-3">
              <div className="form-check">
                <input type="checkbox" className="form-check-input" id="smtpSecure" checked={smtp.smtp_secure} onChange={e => handleSmtpChange('smtp_secure', e.target.checked)} />
                <label className="form-check-label" htmlFor="smtpSecure">Use SSL/TLS</label>
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Username</label>
              <input type="text" className="form-control" placeholder="user@example.com" value={smtp.smtp_user} onChange={e => handleSmtpChange('smtp_user', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" placeholder="App password" value={smtp.smtp_pass} onChange={e => handleSmtpChange('smtp_pass', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">From Email</label>
              <input type="email" className="form-control" placeholder="noreply@example.com" value={smtp.smtp_from_email} onChange={e => handleSmtpChange('smtp_from_email', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">From Name</label>
              <input type="text" className="form-control" placeholder="JKKNIU CTF" value={smtp.smtp_from_name} onChange={e => handleSmtpChange('smtp_from_name', e.target.value)} />
            </div>
          </div>
          <div className="d-flex gap-3 mt-3">
            <button className="btn btn-neon" onClick={handleSaveSmtp} disabled={savingSmtp}>
              {savingSmtp ? <><span className="spinner-border spinner-border-sm me-1"></span> Saving...</> : <><i className="fas fa-save me-1"></i> Save SMTP</>}
            </button>
            <button className="btn btn-outline-info" onClick={handleTestSmtp} disabled={testingSmtp}>
              {testingSmtp ? <><span className="spinner-border spinner-border-sm me-1"></span> Testing...</> : <><i className="fas fa-plug me-1"></i> Test Connection</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
