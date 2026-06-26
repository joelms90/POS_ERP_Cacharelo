import { useState, useEffect, useCallback } from 'react';
import { api, getAdminToken, clearAdminToken } from '../services/api';

export interface UseAuthResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthResult => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and check token
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.verifyAdminPassword(password);
      if (result.success) {
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
    setIsAuthenticated(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };
};
