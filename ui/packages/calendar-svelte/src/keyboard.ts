/** Day at the visual start or end of a rendered Jalali week row. */
export function rowBoundary(day:number,offset:number,length:number,key:'Home'|'End'):number {
  const column=(offset+day-1)%7;
  const proposed=key==='Home'?day-column:day+(6-column);
  return Math.max(1,Math.min(length,proposed));
}
export function monthArrow(dir:'rtl'|'ltr',step:'previous'|'next'):'fa-arrow-left'|'fa-arrow-right' {
  return (dir==='rtl')===(step==='previous')?'fa-arrow-right':'fa-arrow-left';
}
