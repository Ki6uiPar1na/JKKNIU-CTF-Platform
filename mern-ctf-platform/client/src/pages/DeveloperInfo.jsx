export default function DeveloperInfo() {
  return (
    <div className="container my-5">
      <div className="neon-card">
        <h2 className="text-center fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}><i className="fas fa-code me-2" style={{ color: 'var(--accent)' }}></i>Developer Info</h2>
        <p className="text-center fs-5">
          <strong>Ki6uiPar1na (Md. Khairul Islam)</strong>
        </p>
        <p className="text-center">
          JKKNIU Cyber Security Club CTF Platform<br />
          Originally built with PHP, MySQL, Bootstrap, and love for cybersecurity.
        </p>
        <p className="text-center">
          Now rebuilt with the <strong>MERN Stack</strong> (MongoDB, Express, React, Node.js).
        </p>
        <div className="text-center">
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="GitHub" style={{ fontSize: '1.5rem', margin: '0 0.75rem', color: 'var(--accent)' }}><i className="fab fa-github"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Twitter" style={{ fontSize: '1.5rem', margin: '0 0.75rem', color: 'var(--accent)' }}><i className="fab fa-twitter"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="LinkedIn" style={{ fontSize: '1.5rem', margin: '0 0.75rem', color: 'var(--accent)' }}><i className="fab fa-linkedin"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Facebook" style={{ fontSize: '1.5rem', margin: '0 0.75rem', color: 'var(--accent)' }}><i className="fab fa-facebook"></i></a>
          <a href="https://github.com/Ki6uiPar1na" target="_blank" rel="noopener noreferrer" title="Discord" style={{ fontSize: '1.5rem', margin: '0 0.75rem', color: 'var(--accent)' }}><i className="fab fa-discord"></i></a>
        </div>
      </div>
    </div>
  );
}
