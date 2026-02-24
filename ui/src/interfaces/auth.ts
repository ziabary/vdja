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

