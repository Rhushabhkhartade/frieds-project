import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiClient } from '../services/api.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'blood_ai_token';
const USER_KEY = 'blood_ai_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Re-fetch the current user profile from the server using the stored token
   */
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      return null;
    }
    try {
      const response = await api.auth.me();
      const userData = response.data;
      setUser(userData);
      setToken(currentToken);
      setIsAuthenticated(true);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      return userData;
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      throw err;
    }
  }, []);

  /**
   * Attempt to restore session on mount.
   * We validate the stored token with the server so we never trust stale data.
   */
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.auth.me();
        setUser(response.data);
        setToken(storedToken);
        setIsAuthenticated(true);
      } catch {
        // Token is invalid or expired — clear silently
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  /**
   * Register a new user account.
   */
  const register = useCallback(async (registrationData) => {
    const response = await api.auth.register(registrationData);
    return response; // Caller handles redirect to /login
  }, []);

  /**
   * Authenticate and store the JWT.
   */
  const login = useCallback(async ({ email, password }) => {
    const response = await api.auth.login({ email, password });
    const { token: receivedToken, user: authUser } = response.data;

    localStorage.setItem(TOKEN_KEY, receivedToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));

    setToken(receivedToken);
    setUser(authUser);
    setIsAuthenticated(true);
    return authUser;
  }, []);

  /**
   * Discard token and clear state.
   */
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Stateless JWT: server acknowledges, client discards
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        loading,
        login,
        logout,
        register,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
