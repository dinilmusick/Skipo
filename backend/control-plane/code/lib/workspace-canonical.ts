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
  const rawWs = (workspaceName || '').trim();
  const app = sanitizeFolderSegment(appName);
  const user = sanitizeFolderSegment(userName);

  // If user already entered the full canonical format (e.g. ultrst_docustack_dinil_test_workspace),
  // or any ultrst_ prefix, preserve it without double-prefixing
  if (rawWs.toLowerCase().startsWith('ultrst_')) {
    return sanitizeFolderSegment(rawWs);
  }

  let ws = sanitizeFolderSegment(rawWs);
  // Simplify redundant app_vault or app_workspace patterns
  if (ws === `${app}_vault` || ws === `${app}_workspace`) {
    ws = ws.replace(`${app}_`, '');
  }

  return `ultrst_${app}_${user}_${ws}`;
}

export function formatCanonicalWorkspacePath(
  appName: string = 'docustack',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  return `./${formatCanonicalWorkspaceFolderName(appName, userName, workspaceName)}`;
}
