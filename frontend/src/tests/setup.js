import '@testing-library/jest-dom';

// matchMedia stub (jsdom doesn't implement it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// GSAP stub — no-op all animations in tests
vi.mock('gsap', () => ({
  gsap: {
    to: () => {},
    from: () => {},
    fromTo: () => {},
    set: () => {},
    context: () => ({ revert: () => {}, add: (fn) => fn?.() }),
    registerPlugin: () => {},
  },
}));
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: () => ({ kill: () => {} }),
    refresh: () => {},
  },
}));

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
