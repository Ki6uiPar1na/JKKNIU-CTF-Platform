import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isSuperAdmin = user?.role === 2;

  const links = [
    { to: '/admin', icon: 'fa-home', label: 'Home' },
    { to: '/admin/contests', icon: 'fa-calendar-alt', label: 'Contests' },
    { to: '/admin/submissions', icon: 'fa-file-alt', label: 'Submissions' },
    { to: '/admin/solves', icon: 'fa-check-circle', label: 'Solves' },
    { to: '/admin/users', icon: 'fa-users', label: 'Users' },
    { to: '/admin/pending', icon: 'fa-user-clock', label: 'Pending' },
    { to: '/admin/logs', icon: 'fa-history', label: 'Logs' },
    ...(isSuperAdmin ? [{ to: '/admin/settings', icon: 'fa-cogs', label: 'Settings' }] : []),
  ];

  const close = () => setOpen(false);

  return (
    <>
      <button className="admin-toggle-btn" onClick={() => setOpen(!open)} aria-label="Toggle admin menu">
        <i className={`fas ${open ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      <div className={`admin-offcanvas-overlay ${open ? 'open' : ''}`} onClick={close}></div>

      <div className={`admin-offcanvas ${open ? 'open' : ''}`}>
        <div style={{ padding: '1rem 1.25rem 0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Admin Panel
        </div>
        <ul className="nav flex-column">
          {links.map(l => (
            <li key={l.to} className="nav-item">
              <NavLink to={l.to} end={l.to === '/admin'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={close}>
                <i className={`fas ${l.icon} me-2`} style={{ width: '18px', textAlign: 'center' }}></i>{l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-nav d-none d-md-block" style={{ width: '220px', flexShrink: 0 }}>
        <div style={{ padding: '1rem 1.25rem 0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Admin Panel
        </div>
        <ul className="nav flex-column">
          {links.map(l => (
            <li key={l.to} className="nav-item">
              <NavLink to={l.to} end={l.to === '/admin'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <i className={`fas ${l.icon} me-2`} style={{ width: '18px', textAlign: 'center' }}></i>{l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
