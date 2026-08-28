import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/admin/stats').then(res => { if (res.data.success) setStats(res.data.data); }).catch(() => {});
  }, []);

  const statCards = stats ? [
    { label: 'Contests', value: stats.totalContests, icon: 'fa-calendar-alt' },
    { label: 'Users', value: stats.totalUsers, icon: 'fa-users' },
    { label: 'Challenges', value: stats.totalChallenges, icon: 'fa-skull-crossbones' },
    { label: 'Pending', value: stats.pendingUsers, icon: 'fa-user-clock' },
    { label: 'Submissions', value: stats.totalSubmissions, icon: 'fa-file-alt' },
    { label: 'Solves', value: stats.totalSolves, icon: 'fa-check-circle' },
  ] : [];

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4" style={{ background: 'var(--bg-body)' }}>
        <div className="mb-4">
          <h3 className="fw-bold" style={{ letterSpacing: '-0.02em' }}>Dashboard</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Welcome back, {user?.full_name || 'Admin'}.</p>
        </div>
        {stats ? (
          <div className="row g-3">
            {statCards.map(card => (
              <div key={card.label} className="col-6 col-md-4 col-lg-2">
                <div className="stat-card">
                  <i className={`fas ${card.icon}`} style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '0.5rem', opacity: 0.6 }}></i>
                  <div className="stat-value">{card.value}</div>
                  <h5>{card.label}</h5>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="spinner-neon"></div>
        )}
      </div>
    </div>
  );
}
