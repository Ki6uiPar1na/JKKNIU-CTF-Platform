import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function SubmissionDetailsModal({ submissionId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/admin/submissions/${submissionId}`)
      .then(res => { if (!cancelled && res.data.success) setData(res.data.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Failed to load submission details.'); });
    return () => { cancelled = true; };
  }, [submissionId]);

  const copyFlag = () => {
    if (!data?.submitted_flag) return;
    navigator.clipboard.writeText(data.submitted_flag);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const Row = ({ label, children }) => (
    <div className="d-flex justify-content-between align-items-baseline py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '1rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ textAlign: 'right', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-content" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="modal-header">
            <h5 className="modal-title fw-bold"><i className="fas fa-file-alt me-2" style={{ color: 'var(--accent)' }}></i>Submission Details</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}
            {!data && !error && (
              <div className="text-center py-4"><i className="fas fa-spinner fa-spin me-2"></i>Loading submission…</div>
            )}
            {data && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace' }}>{String(data.submission_id)}</span>
                  <div className="d-flex gap-1">
                    {data.practice && <span className="badge" style={{ background: '#facc15', color: '#000' }}>Practice (no points)</span>}
                    <span className={`badge ${data.submission_type === 'correct' ? 'bg-success' : 'bg-danger'}`}>{data.submission_type}</span>
                  </div>
                </div>

                <h6 className="fw-bold mb-2" style={{ color: 'var(--accent)' }}>Challenge</h6>
                <Row label="Name">{data.challenge?.name || '—'}</Row>
                <Row label="Category">{data.challenge?.category?.name || data.challenge?.category || '—'}</Row>
                <Row label="Points">
                  <span className="text-warning"><i className="fas fa-star me-1" style={{ fontSize: '0.7rem' }}></i>{data.challenge?.point ?? '—'}</span>
                </Row>
                <Row label="Max Attempts">{data.challenge?.max_attempts ?? '∞'}</Row>

                <h6 className="fw-bold mt-3 mb-2" style={{ color: 'var(--accent)' }}>Contest</h6>
                <Row label="Title">{data.contest?.title || '—'}</Row>
                <Row label="Mode">{data.contest?.participation_mode || '—'}</Row>

                <h6 className="fw-bold mt-3 mb-2" style={{ color: 'var(--accent)' }}>Submitted By</h6>
                <Row label="Username">
                  <span className="text-info">{data.user?.user_name || '—'}</span>
                </Row>
                {data.user?.full_name && <Row label="Full Name">{data.user.full_name}</Row>}
                {data.user?.email && <Row label="Email">{data.user.email}</Row>}
                {data.user?.member_id != null && <Row label="Member ID">{data.user.member_id}</Row>}
                <Row label="Team">{data.team ? `${data.team.name}${data.team.captain?.user_name ? ` (captain: ${data.team.captain.user_name})` : ''}` : 'Solo'}</Row>

                <h6 className="fw-bold mt-3 mb-2" style={{ color: 'var(--accent)' }}>Flag</h6>
                <div className="d-flex align-items-center gap-2">
                  <code className="flex-grow-1 p-2" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius)', wordBreak: 'break-all', fontSize: '0.8rem' }}>{data.submitted_flag}</code>
                  <button className="btn btn-sm btn-neon-outline" onClick={copyFlag} title="Copy flag">
                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  </button>
                </div>

                <h6 className="fw-bold mt-3 mb-2" style={{ color: 'var(--accent)' }}>Timing</h6>
                <Row label="Submitted">{new Date(data.timestamp_of_submission).toLocaleString()}</Row>
                {data.solve && (
                  <Row label="Solved At">
                    <span className="text-success">{new Date(data.solve.solved_at).toLocaleString()}</span>
                  </Row>
                )}
                <Row label="Updated">{new Date(data.updated_at).toLocaleString()}</Row>
              </>
            )}
          </div>
          {data && (
            <div className="modal-footer">
              <button type="button" className="btn btn-neon-outline btn-sm" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}