/**
 * Returns true if `name` looks like a machine/system username rather than a
 * human display name (e.g. "john_doe123", "jdoe", "user_42").
 * Used to suppress greeting by first name when the name is clearly not human-readable.
 */
export function isUsernamePattern(name) {
  return Boolean(
    name &&
    /^[a-z0-9_]+$/i.test(name) &&
    !/\s/.test(name) &&
    (name.includes('_') || name === name.toLowerCase() || /\d/.test(name))
  );
}
