<script lang="ts" generics="TRow extends Record<string, unknown>">
  import {useLocale} from '../i18n/index.js';
  const i18n=useLocale();
  import type { intfCursorPage,intfCountResult } from '@targoman/contracts';
  import type { intfTableColumn } from './model.js';
  interface intfAction {readonly label:string;readonly iconClass:string;readonly onClick:(row:TRow)=>void}
  interface intfProps {page:intfCursorPage<TRow>;columns:readonly intfTableColumn<TRow>[];count?:intfCountResult;onMore?:()=>void;caption:string;loading?:boolean;actions?:readonly intfAction[]}
  let {page,columns,count,onMore,caption,loading=false,actions=[]}:intfProps=$props();
</script>
<div class="table-responsive"><table class="table table-striped" aria-busy={loading}><caption>{caption}{#if count} — {count.count}{/if}</caption><thead><tr>{#each columns as column (column.id)}<th scope="col">{column.header}</th>{/each}{#if actions.length}<th scope="col">{i18n.t('actions')}</th>{/if}</tr></thead><tbody>{#if loading}<tr><td colspan={columns.length+(actions.length?1:0)}><span role="status">{i18n.t('loading')}</span></td></tr>{:else}{#each page.items as row,index (index)}<tr>{#each columns as column (column.id)}<td class:fa-num={column.presentation==='fa-num'} class:ltr={column.presentation==='ltr'} class:rtl={column.presentation==='rtl'}>{column.value(row)}</td>{/each}{#if actions.length}<td>{#each actions as action (action.label)}<button type="button" class="btn btn-sm btn-outline-secondary me-1" aria-label={action.label} onclick={()=>action.onClick(row)}><i class={`fa-solid ${action.iconClass}`} aria-hidden="true"></i></button>{/each}</td>{/if}</tr>{:else}<tr><td colspan={columns.length+(actions.length?1:0)}>{i18n.t('noItems')}</td></tr>{/each}{/if}</tbody></table></div>
{#if page.hasMore&&onMore}<button type="button" class="btn btn-outline-primary" disabled={loading} onclick={onMore}>{i18n.t('more')}</button>{/if}
