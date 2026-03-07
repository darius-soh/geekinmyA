// Auth context for Sure Bo?
// Manages user authentication state, onboarding, and preferences
import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();

const STORAGE_KEY = 'surebo_user';

function loadUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const login = useCallback((userData) => {
    const userWithTimestamp = {
      ...userData,
      createdAt: new Date().toISOString(),
    };
    setUser(userWithTimestamp);
    saveUser(userWithTimestamp);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updatePreferences = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      saveUser(updated);
      return updated;
    });
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updatePreferences }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
