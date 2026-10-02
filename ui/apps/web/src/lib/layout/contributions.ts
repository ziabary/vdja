import type { typModuleUiContribution,typModuleId,typUiSurface } from '@targoman/contracts';
export interface intfContributionProjection {readonly enabledModules:readonly typModuleId[];readonly visibleContributionIds:readonly string[]}
export function composeContributions(items:readonly typModuleUiContribution[],surface:typUiSurface,projection:intfContributionProjection):readonly typModuleUiContribution[] {
  const ids=new Set<string>();
  for(const item of items){if(ids.has(item.id))throw new Error(`Duplicate contribution ${item.id}`);ids.add(item.id);}
  return items.filter(item=>projection.enabledModules.includes(item.moduleId)&&projection.visibleContributionIds.includes(item.id)&&(!('surface' in item)||item.surface===surface)).sort((a,b)=>a.order-b.order);
}
