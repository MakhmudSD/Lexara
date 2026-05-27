/**
 * Organisation slug — the tenant identifier for this deployment.
 *
 * In the single-tenant MVP this comes from the Vite build-time env var.
 * In Phase 3 (multi-tenant auth) this will come from the JWT claim instead,
 * and this file becomes a thin wrapper around the auth context.
 *
 * Operators set this once per deployment:
 *   Vercel dashboard → Environment Variables → VITE_ORG_SLUG=dev-org-<id>
 *   (value printed by `python scripts/seed_dev.py` as ORG_SLUG)
 */
export const ORG_SLUG = import.meta.env.VITE_ORG_SLUG || null;

export const assertOrgSlug = () => {
  if (!ORG_SLUG) {
    throw new Error(
      'VITE_ORG_SLUG is not set. '
      + 'Run seed_dev.py and set the printed ORG_SLUG as VITE_ORG_SLUG '
      + 'in your .env (local) or Vercel environment variables (production).',
    );
  }
  return ORG_SLUG;
};
