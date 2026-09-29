/**
 * ══════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL CANONICAL WORKSPACE NAMING LAW (DEPM)
 * ══════════════════════════════════════════════════════════════════════════════
 * Formula: ultrst_{app_name}_{user_name}_{workspace_name}
 *
 * Client-safe pure functions (zero Node.js fs/os dependencies) so they can be
 * imported safely in React client components and Node.js server routes.
 * File size strictly < 200 lines.
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
  appName: string = 'depm',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  const rawWs = (workspaceName || '').trim();
  const app = sanitizeFolderSegment(appName);
  const user = sanitizeFolderSegment(userName);

  // If user already entered the full canonical format (e.g. ultrst_depm_dinil_production),
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
  appName: string = 'depm',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  return `./${formatCanonicalWorkspaceFolderName(appName, userName, workspaceName)}`;
}

export function getSafeCloudFolderName(name: string): string {
  return (name || 'Folder')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Folder';
}

export function sanitizeWorkspaceName(name: string): string {
  return (name || '').replace(/[^a-zA-Z0-9-_\s]/g, '').trim();
}

/**
 * Cleanly extracts or derives a canonical workspace folder prefix.
 * Strips away any local filesystem prefixes (e.g. /tmp/depm_workspace/ or /tmp/depm/)
 * and ensures the result is a clean relative folder prefix like "ultrst_depm_user_vault".
 */
export function extractCanonicalFolderPrefix(
  rawPathOrPrefix?: string | null,
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  if (!rawPathOrPrefix || rawPathOrPrefix.trim() === '') {
    return formatCanonicalWorkspaceFolderName('depm', userName, workspaceName);
  }

  let clean = rawPathOrPrefix.trim().replace(/^["']|["']$/g, '');
  clean = clean.replace(/\\/g, '/'); // normalize Windows backslashes

  // If path contains segments, look for ultrst_ segment or the trailing folder name
  if (clean.includes('/')) {
    const segments = clean.split('/').filter((s) => s.length > 0 && s !== '.');
    const ultrstSegment = segments.find((s) => s.toLowerCase().startsWith('ultrst_'));
    if (ultrstSegment) {
      return sanitizeFolderSegment(ultrstSegment);
    }
    // Filter out common temp folder names
    const nonTempSegments = segments.filter(
      (s) =>
        s !== 'tmp' &&
        s !== 'var' &&
        s !== 'folders' &&
        s !== 'T' &&
        !s.startsWith('depm_workspace') &&
        !s.startsWith('depm_vault')
    );
    if (nonTempSegments.length > 0) {
      const last = nonTempSegments[nonTempSegments.length - 1];
      return formatCanonicalWorkspaceFolderName('depm', userName, last);
    }
    return formatCanonicalWorkspaceFolderName('depm', userName, workspaceName);
  }

  if (clean.toLowerCase().startsWith('ultrst_')) {
    return sanitizeFolderSegment(clean);
  }

  if (
    clean === 'depm_vault' ||
    clean === 'depm_workspace' ||
    clean.startsWith('depm_ws_') ||
    clean.startsWith('/tmp') ||
    clean.startsWith('\\tmp')
  ) {
    return formatCanonicalWorkspaceFolderName('depm', userName, workspaceName);
  }

  return formatCanonicalWorkspaceFolderName('depm', userName, clean);
}