import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ContestList from './pages/ContestList';
import ContestDetail from './pages/ContestDetail';
import Profile from './pages/Profile';
import ViewProfile from './pages/ViewProfile';
import VDP from './pages/VDP';
import DeveloperInfo from './pages/DeveloperInfo';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminContests from './pages/admin/AdminContests';
import AdminContestDetail from './pages/admin/AdminContestDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPendingUsers from './pages/admin/AdminPendingUsers';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminSolves from './pages/admin/AdminSolves';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children, adminOnly: admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner-neon"></div>;
  if (!user) return <Navigate to="/login" />;
  if (admin && user.role !== 0 && user.role !== 2) return <Navigate to="/" />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner-neon"></div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 2) return <Navigate to="/admin" />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/contests" element={<ContestList />} />
            <Route path="/contests/:id" element={<ContestDetail />} />
            <Route path="/contests/:id/join/:inviteCode" element={<ContestDetail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/vdp" element={<VDP />} />
            <Route path="/developer-info" element={<DeveloperInfo />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ViewProfile />} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/contests" element={<ProtectedRoute adminOnly><AdminContests /></ProtectedRoute>} />
            <Route path="/admin/contests/:id" element={<ProtectedRoute adminOnly><AdminContestDetail /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/pending" element={<ProtectedRoute adminOnly><AdminPendingUsers /></ProtectedRoute>} />
            <Route path="/admin/submissions" element={<ProtectedRoute adminOnly><AdminSubmissions /></ProtectedRoute>} />
            <Route path="/admin/solves" element={<ProtectedRoute adminOnly><AdminSolves /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute adminOnly><AdminLogs /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<SuperAdminRoute><AdminSettings /></SuperAdminRoute>} />
          </Routes>
        </div>
        <Footer />
      </div>
    </ToastProvider>
  );
}
