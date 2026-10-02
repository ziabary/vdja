export interface intfPopoverPosition {readonly left:number;readonly top:number}
/** Keep a calendar attached to its trigger and inside the visible viewport. */
export function placeCalendar(anchor:Pick<DOMRect,'left'|'right'|'top'|'bottom'>,width:number,height:number,viewportWidth:number,viewportHeight:number,dir:'rtl'|'ltr'):intfPopoverPosition {
  const gap=8,edge=8;
  const preferredLeft=dir==='rtl'?anchor.right-width:anchor.left;
  const left=Math.max(edge,Math.min(preferredLeft,viewportWidth-width-edge));
  const below=anchor.bottom+gap;
  const above=anchor.top-height-gap;
  const preferredTop=below+height<=viewportHeight-edge?below:above>=edge?above:below;
  const top=Math.max(edge,Math.min(preferredTop,viewportHeight-height-edge));
  return {left,top};
}
