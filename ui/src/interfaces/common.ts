export interface IntfFileMeta {
  originalname: string;
  mimetype: string;
  path: string;
  size: number
};

export enum enuRoles {
  system = "system",
  user = "user",
  assistant = "assistant"
}
export interface IntfLLMMessage {
  role: enuRoles
  content: string
}