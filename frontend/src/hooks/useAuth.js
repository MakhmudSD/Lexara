import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'authUser';
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isExpired(claims) {
  if (!claims?.exp) return true;
  return Date.now() / 1000 > claims.exp - 30;
}

export function useAuth() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setAuth(JSON.parse(localStorage.getItem(USER_KEY)) || null);
      } catch {
        setAuth(null);
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('auth:change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('auth:change', sync);
    };
  }, []);

  const login = useCallback((userObj, token) => {
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    if (token) localStorage.setItem(TOKEN_KEY, token);
    setAuth(userObj);
    window.dispatchEvent(new Event('auth:change'));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('workspaceId');
    localStorage.removeItem('workspaceName');
    delete client.defaults.headers.common['Authorization'];
    setAuth(null);
    window.dispatchEvent(new Event('auth:change'));
  }, []);

  // Inactivity logout — fires after 30 min of no user input
  useEffect(() => {
    if (!auth) return;
    let timerId;
    const reset = () => {
      clearTimeout(timerId);
      timerId = setTimeout(logout, INACTIVITY_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset(); // start the countdown immediately on login
    return () => {
      clearTimeout(timerId);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [auth, logout]);

  const isAdmin = auth?.role?.toLowerCase() === 'admin';
  const isAuthenticated = auth !== null;

  return { auth, login, logout, isAdmin, isAuthenticated };
}

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const claims = decodeJWT(token);
  if (!claims || isExpired(claims)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
