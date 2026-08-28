import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [platformName, setPlatformName] = useState('CTF Platform');
  const [logoUrl, setLogoUrl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get('/platform/info').then(res => {
      if (res.data.success) {
        setPlatformName(res.data.platform_name);
        setLogoUrl(res.data.logo_url);
      }
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    showToast('Logged out successfully', 'success');
    navigate('/');
  };

  const isAdmin = user?.role === 0 || user?.role === 2;

  const isActive = (path) => {
    if (path === '/admin') return location.pathname.startsWith('/admin');
    return location.pathname === path;
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar navbar-expand-lg">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/" onClick={closeMenu}>
          {logoUrl ? <img src={logoUrl} alt="Logo" style={{ height: '28px', width: 'auto' }} /> : <i className="fas fa-shield-alt"></i>}
          {platformName}
        </Link>
        <button className="navbar-toggler" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`}>
          <ul className="navbar-nav ms-auto align-items-center gap-1">
            <li className="nav-item"><Link className={`nav-link ${isActive('/') ? 'active' : ''}`} to="/" onClick={closeMenu}><i className="fas fa-home"></i> Home</Link></li>
            <li className="nav-item"><Link className={`nav-link ${isActive('/contests') ? 'active' : ''}`} to="/contests" onClick={closeMenu}><i className="fas fa-trophy"></i> Contests</Link></li>
            {user ? (
              <>
                <li className="nav-item"><Link className="nav-link" to="/profile" onClick={closeMenu}><i className="fas fa-user"></i> Profile</Link></li>
                {isAdmin && <li className="nav-item"><Link className={`nav-link ${isActive('/admin') ? 'active' : ''}`} to="/admin" onClick={closeMenu}><i className="fas fa-cog"></i> Admin</Link></li>}
                <li className="nav-item">
                  <button className="nav-link btn text-danger border-0" onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt"></i> Logout
                  </button>
                </li>
              </>
            ) : (
              <li className="nav-item"><Link className={`nav-link ${isActive('/login') || isActive('/signup') ? 'active' : ''}`} to="/login" onClick={closeMenu}><i className="fas fa-right-to-bracket"></i> Login</Link></li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
