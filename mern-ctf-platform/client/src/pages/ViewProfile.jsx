import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

export default function ViewProfile() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/users/profile/${userId}`)
      .then(res => { if (res.data.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="spinner-neon" style={{ marginTop: '3rem' }}></div>;
  if (!data) return <div className="container mt-5"><p>User not found.</p></div>;

  const { user, rank, total_submissions, total_correct, total_score, correct_by_category } = data;

  return (
    <div className="container my-5">
      <div className="neon-card">
        <h2 className="text-center fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
          <i className="fas fa-user me-2" style={{ color: 'var(--accent)' }}></i>{user.user_name}
        </h2>
        <div className="row text-center">
          <div className="col-md-3 mb-3">
            <div className="neon-card-sm">
              <i className="fas fa-trophy fa-2x mb-2"></i>
              <h5>Rank</h5>
              <p className="fs-4 fw-bold">{rank ? `#${rank}` : 'N/A'}</p>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="neon-card-sm">
              <i className="fas fa-star fa-2x mb-2"></i>
              <h5>Score</h5>
              <p className="fs-4 fw-bold">{total_score}</p>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="neon-card-sm">
              <i className="fas fa-check-circle fa-2x mb-2"></i>
              <h5>Solved</h5>
              <p className="fs-4 fw-bold">{total_correct}</p>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="neon-card-sm">
              <i className="fas fa-upload fa-2x mb-2"></i>
              <h5>Submissions</h5>
              <p className="fs-4 fw-bold">{total_submissions}</p>
            </div>
          </div>
        </div>

        {Object.keys(correct_by_category).length > 0 && (
          <>
            <h4 className="mt-4 mb-3 fw-bold" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <i className="fas fa-chart-pie me-2" style={{ color: 'var(--accent)' }}></i>Solved by Category
            </h4>
            <div className="row">
              {Object.entries(correct_by_category).map(([cat, count]) => (
                <div key={cat} className="col-md-4 mb-3">
                  <div className="neon-card-sm text-center">
                    <h6>{cat}</h6>
                    <p className="fs-4 fw-bold">{count}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
