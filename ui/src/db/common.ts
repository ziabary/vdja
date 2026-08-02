export function resolveCols<
  TPublic extends Record<string, string>,
  TAll extends Record<string, string>
>(
  outCols: readonly (keyof TPublic)[] | undefined,
  isAdmin: boolean | undefined,
  publicCols: TPublic,
  allCols: TAll
): (keyof TAll)[] {
  const raw = outCols
    ? outCols
    : isAdmin
      ? Object.keys(allCols)
      : Object.keys(publicCols);

  return raw.filter((k) => {
    return typeof k === 'string' && !(k.startsWith('$') && k.endsWith('$$'))
}) as (keyof TAll)[];
}

export interface IntfGenericListOptions<TCols extends Record<string, string>> {
  outCols?: readonly (keyof TCols)[]; 
  limit?: number;
  offset?: number;
  filters?: Partial<Record<keyof TCols, unknown>>; 
}