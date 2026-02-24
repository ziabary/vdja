export enum enuRoles {
  system = "system",
  user = "user",
  assistant = "assistant"
}

export interface IntfLLMMessage {
  role: enuRoles
  content: string
}

export interface IntfChunkPayload {
  text:string;
  col_Key: string;
  file_id: string;
  file_name: string;
  chunk_time: number | undefined;
  chunk_index: number;

  [key: string]: unknown;
}