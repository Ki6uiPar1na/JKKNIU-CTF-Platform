import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import useServerTime from '../hooks/useServerTime';

export default function ContestList() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const now = useServerTime();

  useEffect(() => {
    api.get('/contests')
      .then(res => { if (res.data.success) setContests(res.data.contests); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStatus = (c) => {
    if (c.isArchived) return 'archived';
    if (c.startDate && now < new Date(c.startDate)) return 'upcoming';
    if (c.endDate && now > new Date(c.endDate)) return 'archived';
    return 'active';
  };

  const filtered = filter === 'all' ? contests : contests.filter(c => getStatus(c) === filter);

  const statusBadge = (contest) => {
    const s = getStatus(contest);
    if (s === 'active') return <span className="badge badge-active">Active</span>;
    if (s === 'upcoming') return <span className="badge badge-upcoming">Upcoming</span>;
    return <span className="badge badge-archived">Archived</span>;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';

  const timeInfo = (contest) => {
    const s = getStatus(contest);
    if (s === 'upcoming' && contest.startDate) {
      const start = new Date(contest.startDate);
      if (isNaN(start)) return formatDate(contest.startDate);
      const diff = Math.max(0, start - now);
      if (diff === 0) return formatDate(contest.startDate);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const text = days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
      return <span style={{ color: '#facc15' }}><i className="fas fa-clock me-1"></i>Starts in {text}</span>;
    }
    if (s === 'active' && contest.endDate) {
      const end = new Date(contest.endDate);
      if (isNaN(end)) return formatDate(contest.endDate);
      const diff = Math.max(0, end - now);
      if (diff === 0) return formatDate(contest.endDate);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const text = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
      return <span style={{ color: 'var(--accent)' }}><i className="fas fa-hourglass-half me-1"></i>{text} left</span>;
    }
    return <span><i className="far fa-calendar-alt me-1"></i>{formatDate(contest.startDate)}</span>;
  };

  if (loading) return <div className="spinner-neon"></div>;

  return (
    <div className="container-fluid my-5 px-4">
      <div className="text-center mb-5">
        <h1 className="fw-bold" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
          <i className="fas fa-trophy me-2" style={{ color: 'var(--accent)' }}></i>CTF Contests
        </h1>
        <p className="text-secondary" style={{ maxWidth: '500px', margin: '0.5rem auto 0' }}>
          Browse past, active, and upcoming cybersecurity challenges.
        </p>
      </div>

      <div className="d-flex justify-content-center gap-2 mb-4 flex-wrap">
        {['all', 'active', 'upcoming', 'archived'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-neon' : 'btn-neon-outline'} btn-sm`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-5">
          <i className="fas fa-inbox" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}></i>
          <p className="mt-3 text-secondary">No contests found.</p>
        </div>
      ) : (
        <div className="row g-4">
          {filtered.map(contest => (
            <div key={contest._id} className="col-12 col-md-6 col-lg-3">
              <Link to={`/contests/${contest._id}`} className="text-decoration-none">
                <div className="neon-card-sm p-0" style={{ height: '100%', cursor: 'pointer', overflow: 'hidden' }}>
                  {contest.banner_url && (
                    <div style={{ width: '100%', aspectRatio: '21 / 9', overflow: 'hidden' }}>
                      <img src={contest.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div className="p-4">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h5 className="fw-bold mb-0" style={{ color: 'var(--accent)' }}>{contest.title}</h5>
                    {statusBadge(contest)}
                  </div>
                  <p className="small mb-0" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {contest.description
                      ? (contest.description.length > 120 ? contest.description.substring(0, 120) + '...' : contest.description)
                      : 'No description'}
                  </p>
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
                      {timeInfo(contest)}
                    </div>
                  </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
