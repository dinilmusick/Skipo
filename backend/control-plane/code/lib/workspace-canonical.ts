/**
 * ══════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL CANONICAL WORKSPACE NAMING LAW
 * ══════════════════════════════════════════════════════════════════════════════
 * Formula: ultrst_{app_name}_{user_name}_{workspace_name}
 *
 * Client-safe pure functions (zero Node.js fs/os dependencies) so they can be
 * imported safely in React client components and Node.js server routes.
 */

export function sanitizeFolderSegment(val: string): string {
  return (val || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'default';
}

export function formatCanonicalWorkspaceFolderName(
  appName: string = 'docustack',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  const app = sanitizeFolderSegment(appName);
  const user = sanitizeFolderSegment(userName);
  const ws = sanitizeFolderSegment(workspaceName);
  return `ultrst_${app}_${user}_${ws}`;
}

export function formatCanonicalWorkspacePath(
  appName: string = 'docustack',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  return `./${formatCanonicalWorkspaceFolderName(appName, userName, workspaceName)}`;
}
