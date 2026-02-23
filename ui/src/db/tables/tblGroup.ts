import type { IntfPrivileges } from "../../interfaces/auth";


const cols = { 
  id: 'grpID',
  name: 'grpName', 
  privs: 'grpPrivs',
  status: 'grpStatus',
} as const

const tblName = 'tblGroup' as const;


interface Group {
  id: number;
  name: string; 
  privs: IntfPrivileges;
}

export const DEFAULT_GROUP: Group = {
  id: 2,
  name: 'public',
  privs: {
    services: {
      rag: {
        files: {
          maxCount: 10,
          maxSize: 10,
          maxTotalSize: 200,
        },
        messages:{
          maxChars: 2000
        }
      },
      think: { forbidden: true }
    }
  },
};

/* =======================
   Export
======================= */

export default {
  cols,
  tblName
};

