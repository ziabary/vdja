const locks=new WeakMap<Document,{count:number;previous:string}>();

/** Shared reference count keeps scroll locked while nested native dialogs remain open. */
export function lockDocumentScroll(owner:Document):()=>void {
  let state=locks.get(owner);
  if(!state){state={count:0,previous:owner.documentElement.style.overflow};locks.set(owner,state);}
  state.count++;
  owner.documentElement.style.overflow='hidden';
  let released=false;
  return ()=>{
    if(released)return;released=true;
    const current=locks.get(owner);if(!current)return;
    current.count--;
    if(current.count===0){owner.documentElement.style.overflow=current.previous;locks.delete(owner);}
  };
}
