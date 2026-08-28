import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="neon-footer mt-auto">
      <div className="container">
        <p className="mb-2">&copy; {new Date().getFullYear()} JKKNIU Cyber Security Club. All rights reserved.</p>
        <p className="mb-2 small" style={{ opacity: 0.6 }}>Developed with <i className="fas fa-heart" style={{ color: '#ef4444' }}></i> by Ki6uiPar1na (Md. Khairul Islam)</p>
        <div className="mb-2">
          <Link to="/vdp" className="small" style={{ fontSize: '0.85rem', margin: '0 0.5rem', display: 'inline' }}><i className="fas fa-bug me-1"></i>Submit Vulnerability</Link>
        </div>
        <div>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="GitHub"><i className="fab fa-github"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Twitter"><i className="fab fa-twitter"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i className="fab fa-linkedin"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Facebook"><i className="fab fa-facebook"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Discord"><i className="fab fa-discord"></i></a>
          <Link to="/developer-info" title="Developer Info"><i className="fas fa-code"></i></Link>
        </div>
      </div>
    </footer>
  );
}
