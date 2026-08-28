import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      <div className="container mt-5">
        <div className="neon-jumbotron">
          <h1 className="fw-bold" style={{ letterSpacing: '-0.03em' }}>
            JKKNIU CTF Platform
          </h1>
          <p className="lead">Sharpen your skills, solve challenges, and conquer the scoreboard.</p>
          <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '1.5rem auto', maxWidth: '400px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Welcome to the digital battleground for ethical hackers.</p>
          <Link className="btn btn-neon btn-lg mt-3" to="/contests">
            <i className="fas fa-trophy me-2"></i>View Contests
          </Link>
        </div>
      </div>

      <div className="container mt-5">
        <div className="row g-4">
          <div className="col-md-4">
            <div className="neon-card-sm text-center" style={{ height: '100%' }}>
              <div style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                <i className="fas fa-skull-crossbones"></i>
              </div>
              <h5 className="fw-bold">Challenges</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Dive into Web, Crypto, Pwn, OSINT, Forensics & more.</p>
              <Link to="/contests" className="btn btn-neon-outline btn-sm">Start Hacking</Link>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neon-card-sm text-center" style={{ height: '100%' }}>
              <div style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                <i className="fas fa-trophy"></i>
              </div>
              <h5 className="fw-bold">Scoreboard</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Track your progress and aim for the top.</p>
              <Link to="/contests" className="btn btn-neon-outline btn-sm">View Rankings</Link>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neon-card-sm text-center" style={{ height: '100%' }}>
              <div style={{ fontSize: '2rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                <i className="fas fa-users"></i>
              </div>
              <h5 className="fw-bold">Community</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Join the JKKNIU Cyber Security Club.</p>
              <Link to="/signup" className="btn btn-neon-outline btn-sm">Join Now</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
