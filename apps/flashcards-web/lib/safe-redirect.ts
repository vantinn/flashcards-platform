/**
 * The `from` query param on /login and /register is attacker-controllable
 * — anyone can send a victim a link like `/login?from=https://evil.com` (or
 * the protocol-relative `//evil.com`, which browsers also treat as
 * absolute). Following it as-is after a successful login/register would be
 * an open redirect: the URL bar shows this app's real domain right up
 * until the post-auth hop, then lands the now-authenticated user on
 * whatever page an attacker chose. Only a same-origin relative path
 * (starts with exactly one `/`) is ever safe to follow.
 */
export function safeRedirectPath(target: string | null | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}
