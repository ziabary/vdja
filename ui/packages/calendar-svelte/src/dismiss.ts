/** Event paths remain stable when a picker replaces the clicked button during dispatch. */
export function isOutsideCalendarClick(event:MouseEvent,popup:Element|null|undefined,trigger:Element|null|undefined):boolean {
  const path=event.composedPath();
  return (!popup||!path.includes(popup))&&(!trigger||!path.includes(trigger));
}
