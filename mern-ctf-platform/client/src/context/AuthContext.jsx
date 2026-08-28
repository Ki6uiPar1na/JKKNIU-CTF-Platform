import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password, captchaId, captchaText) => {
    const res = await api.post('/auth/login', { email, password, captchaId, captchaText });
    if (res.data.success) {
      await checkAuth();
    }
    return res.data;
  };

  const signup = async (data) => {
    const res = await api.post('/auth/signup', data);
    return res.data;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      await api.post('/auth/refresh');
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshToken, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
