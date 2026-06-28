import type { Diagnostic } from './canonical.js';

/** Relatorio final (agregado por chunk — nunca em memoria total). */
export interface MigrationReport {
  jobId: string;
  connectorId: string;
  totals: {
    posts: number;
    pages: number;
    images: number;
    redirects: number;
  };
  durationMs: number;
  errors: number;
  warnings: number;
  seoPreserved: number;
  enriched: number;
  ignored: number;
  duplicated: number;
  diagnostics: Diagnostic[];
}

export function emptyReport(jobId: string, connectorId: string): MigrationReport {
  return {
    jobId,
    connectorId,
    totals: { posts: 0, pages: 0, images: 0, redirects: 0 },
    durationMs: 0,
    errors: 0,
    warnings: 0,
    seoPreserved: 0,
    enriched: 0,
    ignored: 0,
    duplicated: 0,
    diagnostics: [],
  };
}
