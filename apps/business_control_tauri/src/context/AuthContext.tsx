import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  getAccessToken,
  getAdminToken,
  getAuthUser,
  clearAdminToken,
  hasValidStoredSession,
  AUTH_EXPIRED_EVENT,
  AuthUser,
} from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Initialize and check token
  useEffect(() => {
    const token = getAccessToken() || getAdminToken();
    const storedUser = getAuthUser();
    if (token && hasValidStoredSession()) {
      setUser(storedUser || { id: 'legacy-admin', name: 'Owner', role: 'owner' });
      setIsAuthenticated(true);
    } else {
      clearAdminToken();
    }
    setIsLoading(false);
  }, []);




  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      if (email.trim()) {
        const result = await api.login(email.trim(), password);
        setUser(result.user);
        setIsAuthenticated(true);
        setIsLoading(false);
        return true;
      }

      const result = await api.verifyAdminPassword(password);
      if (result.success) {
        setUser({ id: 'legacy-admin', name: 'Owner', role: 'owner' });
        setIsAuthenticated(true);
        setIsLoading(false);
        return true;
      }
      setError('Autenticación fallida');
      setIsLoading(false);
      return false;
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  // Periodically check if token has expired and close the session if so
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExpiration = () => {
      if (!hasValidStoredSession()) {
        logout();
      }
    };

    // Run immediately when status becomes authenticated
    checkExpiration();

    const interval = setInterval(checkExpiration, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setIsAuthenticated(false);
      setError('Tu sesion expiro. Inicia sesion nuevamente.');
      setIsLoading(false);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        user,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
