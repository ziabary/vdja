export interface IntfFileMeta {
  originalname: string;
  mimetype: string;
  path: string;
  size: number
};

export interface IntfTextExtractResult {
  meta: { pageCount: number; title?: string|undefined };
  stripped: boolean;
  text: string;
}

export interface IntfChunkMeta {
  fileKey: string;
  page?: number;
  section?: string;
  time?: number
}

export interface IntfChunk {
  text: string,
  meta: IntfChunkMeta
}