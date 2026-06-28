/** Estado de job/checkpoint — compartilhado entre driver CLI e driver Worker (via D1). */
import type { ConnectorId } from './connector.js';
import type { SyncCursor } from './connector.js';

export type JobMode = 'import' | 'sync' | 'export';
export type JobStatus = 'pending' | 'running' | 'paused' | 'failed' | 'completed';

export interface JobTotals {
  posts: number;
  media: number;
  done: number;
  errors: number;
  warnings: number;
}

export interface MigrationJob {
  id: string;
  connectorId: ConnectorId;
  mode: JobMode;
  status: JobStatus;
  totals: JobTotals;
  cursor: SyncCursor | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export type StageName =
  | 'connect'
  | 'validate'
  | 'read'
  | 'map-authors'
  | 'map-categories'
  | 'map-tags'
  | 'download-images'
  | 'transform-image'
  | 'store-r2'
  | 'convert'
  | 'preview'
  | 'validate-final'
  | 'report'
  | 'import';

export interface Checkpoint {
  jobId: string;
  stage: StageName;
  chunkIndex: number;
  lastSourceId: string;
  state: unknown;
  createdAt: number;
}

/** Mensagem leve de fila (<=128KB): so ponteiros, estado real vive em D1/R2. */
export interface ChunkMessage {
  jobId: string;
  stage: StageName;
  chunkIndex: number;
  fromSourceId: string | null;
  toSourceId: string | null;
}
