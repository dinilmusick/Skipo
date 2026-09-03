// ══════════════════════════════════════════════════════════════════════════════════════════
// USER WORKSPACE FILE STORAGE COORDINATOR (PURE POSIX FILE SYSTEM PERSISTENCE)
// ══════════════════════════════════════════════════════════════════════════════════════════

import path from 'path';
import fs from 'fs';
import { WorkspaceVirtualFileSystemRuntime } from './WorkspaceVirtualFileSystemRuntime';
import { WorkspaceDataPlaneConfig } from './control-plane-types';
import { LocalFileSystemWorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { DocCategory, DocumentItem, GraphNode, GraphEdge, GraphGroup, CustomThemeConfig, BiomeType } from './types';

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: UserWorkspaceFileStorageCoordinator
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Coordinates all high-level file storage operations for user workspaces. All documents,
 * categories, graph nodes, media metadata, and workspace settings are saved strictly
 * as structured JSON/Markdown/Binary files inside the designated filesystem directory:
 *
 * Directory Layout:
 *   docustack_vault/
 *     ├── .docustack/
 *     │     ├── workspace_manifest.json
 *     │     ├── categories.json
 *     │     ├── graph_topology.json
 *     │     ├── storage_config.json
 *     │     └── media_index.json
 *     ├── inbox/
 *     ├── active/
 *     ├── vault/
 *     ├── archive/
 *     ├── engineering/
 *     └── media/
 *           └── [userId]/
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export interface WorkspaceFileManifest {
  workspaceId: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  theme: 'dark' | 'light';
  biome: BiomeType;
  primaryStorageProvider: string;
  activeProfile: string;
}

export class UserWorkspaceFileStorageCoordinator {
  private static instance: UserWorkspaceFileStorageCoordinator | null = null;
  private runtime: WorkspaceVirtualFileSystemRuntime;
  private vaultRoot: string;

  private constructor(vaultRoot?: string) {
    this.vaultRoot = vaultRoot || path.join(process.cwd(), 'docustack_vault');
    this.ensureBaseLayout();

    const defaultConfig: WorkspaceDataPlaneConfig = {
      workspaceId: 'default_vault',
      primaryStorage: {
        id: 'ep_local_disk',
        type: 'local',
        path: this.vaultRoot,
        label: 'Local File System Vault',
        isPrimary: true,
      },
      backupStorage: [
        {
          id: 'ep_cloud_b2',
          type: 'backblaze_b2',
          label: 'Backblaze B2 Workspace Replica',
          isPrimary: false,
        },
        {
          id: 'ep_cloud_supabase',
          type: 'supabase_storage',
          label: 'Supabase Storage Replica',
          isPrimary: false,
        },
      ],
      conflictResolution: 'primary_wins',
      enableSyncLogs: true,
    };

    this.runtime = new WorkspaceVirtualFileSystemRuntime(defaultConfig);
  }

  public static getInstance(): UserWorkspaceFileStorageCoordinator {
    if (!UserWorkspaceFileStorageCoordinator.instance) {
      UserWorkspaceFileStorageCoordinator.instance = new UserWorkspaceFileStorageCoordinator();
    }
    return UserWorkspaceFileStorageCoordinator.instance;
  }

  public getRuntime(): WorkspaceVirtualFileSystemRuntime {
    return this.runtime;
  }

  public getVaultRoot(): string {
    return this.vaultRoot;
  }

  private ensureBaseLayout(): void {
    const folders = [
      '',
      '.docustack',
      'media',
    ];

    for (const folder of folders) {
      const full = path.join(this.vaultRoot, folder);
      if (!fs.existsSync(full)) {
        try {
          fs.mkdirSync(full, { recursive: true });
        } catch {
          // Bypassed on read-only environments
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // CATEGORIES / STACKS FILE OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════════════════════

  public async loadCategories(): Promise<DocCategory[]> {
    try {
      const exists = await this.runtime.fs.exists('.docustack/categories.json');
      if (exists) {
        const raw = await this.runtime.fs.readText('.docustack/categories.json');
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  public async saveCategories(categories: DocCategory[]): Promise<void> {
    await this.runtime.fs.write('.docustack/categories.json', JSON.stringify(categories, null, 2));
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // DOCUMENTS FILE OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════════════════════

  public async loadDocuments(): Promise<DocumentItem[]> {
    try {
      const exists = await this.runtime.fs.exists('.docustack/documents_index.json');
      if (exists) {
        const raw = await this.runtime.fs.readText('.docustack/documents_index.json');
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  public async saveDocuments(documents: DocumentItem[]): Promise<void> {
    await this.runtime.fs.write('.docustack/documents_index.json', JSON.stringify(documents, null, 2));
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // GRAPH TOPOLOGY FILE OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════════════════════

  public async loadGraphData(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; groups: GraphGroup[] }> {
    try {
      const exists = await this.runtime.fs.exists('.docustack/graph_topology.json');
      if (exists) {
        const raw = await this.runtime.fs.readText('.docustack/graph_topology.json');
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return { nodes: [], edges: [], groups: [] };
  }

  public async saveGraphData(data: { nodes: GraphNode[]; edges: GraphEdge[]; groups: GraphGroup[] }): Promise<void> {
    await this.runtime.fs.write('.docustack/graph_topology.json', JSON.stringify(data, null, 2));
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // DIRECTORY SCANNING & RECURSIVE FILE DISCOVERY
  // ══════════════════════════════════════════════════════════════════════════════════════════

  public async scanVaultFileTree(): Promise<any> {
    const rootNode = {
      name: 'docustack_vault',
      relativePath: '',
      absolutePath: this.vaultRoot,
      isDirectory: true,
      children: [] as any[],
    };

    const buildTree = (dirPath: string, rel: string, parentNode: any) => {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const subFull = path.join(dirPath, entry.name);
        const subRel = rel ? `${rel}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const dirNode = {
            name: entry.name,
            relativePath: subRel,
            absolutePath: subFull,
            isDirectory: true,
            children: [] as any[],
          };
          parentNode.children.push(dirNode);
          buildTree(subFull, subRel, dirNode);
        } else {
          const stat = fs.statSync(subFull);
          const sizeKb = (stat.size / 1024).toFixed(1);
          parentNode.children.push({
            name: entry.name,
            relativePath: subRel,
            absolutePath: subFull,
            isDirectory: false,
            sizeBytes: stat.size,
            sizeFormatted: stat.size > 1024 * 1024 ? `${(stat.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
    };

    buildTree(this.vaultRoot, '', rootNode);
    return rootNode;
  }
}
