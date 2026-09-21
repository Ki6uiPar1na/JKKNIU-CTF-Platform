import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { sanitize } from '../utils/sanitize';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ScoreboardGrid from '../components/ScoreboardGrid';
import ChallengeBrowser from '../components/ChallengeBrowser';
import ChallengeDetailsPane, { ChallengeDrawer } from '../components/ChallengeDetails';
import { playSuccessSound, playNotificationSound } from '../utils/sound';
import useServerTime from '../hooks/useServerTime';

export default function ContestDetail() {
  const { id, inviteCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [contest, setContest] = useState(null);
  const [challenges, setChallenges] = useState({});
  const [userProgress, setUserProgress] = useState({});
  const [categories, setCategories] = useState([]);
  const [scoreboard, setScoreboard] = useState([]);
  const [scoreboardHidden, setScoreboardHidden] = useState(false);
  const [scoreboardFrozen, setScoreboardFrozen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [solveFilter, setSolveFilter] = useState('all');
  const [tab, setTab] = useState(
    searchParams.get('tab') === 'scoreboard' ? 'scoreboard'
    : searchParams.get('tab') === 'submissions' ? 'submissions'
    : 'challenges'
  );
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const now = useServerTime();
  const [tick, setTick] = useState(0);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 920px)').matches);
  const [myTeam, setMyTeam] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', password: '', joinName: '', joinPassword: '' });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const storageKey = `seenPops:${id}`;
  const seenPopRef = useRef(new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')));
  const knownNotifIds = useRef(new Set(JSON.parse(localStorage.getItem(`knownNotifs:${id}`) || '[]')));
  const [preRegConfig, setPreRegConfig] = useState(null);
  const [preRegForm, setPreRegForm] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [bloods, setBloods] = useState([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get(`/contests/${id}/notifications`);
      if (!res.data.success) return;
      const all = res.data.notifications;
      setNotifications(all);
      let newCount = 0;
      all.forEach(n => {
        if (!knownNotifIds.current.has(n._id)) {
          knownNotifIds.current.add(n._id);
          localStorage.setItem(`knownNotifs:${id}`, JSON.stringify([...knownNotifIds.current]));
          newCount++;
          if (n.type === 'pop' && !seenPopRef.current.has(n._id)) {
            seenPopRef.current.add(n._id);
            localStorage.setItem(storageKey, JSON.stringify([...seenPopRef.current]));
            playNotificationSound();
            showToast(`🔔 ${n.title}${n.content ? ` — ${n.content}` : ''}`, 'info');
          }
        }
      });
      if (newCount > 0 && tab !== 'notifications') {
        setUnreadCount(prev => prev + newCount);
      }
    } catch {}
  }, [id, tab]);

  const fetchNotifRef = useRef(fetchNotifications);
  fetchNotifRef.current = fetchNotifications;

  useEffect(() => {
    knownNotifIds.current = new Set(JSON.parse(localStorage.getItem(`knownNotifs:${id}`) || '[]'));
    seenPopRef.current = new Set(JSON.parse(localStorage.getItem(`seenPops:${id}`) || '[]'));
    fetchNotifRef.current();
    const interval = setInterval(() => fetchNotifRef.current(), 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const refresh = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const fn = e => setIsNarrow(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (tick === 0) return;
    loadContest();
    if (user) loadChallenges();
    loadScoreboard();
    if (user && tab === 'submissions') loadSubmissions();
    if (user && (user.role === 0 || user.role === 2) && tab === 'first-blood') loadBloods();
  }, [tick]);

  const loadContest = async () => {
    try {
      const res = await api.get(`/contests/${id}`);
      if (res.data.success) setContest(res.data.contest);
    } catch { /* ignore */ }
  };

  const loadChallenges = async () => {
    try {
      const [chRes, catRes] = await Promise.all([
        api.get(`/contests/${id}/challenges`),
        api.get(`/contests/${id}/categories`),
      ]);
      setChallenges(
        Object.fromEntries(
          Object.entries(chRes.data.challenges).map(([cat, chs]) => [cat, chs.filter(c => c.visibility === 1)])
        )
      );
      setUserProgress(chRes.data.user_progress);
      setCategories(catRes.data.categories);
      const savedChallengeId = localStorage.getItem(`openChallenge:${id}`);
      if (savedChallengeId) {
        const savedChallenge = Object.values(chRes.data.challenges)
          .flat()
          .find(c => c.visibility === 1 && String(c._id) === savedChallengeId);
        if (savedChallenge) setModal(savedChallenge);
        else localStorage.removeItem(`openChallenge:${id}`);
      }
    } catch { showToast('Failed to load challenges', 'error'); }
  };

  const openChallenge = (ch) => {
    localStorage.setItem(`openChallenge:${id}`, ch._id);
    setModal(ch);
  };

  const closeModal = () => {
    localStorage.removeItem(`openChallenge:${id}`);
    setModal(null);
  };

  const loadScoreboard = async () => {
    try {
      const res = await api.get(`/contests/${id}/scoreboard`);
      if (res.data.success) { setScoreboard(res.data.scoreboard); setScoreboardHidden(res.data.hidden || false); setScoreboardFrozen(res.data.frozen || false); }
    } catch { /* ignore */ }
  };

  const loadTeam = async () => {
    if (!user || !contest || contest.participation_mode !== 'team') return;
    setTeamLoading(true);
    try {
      const res = await api.get(`/contests/${id}/teams/my`);
      if (res.data.success) setMyTeam(res.data.team);
    } catch {} finally { setTeamLoading(false); }
  };

  const loadProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const res = await api.get(`/contests/${id}/profile`);
      if (res.data.success) setProfile(res.data);
    } catch {} finally { setProfileLoading(false); }
  };

  const loadSubmissions = async (p) => {
    const pageNum = p ?? subPage;
    try {
      const res = await api.get(`/contests/${id}/submissions?page=${pageNum}&limit=15`);
      if (res.data.success) { setSubmissions(res.data.data); setSubTotalPages(res.data.pagination.total_pages); setSubPage(res.data.pagination.current_page); }
    } catch {}
  };

  const loadBloods = async () => {
    try {
      const res = await api.get(`/contests/${id}/first-blood`);
      if (res.data.success) setBloods(res.data.bloods);
    } catch {}
  };

  useEffect(() => {
    if (!contest || contest.participation_mode !== 'team') return;
    loadTeam();
  }, [contest, user]);

  const loadPreReg = async () => {
    try {
      const res = await api.get(`/contests/${id}/pre-registration`);
      if (res.data.success) {
        setPreRegConfig(res.data);
        if (res.data.fields?.length > 0) {
          const init = {};
          res.data.fields.forEach(f => { init[f.label] = ''; });
          setPreRegForm(init);
        }
        return;
      }
    } catch {}
    setPreRegConfig({ enabled: true, myStatus: null, fields: [] });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadContest(), loadScoreboard(), user ? loadChallenges() : Promise.resolve(), loadPreReg()])
      .finally(() => setLoading(false));
  }, [id, user]);

  const handlePreRegSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/contests/${id}/pre-register`, preRegForm);
      if (res.data.success) { loadPreReg(); showToast('Pre-registered successfully! Awaiting approval.', 'success'); }
    } catch (err) { showToast(err.response?.data?.error || 'Pre-registration failed', 'error'); }
  };

  useEffect(() => {
    if (!inviteCode || !user || !contest) return;
    (async () => {
      try {
        const res = await api.post(`/contests/${id}/teams/join-link/${inviteCode}`);
        if (res.data.success) {
          showToast(`Joined ${res.data.team.name}!`, 'success');
          loadTeam();
          navigate(`/contests/${id}`, { replace: true });
        }
      } catch (err) {
        showToast(err.response?.data?.error || 'Invalid invite link.', 'error');
        navigate(`/contests/${id}`, { replace: true });
      }
    })();
  }, [inviteCode, user, contest]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/contests/${id}/teams/create`, { name: teamForm.name, password: teamForm.password });
      if (res.data.success) { showToast('Team created!', 'success'); setTeamForm({ name: '', password: '', joinName: '', joinPassword: '' }); loadTeam(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to create team', 'error'); }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/contests/${id}/teams/join`, { name: teamForm.joinName, password: teamForm.joinPassword });
      if (res.data.success) { showToast(`Joined ${res.data.team.name}!`, 'success'); setTeamForm({ name: '', password: '', joinName: '', joinPassword: '' }); loadTeam(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to join team', 'error'); }
  };

  const handleLeaveTeam = async () => {
    if (!confirm('Leave your team?')) return;
    try {
      const res = await api.post(`/contests/${id}/teams/leave`);
      if (res.data.success) { showToast(res.data.message, 'success'); setMyTeam(null); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to leave team', 'error'); }
  };

  const [captainForm, setCaptainForm] = useState({ password: '', targetUser: '' });
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = () => {
    if (!profile?.team?.invite_code) return;
    const link = `${window.location.origin}/contests/${id}/join/${profile.team.invite_code}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleRegenerateInvite = async () => {
    try {
      const res = await api.post(`/contests/${id}/teams/regenerate-invite`);
      if (res.data.success) {
        showToast('Invite link regenerated!', 'success');
        loadProfile();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to regenerate invite link', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (!captainForm.password || captainForm.password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    try {
      const res = await api.put(`/contests/${id}/teams/password`, { password: captainForm.password });
      if (res.data.success) { showToast('Team password changed!', 'success'); setCaptainForm({ password: '', targetUser: '' }); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to change password', 'error'); }
  };

  const handleTransferCaptain = async (userId) => {
    try {
      const res = await api.put(`/contests/${id}/teams/captain`, { user_id: userId });
      if (res.data.success) { showToast('Captain transferred!', 'success'); loadTeam(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to transfer captain', 'error'); }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!confirm(`Remove ${userName} from the team?`)) return;
    try {
      const res = await api.delete(`/contests/${id}/teams/members/${userId}`);
      if (res.data.success) { showToast(res.data.message, 'success'); loadTeam(); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to remove member', 'error'); }
  };

  const handleDisband = async () => {
    if (!confirm('Disband the team? This cannot be undone.')) return;
    try {
      const res = await api.delete(`/contests/${id}/teams/disband`);
      if (res.data.success) { showToast(res.data.message, 'success'); setMyTeam(null); }
    } catch (err) { showToast(err.response?.data?.error || 'Failed to disband', 'error'); }
  };

  const handleSubmitFlag = async (flagInput) => {
    if (!flagInput) { showToast('Please enter a flag!', 'error'); return; }
    try {
      const res = await api.post(`/contests/${id}/submit`, {
        submitted_flag: flagInput,
        challenge_id: modal._id,
      });
      const d = res.data;
      showToast(d.message, d.submission_type !== 'incorrect' ? 'success' : 'error');
      if (d.submission_type === 'correct' && !d.practice) {
        playSuccessSound();
        loadChallenges();
        loadScoreboard();
      }
      else if (d.success) { loadChallenges(); }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error submitting flag', 'error');
    }
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  };

  const getMedal = (rank) => {
    if (rank === 1) return '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#f0a500);color:#5c3a00;font-weight:800;font-size:0.8rem">1</span>';
    if (rank === 2) return '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#e0e0e0,#b0b0b0);color:#4a4a4a;font-weight:800;font-size:0.8rem">2</span>';
    if (rank === 3) return '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#e8a87c,#cd7f32);color:#4a2800;font-weight:800;font-size:0.8rem">3</span>';
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:var(--text-secondary);font-weight:700;font-size:0.8rem">${rank}</span>`;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';

  if (loading) return <div className="spinner-neon"></div>;
  if (!contest) return (
    <div className="container my-5 text-center py-5">
      <i className="fas fa-question-circle" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}></i>
      <p className="mt-3 text-secondary">Contest not found.</p>
      <Link to="/contests" className="btn btn-neon-outline btn-sm">Back to Contests</Link>
    </div>
  );

  const contestStatus = (() => {
    if (contest.isArchived) return 'archived';
    if (contest.startDate && now < new Date(contest.startDate)) return 'upcoming';
    if (contest.endDate && now > new Date(contest.endDate)) return 'archived';
    return 'active';
  })();

  const isTeamContest = contest.participation_mode === 'team';
  const canParticipate = user && (!isTeamContest || myTeam);
  const registrationOver = contestStatus === 'active' && preRegConfig?.enabled && user && (!preRegConfig.myStatus || preRegConfig.myStatus === 'rejected');
  const myEntry = (() => {
    if (!user || scoreboardHidden || scoreboard.length === 0) return null;
    const identifier = isTeamContest ? myTeam?.name : user.user_name;
    if (!identifier) return null;
    return scoreboard.find(e => e.user_name === identifier) || null;
  })();

  return (
    <div className="container-fluid my-4 px-4">
      <div className="neon-card p-4 mb-4 text-center">
        <h2 className="fw-bold mb-1" style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}>{contest.title}</h2>
        {contest.description && <p className="mb-0 mt-2" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '700px', margin: '0 auto' }}>{contest.description}</p>}
      </div>

      <div className="row">
      <div className="col-12">

      {contest.startDate && contest.endDate && (() => {
        const start = new Date(contest.startDate);
        const end = new Date(contest.endDate);
        if (isNaN(start) || isNaN(end)) return null;
        const total = end - start;
        if (total <= 0) return null;

        if (contestStatus === 'active') {
          const elapsed = Math.max(0, now - start);
          const pct = Math.min(100, (elapsed / total) * 100);
          const remaining = Math.max(0, total - elapsed);
          const days = Math.floor(remaining / 86400000);
          const hours = Math.floor((remaining % 86400000) / 3600000);
          const mins = Math.floor((remaining % 3600000) / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          const timeText = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
          return (
            <div className="neon-card p-3 mb-4">
              <div className="d-flex justify-content-between small mb-1" style={{ color: 'var(--text-muted)' }}>
                <span><i className="fas fa-hourglass-half me-1"></i>Time Remaining</span>
                <span className="fw-semibold" style={{ color: pct > 85 ? '#f87171' : 'var(--accent)' }}>{timeText}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? 'linear-gradient(90deg, #f87171, #ef4444)' : 'linear-gradient(90deg, var(--accent), #818cf8)', borderRadius: 3, transition: 'width 1s ease' }}></div>
              </div>
            </div>
          );
        }

        if (contestStatus === 'upcoming') {
          const diff = Math.max(0, start - now);
          const days = Math.floor(diff / 86400000);
          const hours = Math.floor((diff % 86400000) / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          const timeText = days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
          return (
            <div className="neon-card p-3 mb-4">
              <div className="d-flex justify-content-between small mb-1" style={{ color: 'var(--text-muted)' }}>
                <span><i className="fas fa-clock me-1"></i>Starts In</span>
                <span className="fw-semibold" style={{ color: '#facc15' }}>{timeText}</span>
              </div>
            </div>
          );
        }

        if (contestStatus === 'archived') {
          return (
            <div className="neon-card p-3 mb-4">
              <div className="small" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-check-circle me-1" style={{ color: '#4ade80' }}></i>This contest has ended.
              </div>
            </div>
          );
        }

        return null;
      })()}

      {preRegConfig?.enabled && (() => {
        if (!user) return (
          <div className="neon-card p-4 mb-4 text-center">
            <i className="fas fa-user-lock" style={{ fontSize: '2rem', color: 'var(--accent)' }}></i>
            <h5 className="fw-bold mt-2 mb-0">Pre-registration Required</h5>
            <p className="mb-0" style={{ color: 'var(--text-muted)' }}>
              Please <Link to="/login" className="fw-bold">log in</Link> and pre-register before the contest starts to participate.
            </p>
          </div>
        );
        if (preRegConfig.myStatus === 'pending') return (
          <div className="neon-card p-4 mb-4 text-center">
            <i className="fas fa-hourglass-half" style={{ fontSize: '2rem', color: '#facc15' }}></i>
            <h5 className="fw-bold mt-2 mb-0">Pre-registration submitted!</h5>
            <p className="mb-0" style={{ color: 'var(--text-muted)' }}>Awaiting admin approval.</p>
          </div>
        );
        if (preRegConfig.myStatus === 'rejected') return (
          <div className="neon-card p-4 mb-4 text-center" style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
            <i className="fas fa-times-circle" style={{ fontSize: '2rem', color: '#f87171' }}></i>
            <h5 className="fw-bold mt-2 mb-0">Pre-registration rejected</h5>
            <p className="mb-0" style={{ color: 'var(--text-muted)' }}>Contact the contest admin for more information.</p>
          </div>
        );
        if (preRegConfig.myStatus === 'accepted' && contestStatus === 'upcoming') return (
          <div className="neon-card p-4 mb-4 text-center" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: '#4ade80' }}></i>
            <h5 className="fw-bold mt-2 mb-0">Pre-registration accepted!</h5>
            <p className="mb-0" style={{ color: 'var(--text-muted)' }}>You can participate when the contest starts.</p>
          </div>
        );
        if (contestStatus === 'upcoming') return (
          <div className="neon-card p-4 mb-4">
            <h5 className="fw-bold mb-3" style={{ color: 'var(--accent)' }}>
              <i className="fas fa-user-plus me-2"></i>Pre-Register for {preRegConfig.title || contest.title}
            </h5>
            <form onSubmit={handlePreRegSubmit}>
              <div className="row g-3">
                {(preRegConfig.fields || []).map((field, i) => (
                  <div key={i} className="col-md-6">
                    <label className="form-label">
                      {field.label}
                      {field.required && <span style={{ color: '#f87171' }}> *</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select className="form-select" value={preRegForm[field.label] || ''} onChange={e => setPreRegForm({ ...preRegForm, [field.label]: e.target.value })} required={field.required}>
                        <option value="">Select...</option>
                        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea className="form-control" rows="3" value={preRegForm[field.label] || ''} onChange={e => setPreRegForm({ ...preRegForm, [field.label]: e.target.value })} required={field.required} />
                    ) : (
                      <input type={field.type || 'text'} className="form-control" value={preRegForm[field.label] || ''} onChange={e => setPreRegForm({ ...preRegForm, [field.label]: e.target.value })} required={field.required} />
                    )}
                  </div>
                ))}
              </div>
              <button type="submit" className="btn btn-neon mt-3"><i className="fas fa-paper-plane me-1"></i> Pre-Register</button>
            </form>
          </div>
        );
        return null;
      })()}

      {registrationOver && (
        <div className="neon-card p-4 mb-4 text-center">
          <i className="fas fa-clock" style={{ fontSize: '2rem', color: '#f87171' }}></i>
          <h5 className="fw-bold mt-2 mb-0">Registration period is over</h5>
          <p className="mb-0" style={{ color: 'var(--text-muted)' }}>Pre-registration was required for this contest and the registration window has closed.</p>
        </div>
      )}

      <ul className="nav nav-tabs mb-4">
        {!registrationOver && (
        <li className="nav-item">
          <button className={`nav-link ${tab === 'challenges' ? 'active' : ''}`} onClick={() => setTab('challenges')}>
            <i className="fas fa-skull-crossbones me-1"></i> Challenges
          </button>
        </li>
        )}
        <li className="nav-item">
          <button className={`nav-link ${tab === 'scoreboard' ? 'active' : ''}`} onClick={() => { setTab('scoreboard'); loadScoreboard(); }}>
            <i className="fas fa-trophy me-1"></i> Scoreboard
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'notifications' ? 'active' : ''}`} onClick={() => { setTab('notifications'); setUnreadCount(0); }}>
            <i className="fas fa-bell me-1"></i> Notifications
            {unreadCount > 0 && (
              <span className="badge ms-1" style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.6rem', borderRadius: '50%', padding: '0.2rem 0.4rem', minWidth: '1rem', lineHeight: 1 }}>{unreadCount}</span>
            )}
          </button>
        </li>
        {user && (
        <li className="nav-item">
          <button className={`nav-link ${tab === 'profile' ? 'active' : ''}`} onClick={() => { setTab('profile'); loadProfile(); }}>
            <i className="fas fa-user me-1"></i> Profile
          </button>
        </li>
        )}
        {user && (user.role === 0 || user.role === 2) && (
        <li className="nav-item">
          <button className={`nav-link ${tab === 'submissions' ? 'active' : ''}`} onClick={() => { setTab('submissions'); loadSubmissions(); }}>
            <i className="fas fa-file-alt me-1"></i> Submissions
          </button>
        </li>
        )}
        {user && (user.role === 0 || user.role === 2) && (
        <li className="nav-item">
          <button className={`nav-link ${tab === 'first-blood' ? 'active' : ''}`} onClick={() => { setTab('first-blood'); loadBloods(); }}>
            <i className="fas fa-skull me-1"></i> First Blood
          </button>
        </li>
        )}
      </ul>

      {(() => {
        if (tab === 'profile') {
          if (profileLoading) return <div className="text-center py-5"><div className="spinner-neon"></div></div>;
          if (!profile) return <div className="text-center py-5"><p className="text-secondary">Click Profile tab to load.</p></div>;
          const pIsAdmin = user && (user.role === 0 || user.role === 2);
          return (
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="neon-card p-4 text-center">
                  {profile.team ? (
                    <>
                      <i className="fas fa-users" style={{ fontSize: '2rem', color: 'var(--accent)' }}></i>
                      <h4 className="fw-bold mt-2 mb-1">{profile.team.name}</h4>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-circle" style={{ fontSize: '2rem', color: 'var(--accent)' }}></i>
                      <h4 className="fw-bold mt-2 mb-1">{profile.user_name}</h4>
                    </>
                  )}
                  <div className="d-flex justify-content-center gap-3 mt-3">
                    <div className="p-2" style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius)', flex: 1, maxWidth: '100px' }}>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Rank</div>
                      <div className="fw-bold fs-5" style={{ color: 'var(--accent)' }}>{profile.rank ? `#${profile.rank}` : '-'}</div>
                    </div>
                    <div className="p-2" style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius)', flex: 1, maxWidth: '100px' }}>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Score</div>
                      <div className="fw-bold fs-5" style={{ color: 'var(--accent)' }}>{profile.score}</div>
                    </div>
                    <div className="p-2" style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius)', flex: 1, maxWidth: '100px' }}>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Solves</div>
                      <div className="fw-bold fs-5" style={{ color: 'var(--accent)' }}>{profile.solves?.length || 0}</div>
                    </div>
                  </div>
                  {profile.hint_costs > 0 && (
                    <div className="mt-2 small" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-lightbulb me-1"></i>Hint costs: <span style={{ color: '#f87171' }}>-{profile.hint_costs} pts</span>
                    </div>
                  )}
                </div>

                {profile.team && (
                  <div className="neon-card p-3 mt-4">
                    <h6 className="fw-bold mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-users me-1"></i> Team Members
                    </h6>
                    {profile.team.members?.map(m => {
                      const isCap = String(m._id || m) === String(profile.team.captain?._id || profile.team.captain);
                      const isCurrentUser = String(m._id || m) === String(user?._id);
                      const isLeader = user && String(profile.team.captain?._id || profile.team.captain) === String(user._id);
                      return (
                        <div key={m._id} className="d-flex align-items-center justify-content-between mb-1" style={{ fontSize: '0.85rem' }}>
                          <div className="d-flex align-items-center gap-2">
                            <span>{m.user_name || 'Unknown'}</span>
                            {isCap && <i className="fas fa-crown" style={{ color: '#facc15', fontSize: '0.7rem' }}></i>}
                            {isCurrentUser && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(you)</span>}
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{m.total_score} pts</span>
                            {isLeader && !isCurrentUser && (
                              <>
                                <button className="btn btn-sm p-0" style={{ color: 'var(--accent)', fontSize: '0.7rem', lineHeight: 1 }} onClick={() => { handleTransferCaptain(m._id); setTimeout(() => loadProfile(), 500); }} title="Make captain">
                                  <i className="fas fa-crown"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <i className="fas fa-link me-1"></i> Invite Link
                        </span>
                        {(() => {
                          const isLeader = user && String(profile.team.captain?._id || profile.team.captain) === String(user._id);
                          if (!isLeader) return null;
                          return (
                            <button className="btn btn-sm p-0" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }} onClick={handleRegenerateInvite} title="Regenerate invite link">
                              <i className="fas fa-sync-alt"></i>
                            </button>
                          );
                        })()}
                      </div>
                      <div className="d-flex gap-2 align-items-center">
                        <code style={{ flex: 1, fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', wordBreak: 'break-all', overflow: 'hidden' }}>
                          {window.location.origin}/contests/{id}/join/{profile.team.invite_code}
                        </code>
                        <button className="btn btn-neon-outline btn-sm py-1 px-2" style={{ fontSize: '0.7rem', flexShrink: 0 }} onClick={handleCopyInvite}>
                          {copiedInvite ? <><i className="fas fa-check me-1"></i>Copied</> : <><i className="fas fa-copy me-1"></i>Copy</>}
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const isLeader = user && String(profile.team.captain?._id || profile.team.captain) === String(user._id);
                      if (!isLeader) return null;
                      return (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="d-flex gap-2 flex-wrap">
                            <button className="btn btn-neon-outline btn-sm" onClick={() => setCaptainForm({ ...captainForm, showPassword: !captainForm.showPassword })}>
                              <i className="fas fa-key me-1"></i> Change Password
                            </button>
                            <button className="btn btn-neon-danger btn-sm" onClick={() => { handleDisband(); setTimeout(() => loadProfile(), 500); }}><i className="fas fa-trash me-1"></i> Disband Team</button>
                          </div>
                          {captainForm.showPassword && (
                            <div className="d-flex gap-2 align-items-center mt-2">
                              <input type="password" className="form-control form-control-sm" style={{ maxWidth: '200px' }} value={captainForm.password} onChange={e => setCaptainForm({ ...captainForm, password: e.target.value })} placeholder="New team password" />
                              <button className="btn btn-neon btn-sm" onClick={() => { handleChangePassword(); setTimeout(() => loadProfile(), 500); }}><i className="fas fa-save me-1"></i> Save</button>
                  </div>
                )}
              </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="col-lg-8">
                {scoreboardFrozen && !pIsAdmin && (
                  <div className="alert mb-4" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent)', borderRadius: 'var(--radius)' }}>
                    <i className="fas fa-snowflake me-2"></i>Scoreboard is frozen. Solve details are hidden until the freeze period ends.
                  </div>
                )}
                {(!scoreboardFrozen || pIsAdmin) && (<>
                <div className="neon-card p-4 mb-4">
                  <h6 className="fw-bold mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="fas fa-check-circle me-1"></i> Solves ({profile.solves?.length || 0})
                  </h6>
                  {(!profile.solves || profile.solves.length === 0) ? (
                    <p className="text-secondary small text-center py-3">No solves yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="neon-table" style={{ marginBottom: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Challenge</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Category</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Points</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.solves.map((s, i) => (
                            <tr key={i}>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>{s.challenge_name}</td>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.category}</td>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', textAlign: 'right', color: 'var(--accent)' }}>+{s.points}</td>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', textAlign: 'right', color: 'var(--text-muted)' }}>{new Date(s.solved_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {profile.submissions && profile.submissions.length > 0 && (
                  <div className="neon-card p-4">
                    <h6 className="fw-bold mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-history me-1"></i> Recent Submissions
                    </h6>
                    <div className="table-responsive">
                      <table className="neon-table" style={{ marginBottom: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Challenge</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Result</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.submissions.slice(0, 20).map((s, i) => (
                            <tr key={i}>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>{s.challenge_name}</td>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                                <span className={`badge ${s.submission_type === 'correct' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                                  {s.submission_type}
                                </span>
                                {s.practice && <span className="badge ms-1" style={{ background: '#facc15', color: '#000', fontSize: '0.6rem' }}>Practice</span>}
                              </td>
                              <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', textAlign: 'right', color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                </>)}
              </div>
            </div>
          );
        }

        if (tab === 'submissions') {
          const isSubAdmin = user && (user.role === 0 || user.role === 2);
          const handleToggle = async (id) => {
            if (!confirm('Toggle this submission type?')) return;
            try {
              await api.put(`/admin/submissions/${id}/toggle`);
              loadSubmissions(subPage);
            } catch {}
          };
          const handleDelete = async (id) => {
            if (!confirm('Delete this submission? This will also remove associated points.')) return;
            try {
              await api.delete(`/admin/submissions/${id}`);
              loadSubmissions(subPage);
            } catch {}
          };
          return (
            <div className="neon-card p-4">
              <h4 className="fw-bold mb-4"><i className="fas fa-file-alt me-2" style={{ color: 'var(--accent)' }}></i>Submissions</h4>
              <div className="table-responsive">
                <table className="neon-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Challenge</th>
                      <th>Flag</th>
                      <th>Result</th>
                      {isSubAdmin && <th>Actions</th>}
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(s => (
                      <tr key={s.submission_id}>
                        <td>{s.user_name}</td>
                        <td>{s.challenge_name} ({s.challenge_point})</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.submitted_flag}</td>
                        <td><span className={`badge ${s.submission_type === 'correct' ? 'bg-success' : 'bg-danger'}`}>{s.submission_type}</span>{s.practice && <span className="badge" style={{ background: '#facc15', color: '#000', fontSize: '0.6rem', verticalAlign: 'middle' }}>Practice</span>}</td>
                        {isSubAdmin && (
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm" style={{ color: 'var(--accent)', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius)' }} onClick={() => handleToggle(s.submission_id)} title="Toggle correct/incorrect">
                                <i className="fas fa-exchange-alt"></i>
                              </button>
                              <button className="btn btn-sm" style={{ color: '#f87171', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)' }} onClick={() => handleDelete(s.submission_id)} title="Delete submission">
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        )}
                        <td>{new Date(s.timestamp_of_submission).toLocaleString()}</td>
                      </tr>
                    ))}
                    {submissions.length === 0 && <tr><td colSpan={isSubAdmin ? 6 : 5} className="text-center">No submissions.</td></tr>}
                  </tbody>
                </table>
              </div>
              {subTotalPages > 1 && (
                <div className="d-flex justify-content-center gap-2 mt-4">
                  <button className="btn btn-neon-outline btn-sm" disabled={subPage <= 1} onClick={() => loadSubmissions(subPage - 1)}>Previous</button>
                  <span className="align-self-center">Page {subPage} of {subTotalPages}</span>
                  <button className="btn btn-neon-outline btn-sm" disabled={subPage >= subTotalPages} onClick={() => loadSubmissions(subPage + 1)}>Next</button>
                </div>
              )}
            </div>
          );
        }

        if (tab === 'first-blood') {
          return (
            <div className="neon-card p-4">
              <div className="d-flex align-items-center justify-content-between mb-4">
                <h4 className="fw-bold mb-0"><i className="fas fa-skull me-2" style={{ color: 'var(--accent)' }}></i>First Blood</h4>
                {user && (user.role === 0 || user.role === 2) && (
                  <a href={`/api/admin/first-blood/${contest._id}/export`} className="btn btn-neon-outline btn-sm" download>
                    <i className="fas fa-download me-1"></i> Export CSV
                  </a>
                )}
              </div>
              {bloods.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-tint" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
                  <p className="mt-3 text-secondary">No challenges solved yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="neon-table">
                    <thead>
                      <tr><th>Challenge</th><th>Category</th><th>Points</th><th>First Solver</th><th>Solved At</th></tr>
                    </thead>
                    <tbody>
                      {bloods.map(b => (
                        <tr key={b._id}>
                          <td className="fw-bold">{b.challenge_name}</td>
                          <td><span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{b.category}</span></td>
                          <td>{b.points}</td>
                          <td><span className="fw-bold" style={{ color: 'var(--accent)' }}>{b.solver_name}</span></td>
                          <td>{new Date(b.solved_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }

        if (tab === 'notifications') {
          return (
            <div className="neon-card p-4">
              <h4 className="fw-bold mb-0"><i className="fas fa-bell me-2" style={{ color: 'var(--accent)' }}></i>Notifications</h4>
              {notifications.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-bell-slash" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
                  <p className="mt-3 text-secondary">No notifications yet.</p>
                </div>
              ) : (
                <div className="mt-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notifications.map(n => (
                    <div key={n._id} className="p-3" style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: '3px solid var(--accent)',
                      borderRadius: 'var(--radius)',
                    }}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="fas fa-bell" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}></i>
                        <strong style={{ color: 'var(--accent)' }}>{n.title}</strong>
                      </div>
                      {n.content && <p className="mb-1" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{n.content}</p>}
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(n.createdAt).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        if (tab === 'scoreboard') {
          return (
            <>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2">
                  <h4 className="section-title mb-0"><i className="fas fa-trophy me-2" style={{ color: 'var(--accent)' }}></i>Live Leaderboard</h4>
                  {scoreboardFrozen ? (
                    <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)' }}><i className="fas fa-snowflake me-1"></i>Frozen</span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}><i className="fas fa-bolt me-1"></i>Live</span>
                  )}
                </div>
                {user && (user.role === 0 || user.role === 2) && (
                  <a href={`/api/admin/scoreboard/${contest._id}/export`} className="btn btn-neon-outline btn-sm" download>
                    <i className="fas fa-download me-1"></i> Export CSV
                  </a>
                )}
              </div>

              {scoreboardFrozen && (
                <div className="alert" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent)', borderRadius: 'var(--radius)' }}>
                  <i className="fas fa-snowflake me-2"></i>Scoreboard is frozen. Final rankings reflect the state as of the freeze time <span className="fw-bold">&mdash; no further solves count.</span>
                </div>
              )}

              {scoreboardHidden ? (
                <div className="neon-card text-center py-5">
                  <div style={{ width: 70, height: 70, margin: '0 auto', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-eye-slash" style={{ fontSize: '1.6rem', color: 'var(--text-muted)' }}></i>
                  </div>
                  <h5 className="mt-3 mb-1">Scoreboard Hidden</h5>
                  <p className="mb-0 text-secondary px-3">This contest's leaderboard is hidden. Standings are not visible to participants.</p>
                </div>
              ) : scoreboard.length === 0 ? (
                <div className="neon-card text-center py-5">
                  <div style={{ width: 70, height: 70, margin: '0 auto', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-chart-line" style={{ fontSize: '1.6rem', color: 'var(--text-muted)' }}></i>
                  </div>
                  <h5 className="mt-3 mb-1">No Solves Yet</h5>
                  <p className="mb-0 text-secondary px-3">Be the first to solve a challenge and claim the top spot.</p>
                </div>
              ) : (
                <>
                  <div className="neon-card p-0">
                    <ScoreboardGrid
                      scoreboard={scoreboard}
                      challengesByCategory={challenges}
                      isTeamContest={isTeamContest}
                      selfName={isTeamContest ? (myTeam?.name || '') : (user?.user_name || '')}
                      startDate={contest.startDate}
                      contestId={contest._id}
                    />
                  </div>

                  {myEntry && (
                    <div className="mt-3 neon-card p-3">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-user-check" style={{ color: 'var(--accent)' }}></i>
                          <span className="fw-bold" style={{ color: 'var(--text-primary)' }}>Your Standing</span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <span className="fw-bold" style={{ color: 'var(--accent)' }}>#{myEntry.rank}</span>
                          <span className="fw-bold" style={{ color: 'var(--text-secondary)' }}>{myEntry.total_score.toLocaleString()} pts</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          );
        }

        if (tab === 'challenges' && registrationOver) return null;

        if (contestStatus === 'upcoming') {
          return (
            <div className="neon-card text-center py-5">
              <i className="fas fa-clock" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
              <h5 className="mt-3">Contest Not Started</h5>
              <p className="text-secondary">Challenges will be visible once the contest starts.</p>
            </div>
          );
        }

        if (contest.paused) {
          return (
            <div className="neon-card text-center py-5">
              <i className="fas fa-pause-circle" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
              <h5 className="mt-3">Contest Paused</h5>
              <p className="text-secondary">Challenges are temporarily hidden by the organizer.</p>
            </div>
          );
        }

        const challengeContent = (
          <>
            {contestStatus === 'archived' && (
              <div className="alert alert-secondary py-2"><i className="fas fa-info-circle me-1"></i>This contest has ended. You can still open challenges and test flags on Practice-locked ones (marked <i className="fas fa-dumbbell me-1"></i>Practice), but no points are awarded.</div>
            )}
            <div className="d-flex gap-2 mb-2 flex-wrap">
              <button className={`filter-link btn text-start ${solveFilter === 'all' ? 'active' : ''}`} onClick={() => setSolveFilter('all')} style={{ width: 'auto' }}>
                <i className="fas fa-layer-group me-1"></i>All
              </button>
              <button className={`filter-link btn text-start ${solveFilter === 'open' ? 'active' : ''}`} onClick={() => setSolveFilter('open')} style={{ width: 'auto' }}>
                <i className="fas fa-lock-open me-1" style={{ color: '#4ade80' }}></i>Open to solve
              </button>
              <button className={`filter-link btn text-start ${solveFilter === 'locked' ? 'active' : ''}`} onClick={() => setSolveFilter('locked')} style={{ width: 'auto' }}>
                <i className="fas fa-dumbbell me-1" style={{ color: '#facc15' }}></i>Practice
              </button>
            </div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
              <button className={`filter-link btn text-start ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} style={{ width: 'auto' }}>
                <i className="fas fa-th-list me-1"></i>All
              </button>
              {categories.map(cat => (
                <button key={cat} className={`filter-link btn text-start ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)} style={{ width: 'auto' }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="rctf-layout">
              <div className="rctf-list-pane">
                <ChallengeBrowser
                  challenges={challenges}
                  categories={categories}
                  filter={filter}
                  setFilter={setFilter}
                  solveFilter={solveFilter}
                  setSolveFilter={setSolveFilter}
                  userProgress={userProgress}
                  user={user}
                  selfIdentity={isTeamContest ? myTeam?.name : user?.user_name}
                  selected={modal}
                  openChallenge={openChallenge}
                  onChanged={loadChallenges}
                />
              </div>
              <div className="rctf-detail-pane">
                <ChallengeDetailsPane
                  challenge={modal}
                  userProgress={userProgress}
                  onSubmit={handleSubmitFlag}
                  onClose={closeModal}
                />
              </div>
            </div>
            {isNarrow && (
              <ChallengeDrawer
                open={!!modal}
                challenge={modal}
                userProgress={userProgress}
                onSubmit={handleSubmitFlag}
                onClose={closeModal}
              />
            )}
            <style>{`
                .rctf-layout { display: flex; align-items: flex-start; gap: 1rem; }
                .rctf-list-pane { flex: 1 1 calc(50% - 0.5rem); min-width: 0; }
                .rctf-detail-pane {
                  flex: 0 0 calc(50% - 0.5rem); width: calc(50% - 0.5rem);
                  position: sticky; top: 1rem;
                  max-height: calc(100dvh - 2rem);
                  margin-bottom: 3rem;
                }
                @media (max-width: 920px) {
                  .rctf-detail-pane { display: none; }
                }
              `}</style>
          </>
        );

        if (tab !== 'challenges') return null;

        if (!user) {
          return (
            <div className="neon-card text-center py-5">
              <i className="fas fa-lock" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
              <h5 className="mt-3">Login Required</h5>
              <p className="text-secondary">Please <Link to="/login" className="fw-bold">login</Link> to view and attempt challenges.</p>
            </div>
          );
        }

        if (teamLoading) {
          return <div className="spinner-neon"></div>;
        }

        if (!canParticipate) {
          return (
            <>
              <div className="neon-card text-center py-4 px-4 mb-4">
                <i className="fas fa-users" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
                <h5 className="mt-3">Participation Required</h5>
                <p className="text-secondary">You must fulfill the condition to participate or view details.</p>
                {isTeamContest && (
                  <div className="row g-4 mt-2" style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'left' }}>
                    <div className="col-md-6">
                      <div className="neon-card h-100 p-3">
                        <h6 className="fw-bold mb-3"><i className="fas fa-plus-circle me-2" style={{ color: 'var(--accent)' }}></i>Create Team</h6>
                        <form onSubmit={handleCreateTeam}>
                          <div className="mb-2">
                            <input className="form-control form-control-sm" placeholder="Team Name" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} required />
                          </div>
                          <div className="mb-2">
                            <input type="password" className="form-control form-control-sm" placeholder="Team Password" value={teamForm.password} onChange={e => setTeamForm({ ...teamForm, password: e.target.value })} required />
                          </div>
                          <button type="submit" className="btn btn-neon btn-sm w-100"><i className="fas fa-plus me-1"></i> Create</button>
                        </form>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="neon-card h-100 p-3">
                        <h6 className="fw-bold mb-3"><i className="fas fa-sign-in-alt me-2" style={{ color: 'var(--accent)' }}></i>Join Team</h6>
                        <form onSubmit={handleJoinTeam}>
                          <div className="mb-2">
                            <input className="form-control form-control-sm" placeholder="Team Name" value={teamForm.joinName} onChange={e => setTeamForm({ ...teamForm, joinName: e.target.value })} required />
                          </div>
                          <div className="mb-2">
                            <input type="password" className="form-control form-control-sm" placeholder="Team Password" value={teamForm.joinPassword} onChange={e => setTeamForm({ ...teamForm, joinPassword: e.target.value })} required />
                          </div>
                          <button type="submit" className="btn btn-neon btn-sm w-100"><i className="fas fa-sign-in-alt me-1"></i> Join</button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="neon-card p-3">
                    <h6 className="fw-bold mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-trophy me-1"></i> Scoreboard
                    </h6>
                    {scoreboardHidden ? (
                      <p className="small text-secondary text-center py-3"><i className="fas fa-eye-slash me-1"></i>Scoreboard is hidden.</p>
                    ) : scoreboard.length === 0 ? (
                      <p className="small text-secondary text-center py-3">No scores yet.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="neon-table" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '60px', padding: '0.6rem 0.75rem' }}>#</th>
                              <th style={{ padding: '0.6rem 0.75rem' }}>{isTeamContest ? 'Team' : 'User'}</th>
                              <th style={{ width: '70px', padding: '0.6rem 0.75rem', textAlign: 'right' }}>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scoreboard.map((entry, i) => (
                              <tr key={entry.rank}>
                                <td style={{ padding: '0.5rem 0.75rem' }} dangerouslySetInnerHTML={{ __html: getMedal(entry.rank) }} />
                                <td className="fw-bold" style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}>{entry.user_name}</td>
                                <td className="fw-bold" style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: entry.rank <= 3 ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>{entry.total_score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                      <div className="text-center mt-2">
                      <button className="btn btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setTab('scoreboard')}>View Full <i className="fas fa-arrow-right ms-1"></i></button>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="neon-card p-3">
                    <h6 className="fw-bold mb-3" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-bell me-1"></i> Notifications
                    </h6>
                    {notifications.length === 0 ? (
                      <p className="small text-secondary text-center py-3">No notifications yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {notifications.slice(0, 3).map(n => (
                          <div key={n._id} className="p-2" style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderLeft: '3px solid var(--accent)',
                            borderRadius: 'var(--radius)',
                          }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{n.title}</strong>
                            {n.content && <p className="mb-0" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{n.content}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-center mt-2">
                      <button className="btn btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setTab('notifications')}>View All Notifications <i className="fas fa-arrow-right ms-1"></i></button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        }

        return challengeContent;
      })()}
    </div>

    </div>
    </div>
  );
}
