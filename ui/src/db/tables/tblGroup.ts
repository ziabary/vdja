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

export const ANONYMOUS_GROUP_ID = 2
export const DEFAULT_GROUP_ID = 2
export const VERIFIED_GROUP_ID = 3
export const WIDGET_GROUP_ID = 4
/* =======================
   Export
======================= */

export default {
  cols,
  tblName
};

