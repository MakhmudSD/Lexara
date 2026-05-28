import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../i18n/useTranslation.js';

beforeEach(() => localStorage.clear());

describe('useTranslation — initial language', () => {
  it('defaults to English when nothing stored', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.lang).toBe('en');
  });

  it('restores stored language', () => {
    localStorage.setItem('lexara_lang', 'ko');
    const { result } = renderHook(() => useTranslation());
    expect(result.current.lang).toBe('ko');
  });

  it('falls back to "en" for unsupported stored value', () => {
    localStorage.setItem('lexara_lang', 'zz');
    const { result } = renderHook(() => useTranslation());
    expect(result.current.lang).toBe('en');
  });
});

describe('useTranslation — t()', () => {
  it('returns English translation for known key', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('app_name')).toBe('Lexara');
  });

  it('returns key itself for unknown key', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('totally_unknown_key_xyz')).toBe('totally_unknown_key_xyz');
  });

  it('falls back to English when current lang is missing key', () => {
    localStorage.setItem('lexara_lang', 'ko');
    const { result } = renderHook(() => useTranslation());
    // app_name exists in English — should come through even in Korean
    expect(result.current.t('app_name')).toBeTruthy();
  });
});

describe('useTranslation — setLang', () => {
  it('switches language and persists to localStorage', () => {
    const { result } = renderHook(() => useTranslation());
    act(() => result.current.setLang('ru'));
    expect(result.current.lang).toBe('ru');
    expect(localStorage.getItem('lexara_lang')).toBe('ru');
  });

  it('falls back to "en" for unsupported language code', () => {
    const { result } = renderHook(() => useTranslation());
    act(() => result.current.setLang('xx'));
    expect(result.current.lang).toBe('en');
  });

  it('dispatches app:lang-change event', () => {
    const handler = vi.fn();
    window.addEventListener('app:lang-change', handler);
    const { result } = renderHook(() => useTranslation());
    act(() => result.current.setLang('ja'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('app:lang-change', handler);
  });
});

describe('useTranslation — languageOptions', () => {
  it('returns an array with at least 5 entries', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.languageOptions.length).toBeGreaterThanOrEqual(5);
  });

  it('currentLanguage matches active lang code', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.currentLanguage.code).toBe('en');
  });
});

describe('useTranslation — storage event sync', () => {
  it('syncs language when storage event fires', () => {
    const { result } = renderHook(() => useTranslation());
    act(() => {
      localStorage.setItem('lexara_lang', 'uz');
      window.dispatchEvent(new Event('storage'));
    });
    expect(result.current.lang).toBe('uz');
  });
});
