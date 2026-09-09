import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolvePath(inputPath?: string): string {
  if (!inputPath || inputPath.trim() === '') {
    return os.homedir();
  }
  let clean = inputPath.trim();
  if (clean.startsWith('~')) {
    clean = path.join(os.homedir(), clean.slice(1));
  }
  return path.isAbsolute(clean) ? path.normalize(clean) : path.resolve(process.cwd(), clean);
}

function formatDisplayPath(absPath: string): string {
  const home = os.homedir();
  if (absPath === home) return '~';
  if (absPath.startsWith(home)) {
    return '~' + absPath.slice(home.length);
  }
  return absPath;
}

export const GET = createSecureRoute({
  id: 'api-workspace-browse-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { query }) => {
    const rawDir = query.get('dir');
    const targetDir = resolvePath(rawDir || undefined);

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({
        success: false,
        error: `Directory not found: ${targetDir}`,
        currentPath: targetDir,
        displayPath: formatDisplayPath(targetDir),
        folders: [],
      }, { status: 404 });
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      return NextResponse.json({
        success: false,
        error: `Path is not a directory: ${targetDir}`,
      }, { status: 400 });
    }

    let canWrite = false;
    try {
      fs.accessSync(targetDir, fs.constants.W_OK);
      canWrite = true;
    } catch {
      canWrite = false;
    }

    const parentDir = path.dirname(targetDir);
    const hasParent = parentDir !== targetDir;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(targetDir, { withFileTypes: true });
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: `Permission denied reading directory: ${e.message}`,
        currentPath: targetDir,
        displayPath: formatDisplayPath(targetDir),
        folders: [],
        canWrite,
      });
    }

    const folders: Array<{
      name: string;
      path: string;
      displayPath: string;
      itemCount?: number;
      modifiedAt?: string;
    }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.docustack') continue;
      if (entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') continue;

      if (entry.isDirectory()) {
        const fullSubPath = path.join(targetDir, entry.name);
        let itemCount = 0;
        let modifiedAt: string | undefined;

        try {
          const subStat = fs.statSync(fullSubPath);
          modifiedAt = subStat.mtime.toISOString().split('T')[0];
          const subEntries = fs.readdirSync(fullSubPath);
          itemCount = subEntries.length;
        } catch {
          // unreadable subfolder
        }

        folders.push({
          name: entry.name,
          path: fullSubPath,
          displayPath: formatDisplayPath(fullSubPath),
          itemCount,
          modifiedAt,
        });
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const homeDir = os.homedir();
    const presets = [
      { name: 'Default App Vault', path: path.join(process.cwd(), 'docustack_vault'), display: './docustack_vault' },
      { name: 'User Documents', path: path.join(homeDir, 'Documents', 'DocuStack'), display: '~/Documents/DocuStack' },
      { name: 'Desktop', path: path.join(homeDir, 'Desktop', 'DocuStack'), display: '~/Desktop/DocuStack' },
      { name: 'Home Folder', path: homeDir, display: '~' },
    ];

    return NextResponse.json({
      success: true,
      currentPath: targetDir,
      displayPath: formatDisplayPath(targetDir),
      parentPath: hasParent ? parentDir : null,
      parentDisplayPath: hasParent ? formatDisplayPath(parentDir) : null,
      canWrite,
      folders,
      presets,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-workspace-browse-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 16 * 1024 },
  handler: async (req, { body }) => {
    const { parentPath, folderName } = body || {};

    if (!parentPath || !folderName) {
      return NextResponse.json({ success: false, error: 'parentPath and folderName are required' }, { status: 400 });
    }

    const safeName = folderName.trim().replace(/[/\\?%*:|"<>]/g, '_');
    const resolvedParent = resolvePath(parentPath);
    const newFolderPath = path.join(resolvedParent, safeName);

    if (fs.existsSync(newFolderPath)) {
      return NextResponse.json({
        success: true,
        createdPath: newFolderPath,
        displayPath: formatDisplayPath(newFolderPath),
        message: 'Folder already exists',
      });
    }

    fs.mkdirSync(newFolderPath, { recursive: true });

    return NextResponse.json({
      success: true,
      createdPath: newFolderPath,
      displayPath: formatDisplayPath(newFolderPath),
      message: 'Folder successfully created',
    });
  },
});
