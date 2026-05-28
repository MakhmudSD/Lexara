import { describe, it, expect } from 'vitest';
import { ORG_SLUG, assertOrgSlug } from '../api/config.js';

describe('ORG_SLUG', () => {
  it('is null when VITE_ORG_SLUG is not set', () => {
    // In the test environment import.meta.env.VITE_ORG_SLUG is undefined
    expect(ORG_SLUG).toBeNull();
  });
});

describe('assertOrgSlug', () => {
  it('throws a descriptive error when ORG_SLUG is null', () => {
    expect(() => assertOrgSlug()).toThrow('VITE_ORG_SLUG is not set');
  });
});
