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
  file_id: string;
  file_name: string;
  title: string | undefined,
  chunk_time: number | undefined;
  chunk_index: number;
  entities: string[]


  [key: string]: unknown;
}