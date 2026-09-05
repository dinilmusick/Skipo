import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getVaultAbsolutePath,
  getActiveVaultName,
  setActiveVaultConfig,
  getActiveStorageConn,
  getActiveFolderPrefix,
  getWorkspaceFileTree,
  ensureWorkspaceExists,
  syncEntireWorkspaceToDiskAndCloud,
  purgeAssetFromPhysicalWorkspace,
} from '@/lib/workspaceFS';
import {
  updateUserProfile,
  findUserById,
  findUserByIdAsync,
  updateUserProfileAsync,
  switchActiveWorkspace,
  switchActiveWorkspaceAsync,
  resolveRequestContextVault,
} from '@/lib/auth-storage';
import { extractCanonicalFolderPrefix } from '@/lib/workspace-canonical';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  deleteCloudWorkspaceFile,
  initializeCloudWorkspaceBucket,
  buildCloudWorkspaceFileTree,
} from '@/lib/cloud-storage-service';

export async function GET(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);

    const requestedFile = req.nextUrl.searchParams.get('file');
    const source = req.nextUrl.searchParams.get('source'); // 'primary' | 'cloud' | 'local'
    const storageConn = getActiveStorageConn();
    const folderPrefix = getActiveFolderPrefix();
    const vaultPath = storageConn && storageConn.provider !== 'local_fs' ? (folderPrefix || 'cloud_vault') : getVaultAbsolutePath();
    const vaultName = getActiveVaultName();

    // 1. Single file content read mode (for Physical Workspace Vault Explorer)
    if (requestedFile) {
      const cleanRel = requestedFile.replace(/^\/+/, '');
      if (storageConn && storageConn.provider !== 'local_fs' && folderPrefix && source !== 'local') {
        try {
          const cloudContent = await readCloudWorkspaceFile(storageConn, folderPrefix, cleanRel);
          if (cloudContent !== null) {
            return NextResponse.json({
              success: true,
              relativePath: cleanRel,
              content: cloudContent,
              source: storageConn.provider,
            });
          }
        } catch (err: any) {
          console.warn('[CloudStorage] Read file error:', err);
        }
      }

      // Local disk fallback
      const localVaultPath = getVaultAbsolutePath();
      const targetPath = path.normalize(path.join(localVaultPath, cleanRel));
      if (targetPath.startsWith(localVaultPath) && fs.existsSync(targetPath) && !fs.statSync(targetPath).isDirectory()) {
        const content = fs.readFileSync(targetPath, 'utf-8');
        return NextResponse.json({
          success: true,
          relativePath: cleanRel,
          content,
          source: 'local_fs',
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'FILE_NOT_FOUND',
          relativePath: cleanRel,
        },
        { status: 404 }
      );
    }

    // 2. Directory tree mode
    // If active storage connection is cloud (e.g. Backblaze B2) and source !== 'local'
    if (storageConn && storageConn.provider !== 'local_fs' && folderPrefix && source !== 'local') {
      try {
        const { tree, stats } = await buildCloudWorkspaceFileTree(storageConn, folderPrefix);
        return NextResponse.json({
          success: true,
          isCloudPrimary: true,
          storageProvider: storageConn.provider,
          bucketName:
            storageConn.b2BucketName ||
            storageConn.r2BucketName ||
            storageConn.s3BucketName ||
            storageConn.supabaseBucketName,
          folderPrefix,
          vaultPath: folderPrefix,
          vaultName,
          stats,
          tree,
        });
      } catch (cloudErr: any) {
        console.warn('[CloudStorage] buildCloudWorkspaceFileTree notice:', cloudErr);
        return NextResponse.json({
          success: true,
          isCloudPrimary: true,
          storageProvider: storageConn.provider,
          bucketName:
            storageConn.b2BucketName ||
            storageConn.r2BucketName ||
            storageConn.s3BucketName ||
            storageConn.supabaseBucketName,
          folderPrefix,
          vaultPath: folderPrefix,
          vaultName,
          stats: { fileCount: 0, folderCount: 0 },
          tree: {
            name: folderPrefix,
            relativePath: folderPrefix,
            absolutePath: folderPrefix,
            isDirectory: true,
            children: [],
          },
          notice: `Cloud bucket active (${storageConn.provider}). ${cloudErr?.message || ''}`,
        });
      }
    }

    // Fallback to local disk tree
    ensureWorkspaceExists();
    const tree = getWorkspaceFileTree();
    let fileCount = 0;
    let folderCount = 0;

    function countItems(node: any) {
      if (node.isDirectory) {
        folderCount++;
        if (node.children) node.children.forEach(countItems);
      } else {
        fileCount++;
      }
    }

    if (tree && tree.children) {
      tree.children.forEach(countItems);
    }

    return NextResponse.json({
      success: true,
      isCloudPrimary: false,
      storageProvider: 'local_fs',
      folderPrefix: folderPrefix || undefined,
      vaultPath,
      vaultName,
      stats: {
        fileCount,
        folderCount,
      },
      tree,
    });
  } catch (err: any) {
    console.error('[Workspace API] GET error:', err);
    const vaultPath = getVaultAbsolutePath();
    return NextResponse.json({
      success: true,
      isCloudPrimary: false,
      storageProvider: 'local_fs',
      vaultPath,
      vaultName: getActiveVaultName(),
      stats: {
        fileCount: 0,
        folderCount: 0,
      },
      tree: {
        name: 'docustack_vault',
        relativePath: 'docustack_vault',
        absolutePath: vaultPath,
        isDirectory: true,
        children: [],
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const body = await req.json();

    // Action to atomically save entire workspace state to local disk and cloud storage
    if (body.action === 'save_all') {
      const { nodes, edges, groups, categories, documents } = body;
      const result = await syncEntireWorkspaceToDiskAndCloud({
        nodes: nodes || [],
        edges: edges || [],
        groups: groups || [],
        categories: categories || [],
        documents: documents || [],
      });
      return NextResponse.json({
        message: 'WORKSPACE_SAVED_TO_ALL_TIERS',
        ...result,
        folderPrefix: result.folderPrefix || '',
        storageProvider: getActiveStorageConn()?.provider || 'local_fs',
        savedAt: Date.now(),
      });
    }

    // 0. Action to verify / preview a workspace folder path
    if (body.action === 'verify') {
      const { workspacePath } = body;
      const targetPath = getVaultAbsolutePath(workspacePath || '');
      const exists = fs.existsSync(targetPath);
      let fileCount = 0;
      let folderCount = 0;

      if (exists) {
        try {
          const items = fs.readdirSync(targetPath, { withFileTypes: true });
          for (const item of items) {
            if (item.name === '.docustack') continue;
            if (item.isDirectory()) folderCount++;
            else fileCount++;
          }
        } catch (e) {
          // ignore permission error during probe
        }
      }

      return NextResponse.json({
        success: true,
        resolvedPath: targetPath,
        exists,
        fileCount,
        folderCount,
      });
    }

    // 1. Action to configure / switch workspace folder & name
    if (body.action === 'configure') {
      const { workspacePath, workspaceName, userId, workspaceId, storageConnectionId, storageProvider } = body;
      if (!workspacePath) {
        return NextResponse.json({ success: false, error: 'MISSING_WORKSPACE_PATH' }, { status: 400 });
      }

      const cleanName = (workspaceName || 'DocuStack Vault').trim();
      let storageConn: any = null;
      let user: any = null;

      if (userId) {
        user = (await findUserByIdAsync(userId)) || findUserById(userId);
        if (user) {
          const userConns: any[] =
            user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
          const targetWs = (user.workspaces || []).find((w: any) => w.id === workspaceId || w.workspacePath === workspacePath);
          const effectiveConnId = storageConnectionId || targetWs?.storageConnectionId;

          if (effectiveConnId) {
            storageConn = userConns.find((c: any) => c.id === effectiveConnId) || null;
          }
          if (!storageConn) {
            const primaryConn =
              userConns.find((c: any) => c.role === 'primary' || c.isPrimary) ||
              userConns.find((c: any) => c.provider !== 'local_fs') ||
              userConns[0] ||
              null;
            storageConn = primaryConn;
          }

          const targetWsId = workspaceId || targetWs?.id;
          if (targetWsId) {
            try {
              await switchActiveWorkspaceAsync(userId, targetWsId);
            } catch (swErr) {
              console.warn('[Workspace Route] switchActiveWorkspace warning:', swErr);
            }
          }
        }
      }

      const folderPrefix = extractCanonicalFolderPrefix(
        workspacePath,
        user?.username || user?.name || 'user',
        cleanName
      );
      const cleanWsPath = storageConn && storageConn.provider !== 'local_fs' ? `./${folderPrefix}` : workspacePath;

      setActiveVaultConfig(cleanWsPath, cleanName, storageConn, folderPrefix);
      if (!storageConn || storageConn.provider === 'local_fs') {
        ensureWorkspaceExists(cleanWsPath);
      }

      if (storageConn && storageConn.provider !== 'local_fs') {
        try {
          const existingGraph = await readCloudWorkspaceFile(storageConn, folderPrefix, '.docustack/graph.json');
          if (!existingGraph) {
            await initializeCloudWorkspaceBucket(storageConn, folderPrefix, cleanName, user?.name || user?.username || 'User');
          }
        } catch (cloudErr) {
          console.warn('[CloudStorage] Failed to initialize cloud storage bucket on configure:', cloudErr);
        }
      }

      if (userId) {
        try {
          await updateUserProfileAsync(userId, {
            workspacePath: cleanWsPath,
            workspaceName: cleanName,
          });
        } catch (e) {
          console.warn('Could not update user profile with workspace config:', e);
        }
      }

      const activePath = storageConn && storageConn.provider !== 'local_fs' ? folderPrefix : getVaultAbsolutePath(cleanWsPath);
      return NextResponse.json({
        success: true,
        message: 'WORKSPACE_FOLDER_CONFIGURED',
        vaultPath: activePath,
        vaultName: cleanName,
        storageProvider: storageConn?.provider || 'local_fs',
      });
    }

    // 2. Action to write file
    const storageConn = getActiveStorageConn();
    const folderPrefix = getActiveFolderPrefix();
    const { relativePath, content } = body;

    if (!relativePath) {
      return NextResponse.json({ success: false, error: 'MISSING_RELATIVE_PATH' }, { status: 400 });
    }

    // Sync file to Cloud Storage if active
    if (storageConn && storageConn.provider !== 'local_fs' && folderPrefix) {
      try {
        await writeCloudWorkspaceFile(
          storageConn,
          folderPrefix,
          relativePath,
          content || '',
          relativePath.endsWith('.md') ? 'text/markdown' : 'text/plain'
        );
      } catch (err) {
        console.warn('[CloudStorage] file write error:', err);
      }
    }

    if (!storageConn || storageConn.provider === 'local_fs') {
      ensureWorkspaceExists();
      const vaultPath = getVaultAbsolutePath();

      // Sanitize path to prevent directory traversal outside vault
      const targetPath = path.normalize(path.join(vaultPath, relativePath));
      if (!targetPath.startsWith(vaultPath)) {
        return NextResponse.json({ success: false, error: 'INVALID_PATH_OUTSIDE_VAULT' }, { status: 403 });
      }

      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, content || '', 'utf-8');
      const stat = fs.statSync(targetPath);

      return NextResponse.json({
        success: true,
        path: targetPath,
        relativePath,
        sizeBytes: stat.size,
        message: 'FILE WRITTEN TO PHYSICAL WORKSPACE VAULT',
      });
    }

    return NextResponse.json({
      success: true,
      path: `./${folderPrefix}/${relativePath}`,
      relativePath,
      sizeBytes: Buffer.byteLength(content || '', 'utf-8'),
      message: 'FILE WRITTEN TO PRIMARY CLOUD WORKSPACE VAULT',
      storageProvider: storageConn.provider,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}


export async function DELETE(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);

    let relativePath = req.nextUrl.searchParams.get('relativePath');
    if (!relativePath) {
      try {
        const body = await req.json();
        relativePath = body?.relativePath;
      } catch {}
    }

    if (!relativePath) {
      return NextResponse.json({ success: false, error: 'MISSING_RELATIVE_PATH' }, { status: 400 });
    }

    const purgeResult = await purgeAssetFromPhysicalWorkspace(relativePath);
    if (!purgeResult.success) {
      return NextResponse.json({ success: false, error: purgeResult.message }, { status: 400 });
    }

    return NextResponse.json(purgeResult);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
