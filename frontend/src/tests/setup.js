import '@testing-library/jest-dom';

// localStorage stub
const store = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  },
  writable: true,
});

beforeEach(() => localStorage.clear());
