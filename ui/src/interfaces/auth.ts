interface IntfServiceAccess {
  forbidden?: boolean
  files?: {
    maxCount?: number;
    maxSize?: number;
    maxTotalSize?: number;
    onQuota?: string
  }
  messages?: {
    maxChars?: number
    maxCount?: number
    onQuota?: string
  }
}

export interface IntfPrivileges {
  services: {[service:string]: IntfServiceAccess},
  isAdmin?: boolean
  isVerified?: boolean
  manageShares?: boolean
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

