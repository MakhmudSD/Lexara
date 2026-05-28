import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth, getToken } from '../hooks/useAuth.js';

// Minimal JWT builder (header.payload.sig)
function makeJWT(claims) {
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '');
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`;
}

beforeEach(() => localStorage.clear());

describe('useAuth — initial state', () => {
  it('starts unauthenticated when localStorage is empty', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.auth).toBeNull();
  });

  it('restores auth from localStorage on mount', () => {
    localStorage.setItem('authUser', JSON.stringify({ email: 'u@example.com', role: 'member' }));
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.auth.email).toBe('u@example.com');
  });

  it('handles malformed JSON in localStorage gracefully', () => {
    localStorage.setItem('authUser', '{not valid json}');
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('useAuth — login', () => {
  it('sets auth and persists to localStorage', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ email: 'u@example.com', role: 'member' }, 'tok-1'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('access_token')).toBe('tok-1');
    expect(JSON.parse(localStorage.getItem('authUser')).email).toBe('u@example.com');
  });

  it('login without token does not set access_token', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ email: 'u@example.com' }));
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('useAuth — logout', () => {
  it('clears auth and localStorage', () => {
    localStorage.setItem('authUser', JSON.stringify({ email: 'u@example.com' }));
    localStorage.setItem('access_token', 'tok-1');
    const { result } = renderHook(() => useAuth());
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('authUser')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('useAuth — isAdmin', () => {
  it('is true for role "admin"', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ role: 'admin' }));
    expect(result.current.isAdmin).toBe(true);
  });

  it('is true for role "Admin" (case-insensitive)', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ role: 'Admin' }));
    expect(result.current.isAdmin).toBe(true);
  });

  it('is false for role "member"', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ role: 'member' }));
    expect(result.current.isAdmin).toBe(false);
  });
});

describe('useAuth — storage event sync', () => {
  it('updates auth when storage event fires', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      localStorage.setItem('authUser', JSON.stringify({ email: 'synced@example.com' }));
      window.dispatchEvent(new Event('storage'));
    });
    expect(result.current.auth?.email).toBe('synced@example.com');
  });

  it('updates auth on auth:change event', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      localStorage.setItem('authUser', JSON.stringify({ email: 'changed@example.com' }));
      window.dispatchEvent(new Event('auth:change'));
    });
    expect(result.current.auth?.email).toBe('changed@example.com');
  });
});

describe('getToken', () => {
  it('returns null when no token in storage', () => {
    expect(getToken()).toBeNull();
  });

  it('returns token when not expired', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJWT({ sub: 'u-1', exp });
    localStorage.setItem('access_token', token);
    expect(getToken()).toBe(token);
  });

  it('returns null and removes token when expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 10; // expired 10s ago
    const token = makeJWT({ sub: 'u-1', exp });
    localStorage.setItem('access_token', token);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('returns null for a malformed token', () => {
    localStorage.setItem('access_token', 'not.a.token');
    // decodeJWT returns null → isExpired(null) → true → removed
    expect(getToken()).toBeNull();
  });
});
