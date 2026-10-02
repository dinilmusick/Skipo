export interface WorkspaceDescriptor {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}
export type SyncState = 'SYNCED' | 'SYNCING' | 'ERROR' | 'OFFLINE';
export type ConflictPolicy = 'primary_wins' | 'backup_wins' | 'newest_wins';

export interface WorkspaceConfig {
  id: string;
  sync: {
    enabled: boolean;
    mode: 'on_write' | 'manual';
    conflictStrategy: ConflictPolicy;
    deletePropagation: boolean;
  };
}
