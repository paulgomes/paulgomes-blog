/** Tipos de midia compartilhados entre conector, ports e pipeline. */

export interface MediaBlob {
  bytes: Uint8Array;
  mime: string;
  /** nome/extensao original, para preservar extensao no destino. */
  filename?: string;
}

export interface MediaLocation {
  key: string;
  url: string;
  bytes: number;
  mime?: string;
}

/** Referencia leve a um item de midia ainda nao baixado. */
export interface MediaRefSource {
  sourceUrl: string;
  alt?: string;
  caption?: string;
}
