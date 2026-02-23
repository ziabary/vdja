import type { Request } from "express";

interface IntfServiceAccess {
  forbidden?: boolean
  files?: {
    maxCount?: number;
    maxSize?: number;
    maxTotalSize?: number;
  }
  messages?: {
    maxChars?: number
  }
}

export interface IntfPrivileges {
  services: {[service:string]: IntfServiceAccess}
}

export interface IntfApiRequest extends Request {
  headers: {
    authorization?: string;
    [key: string]: unknown;
  };
}

export interface IntfAuth {
  uid: number;
  key: string;
  name: string;
  privs: IntfPrivileges | null;
}

export interface IntfRefreshTokenPayload {
  key: string;
  type: "refresh";
}

