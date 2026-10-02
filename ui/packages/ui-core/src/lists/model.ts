import { createTable,getCoreRowModel,type ColumnDef } from '@tanstack/table-core';
import type { intfCursorPage,intfCountResult } from '@targoman/contracts';
export interface intfTableColumn<TRow> { readonly id:string;readonly header:string;readonly value:(row:TRow)=>string;readonly presentation?:'fa-num'|'ltr'|'rtl' }
export interface intfTableView<TRow> { readonly rows:readonly TRow[];readonly hasMore:boolean;readonly nextCursor:string|null;readonly count?:intfCountResult }
export function createCursorTable<TRow>(page:intfCursorPage<TRow>,columns:readonly intfTableColumn<TRow>[],count?:intfCountResult):intfTableView<TRow> {
  const defs:ColumnDef<TRow,string>[] = columns.map(column=>({id:column.id,header:column.header,accessorFn:column.value}));
  const table=createTable({data:[...page.items],columns:defs,getCoreRowModel:getCoreRowModel(),state:{},onStateChange:()=>undefined,renderFallbackValue:''});
  return {rows:table.getRowModel().rows.map(row=>row.original),hasMore:page.hasMore,nextCursor:page.nextCursor,count};
}
