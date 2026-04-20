import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    const stored = localStorage.getItem('lms_admin');
    if (token && stored) {
      try { setAdmin(JSON.parse(stored)); } catch { logout(); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    const { token, admin: adminData } = data.data;
    localStorage.setItem('lms_token', token);
    localStorage.setItem('lms_admin', JSON.stringify(adminData));
    setAdmin(adminData);
    return adminData;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_admin');
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
