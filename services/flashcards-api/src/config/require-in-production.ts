/**
 * A dev-only fallback makes local setup work with zero .env config, but
 * must never silently apply in production — a fallback value that's
 * committed to source control (or, for WEB_URL, just wrong) provides no
 * real safety if a deployment ever forgets to set the real one. Failing
 * loudly at startup is much safer than an app that boots "successfully"
 * with a secret anyone can read in this repo, or a CORS origin that
 * silently rejects the real frontend.
 */
export function requiredInProduction(value: string | undefined, devDefault: string, envVarName: string): string {
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envVarName} must be set in production — refusing to start with the built-in dev default.`);
  }
  return devDefault;
}
