export type MutationEntityType =
  | 'node'
  | 'edge'
  | 'group'
  | 'category'
  | 'document'
  | 'workspace';

export type MutationOperation =
  | 'create'
  | 'update'
  | 'move'
  | 'delete';

export interface WorkspaceMutation<T = any> {
  mutationId: string;
  entity: MutationEntityType;
  entityId: string;
  operation: MutationOperation;
  patch: Partial<T>;
  baseRevision: number;
  clientTimestamp: number;
}

export interface MutationBatch {
  workspaceId: string;
  baseRevision: number;
  mutations: WorkspaceMutation[];
  clientTimestamp: number;
}

export interface MutationResult {
  success: boolean;
  newRevision: number;
  appliedMutationIds: string[];
  affectedEntities: {
    entity: MutationEntityType;
    entityId: string;
    operation: MutationOperation;
  }[];
  conflict?: {
    currentRevision: number;
    message: string;
  };
}
